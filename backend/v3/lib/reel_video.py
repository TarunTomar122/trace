"""Make Trace's daily reel: a newsreader script, generated pictures, an ElevenLabs voice and a 1080x1920 MP4.

Used by v3.flows.post_reel. Steps, each its own function so a run can be checked piece by piece:

  write_script(stories)            -> script dict (write, then critique facts and style, then revise)
  make_images(script, folder)      -> two pictures per story (Runway, one art direction)
  make_voice(script, folder)       -> voice.mp3 + word timings (Runway ElevenLabs v3, OpenAI whisper-1)
  render(script, stories, timings, folder, date_label) -> reel.mp4 and cover.jpg

Each story dict needs: title, source, paragraphs (list), points (list), lane.
"""

from __future__ import annotations

import difflib
import json
import math
import os
import re
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

import requests
from PIL import Image, ImageDraw, ImageFilter, ImageFont

FONTS = Path(__file__).resolve().parents[1] / "assets" / "instagram"
W, H, FPS = 1080, 1920, 30
YELLOW = (255, 239, 95)
# Instagram covers about the top 14% and the bottom 20-35% of a reel: text stays between.
TOP_SAFE, SUB_Y = 290, 1170

SCRIPT_MODEL = os.getenv("REEL_SCRIPT_MODEL", "gpt-6.1-terra")
VOICE = os.getenv("REEL_VOICE", "Elliot")  # Runway preset; the creator's pick of the ElevenLabs v3 voices
IMAGE_MODEL = os.getenv("REEL_IMAGE_MODEL", "gemini_image3.1_flash")
RUNWAY = "https://api.dev.runwayml.com/v1"
SIGN_OFF = "That's Trace for today."
# A take that runs long is sped up a little (too little to hear); a normal one stays at natural speed.
TARGET_SECONDS = 52.0
MAX_TEMPO = 1.12
MAX_PAUSE = 0.32  # longest gap kept between words, in seconds

ART_DIRECTION = (
    "Editorial illustration for a calm tech news brief. Cinematic, soft directional light, muted blue-grey "
    "palette with one warm amber accent, shallow depth of field, minimal composition, one clear subject. "
    "Objects and places only: no people's faces, no text, letters, numbers, logos or user interfaces. "
    "Vertical 9:16, subject in the middle third."
)


def _log(message: str) -> None:
    print(f"[{time.strftime('%Y-%m-%d %H:%M:%S', time.gmtime())}] [reel] {message}", flush=True)


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONTS / name), size)


# ---------------------------------------------------------------------------
# Script: write -> critique (facts + style) -> revise
# ---------------------------------------------------------------------------

WRITER_PROMPT = """You write the voiceover for Trace's daily Instagram reel: today's {count} tech stories, read
aloud by a text-to-speech voice over pictures with subtitles. Trace sounds like a calm radio newsreader
talking to one person: plain, specific, no performance.

How to write it (and why):
1. Start with the single most notable fact of the day, and say who says it when it is a claim: "Cohere says
   Alibaba's Qwen model tried to send files to a server in Beijing." The listener decides in two seconds; a
   clear, specific fact holds them better than a teaser.
2. When something is a claim, finding or allegation, say who makes it first ("Cohere says ..."). Heard aloud, a
   claim sounds like fact until the listener knows who said it. Name the company or people involved, never the
   news site or newsletter. Plain events (a launch, a price, a ban) need no attribution.
3. One idea per sentence, 6 to 18 words, with varied lengths. No "which"/"who" clauses: they are hard to follow by ear.
4. Plain verbs: is, are, has, says, launched, banned.
5. Only facts that are in the story summaries. If something isn't there, leave it out.
6. Each story stands alone. Move on with a plain signpost: "Next, OpenAI." "Also today," "In markets,".
   Only connect two stories if they involve the same company, product or event.
7. Don't tell the listener what matters or what it means. The facts do that.
8. The last story ends on a fact. Then the sign-off, exactly: "{sign_off}"
9. Numbers rounded the way people say them, written in digits so the subtitles read well: "60,000 employees",
   "about 2,700 comments", "$699", "about $41 million", "more than 3 times faster". Keep product names exactly as
   written ("GPT-6.1 Terra", "iPhone 17"). At most one number per sentence.
10. Punctuation for a voice: periods and commas only. No dashes, semicolons, colons, brackets or ellipses.
11. Name things exactly the first time ("Alibaba's Qwen model", "Elvis Presley's estate"); after that use the short
    name or "it"/"they", never a new description. The voice can't read handles, subreddit
    names, URLs or slashes, so describe them in words: "Reddit's open source forum", not "r/opensource".
12. {low} to {high} words in total. Short is better: it's read at a natural pace.
13. For each story pick the one or two details a normal person would find most interesting. Skip jargon
    (context windows, tokens, benchmarks) unless it is the story itself.
14. Mix the topics: don't put all the AI stories next to each other.

Here is a script in the right style (from another day; never reuse its facts):
---
Nvidia says its new chips will ship to cloud providers in March, two months later than planned.
The company blamed a packaging problem at its main supplier. Next, Google. It added a coding agent to
Gmail for business accounts, and it can draft replies from a company's own documents. In Europe,
regulators fined a facial recognition startup about thirty million euros for scraping photos without
consent. The company says it will appeal. That's Trace for today.
---

Return JSON:
{{
 "hook": "the opening sentence: the day's most notable fact, with its source when it is a claim",
 "stories": [
   {{"n": <story number below>,
     "label": "2-3 word tag shown on screen, e.g. 'Qwen file attempt'",
     "text": "this story's sentences. For the hook's story, continue after the hook without repeating it",
     "receipt_phrase": "2-4 words copied exactly from that story's headline to highlight",
     "stress": ["1-2 single words from this story's text that a newsreader would stress"],
     "stat": {{"value": <number as digits, or null>, "prefix": "e.g. $", "unit": "e.g. employees / times faster",
              "label": "short caption for the number", "word": "the number as it appears in your text, e.g. '60,000' or '$699'"}},
     "shots": ["picture 1: a specific, concrete scene that shows this story at a glance (an object or place with
                the story's key detail visible), no people or text",
               "picture 2: a different close-up detail from the same scene"]}}
 ],
 "outro": "{sign_off}"
}}
Use every story below exactly once. The hook's story comes first. Use "stat" only when the text says a number;
otherwise set value to null.

STORIES:
{stories}"""

CRITIC_PROMPT = """You check a short news voiceover before it airs. Be strict and specific.

SOURCE SUMMARIES (the only facts allowed):
{stories}

SCRIPT (JSON):
{script}

Check every sentence and list each problem:
1. Unsupported: any claim, number, motive, effect or adjective not stated in the summaries.
2. AI-sounding or hype wording: delve, pivotal, crucial, landscape, underscore, showcase, highlight, testament,
   game-changer, groundbreaking, revolutionary, unprecedented, seismic, sparks, raises questions, reshape,
   navigate, evolving, ecosystem, bold, stunning, massive, huge, "big deal", "Here's the thing", "It's not X,
   it's Y", "not just X but Y", "But here's the catch", "Nobody asked", "What does this mean", "remains to be
   seen", "only time will tell", "is still up for debate", "As AI gets", "In a world where", unnamed "experts".
3. Structures: a fact repeated (including one already said in the hook), lists of three, verbless dramatic fragments, rhetorical questions, sentences ending in an
   "-ing" clause ("..., signaling a shift"), a closing moral or summary, a bridge sentence linking stories by an
   abstract theme (trust, openness, cost), a sentence that only says something matters.
4. Attribution: a claim, finding or allegation stated as fact without saying who makes it. Do NOT flag plain
   events (launches, prices, bans) and do NOT ask for news outlets or newsletters to be named; attribution names
   the company or people involved.
5. Voice punctuation: dashes, semicolons, colons, brackets, ellipses, curly quotes, and anything a voice can't
   read aloud (subreddit names like r/..., @handles, URLs, slashes).
6. Rhythm: a sentence over 20 words, or two sentences in a row starting with the same words (signposts like
   "Next, OpenAI." are fine and are not fragments).
7. Ending: the last story must end on a fact, then exactly "{sign_off}"
8. Length: {low}-{high} words across hook, story texts and outro (count them). Jargon a normal listener wouldn't follow.
9. Fields: every story used exactly once; receipt_phrase must appear in that story's headline; stress words must
   appear in that story's text; stat.word must appear in that story's text, and if the number is only in the hook
   the fix is to set stat.value to null, never to repeat the number.
Only list real problems a careful editor would fix; don't nitpick. If the script is fine, return no problems.
Return JSON: {{"word_count": <int>, "problems": [{{"quote": "...", "issue": "...", "fix": "..."}}]}}"""

REVISE_PROMPT = """Rewrite this reel script to fix every problem listed, following the same rules and JSON shape.
Keep everything that has no problem. Only facts from the summaries.

RULES:
{rules}

SOURCE SUMMARIES:
{stories}

SCRIPT:
{script}

PROBLEMS:
{problems}

Return the corrected script JSON only."""

# Checked in code as well as by the critic: these slip through prompts.
BANNED = re.compile(
    r"\b(delve|pivotal|crucial|landscape|underscore|showcase|highlight|testament|game[- ]changer|groundbreaking|"
    r"revolutionary|unprecedented|seismic|sparks?|raises questions|reshape|navigate|evolving|ecosystem|bold|"
    r"stunning|massive|huge|big deal|here's the thing|nobody asked|remains to be seen|only time will tell|"
    r"up for debate|in a world where)\b|[—–;:…()\[\]/@]",
    re.I,
)


def word_range(count: int) -> tuple[int, int]:
    """About 18 words a story plus the hook and sign-off: ~50s for five stories."""
    return 16 * count + 10, 20 * count + 10


def stories_block(stories: list[dict[str, Any]]) -> str:
    return "\n\n".join(
        f"{i + 1}. HEADLINE: {s['title']} (source: {s['source']}; topic: {s['lane']})\n" + "\n".join(s["paragraphs"])
        + "\n" + "\n".join(f"- {p}" for p in s["points"])
        for i, s in enumerate(stories)
    )


def spoken_text(script: dict[str, Any]) -> str:
    return " ".join([script["hook"]] + [st["text"] for st in script["stories"]] + [script["outro"]])


def _ask(prompt: str, effort: str) -> dict[str, Any]:
    from openai import OpenAI

    response = OpenAI().chat.completions.create(
        model=SCRIPT_MODEL, messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"}, reasoning_effort=effort, timeout=240,
    )
    return json.loads(response.choices[0].message.content or "{}")


def script_problems(script: dict[str, Any], count: int) -> list[dict[str, str]]:
    """What code can check without a model: shape, banned words, voice punctuation, length."""
    problems: list[dict[str, str]] = []
    numbers = sorted(_int(st.get("n")) for st in script.get("stories") or [] if isinstance(st, dict))
    if numbers != list(range(1, count + 1)):
        problems.append({"quote": str(numbers), "issue": "every story must be used exactly once", "fix": f"use stories 1-{count}"})
        return problems
    script.setdefault("outro", SIGN_OFF)
    if not str(script.get("hook") or "").strip() or any(not str(st.get("text") or "").strip() for st in script["stories"]):
        problems.append({"quote": "", "issue": "the hook and every story need text", "fix": "write them"})
        return problems
    if any(SIGN_OFF.lower().rstrip(".") in str(st.get("text") or "").lower() for st in script["stories"]):
        problems.append({"quote": SIGN_OFF, "issue": "the sign-off belongs only in outro", "fix": "remove it from the story"})
    text = spoken_text(script)
    found = sorted({m.group(0) for m in BANNED.finditer(text)})
    if found:
        problems.append({"quote": ", ".join(found), "issue": "banned word or voice punctuation", "fix": "rephrase without it"})
    low, high = word_range(count)
    words = len(text.split())
    if not low - 2 <= words <= high + 2:
        problems.append({"quote": f"{words} words", "issue": "length", "fix": f"{low}-{high} words"})
    return problems


def _int(value: Any) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return 0


def _number(value: Any) -> float | None:
    """A stat value the card can count up to, or None ("2x", "1.05 million" and "$699" are not)."""
    if isinstance(value, bool):
        return None
    try:
        number = float(str(value).replace(",", "").strip())
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def clean_script(script: dict[str, Any]) -> dict[str, Any]:
    """The model's JSON in the exact shape the renderer needs; anything odd is dropped, not trusted."""
    stories = []
    for st in script.get("stories") or []:
        if not isinstance(st, dict):
            continue
        label = re.sub(r"\s+", " ", str(st.get("label") or "")).strip()[:28] or "Today"
        shots = [str(x).strip() for x in st.get("shots") or [] if str(x).strip()] if isinstance(st.get("shots"), list) else []
        shots = (shots + [label, label])[:2]
        stat = st.get("stat") if isinstance(st.get("stat"), dict) else {}
        value = _number(stat.get("value"))
        stats = {"value": value, "prefix": str(stat.get("prefix") or "")[:3], "unit": str(stat.get("unit") or "")[:32],
                 "label": str(stat.get("label") or "")[:80], "word": str(stat.get("word") or "")} if value is not None else {"value": None}
        stories.append({
            "n": _int(st.get("n")), "label": label, "text": re.sub(r"\s+", " ", str(st.get("text") or "")).strip(),
            "receipt_phrase": str(st.get("receipt_phrase") or "")[:60],
            "stress": [str(w) for w in st.get("stress") or [] if isinstance(w, (str, int, float))][:2] if isinstance(st.get("stress"), list) else [],
            "stat": stats, "shots": shots,
        })
    return {"hook": re.sub(r"\s+", " ", str(script.get("hook") or "")).strip(), "stories": stories, "outro": SIGN_OFF}


def write_script(stories: list[dict[str, Any]], rounds: int = 3) -> dict[str, Any]:
    count = len(stories)
    low, high = word_range(count)
    block = stories_block(stories)
    fill = {"count": count, "low": low, "high": high, "sign_off": SIGN_OFF}
    writer = WRITER_PROMPT.format(stories=block, **fill)
    script = clean_script(_ask(writer, "medium"))
    rules = writer.split("Here is a script")[0]
    for round_no in range(1, rounds + 1):
        problems = script_problems(script, count)
        if not any(p["issue"].startswith(("every story", "the hook and every story")) for p in problems):
            review = _ask(CRITIC_PROMPT.format(stories=block, script=json.dumps(script, ensure_ascii=False), **fill), "high")
            problems += review.get("problems") or []
        _log(f"script round {round_no}: {len(problems)} problems" + "".join(f"\n    - {p.get('issue', '')[:110]}" for p in problems))
        if not problems:
            break
        script = clean_script(_ask(REVISE_PROMPT.format(rules=rules, stories=block, script=json.dumps(script, ensure_ascii=False),
                                                        problems=json.dumps(problems, ensure_ascii=False)), "medium"))
    leftover = script_problems(script, count)
    if any(p["issue"].startswith(("every story", "the hook and every story")) for p in leftover):
        raise RuntimeError(f"script is not usable: {leftover}")
    if leftover:
        _log(f"posting with minor problems left: {leftover}")
    script["outro"] = SIGN_OFF
    return script


# ---------------------------------------------------------------------------
# Runway: pictures and voice
# ---------------------------------------------------------------------------


def _runway(path: str, body: dict[str, Any], timeout: int = 300) -> str:
    headers = {
        "Authorization": f"Bearer {os.environ['RUNWAY_API_KEY']}",
        "X-Runway-Version": "2024-11-06",
        "Content-Type": "application/json",
    }
    response = requests.post(f"{RUNWAY}/{path}", headers=headers, json=body, timeout=60)
    if response.status_code >= 400:
        raise RuntimeError(f"runway {path} {response.status_code}: {response.text[:300]}")
    task_id = response.json()["id"]
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            reply = requests.get(f"{RUNWAY}/tasks/{task_id}", headers=headers, timeout=30)
            task = reply.json() if reply.ok else {}
        except (requests.RequestException, ValueError):
            task = {}  # a network blip: ask again
        if not task:
            time.sleep(5)
            continue
        if task.get("status") == "SUCCEEDED":
            output = task["output"]
            return output[0] if isinstance(output, list) else output
        if task.get("status") in ("FAILED", "CANCELLED"):
            raise RuntimeError(f"runway {path} failed: {task.get('failure') or task.get('failureCode')}")
        time.sleep(2)
    raise TimeoutError(f"runway {path} took over {timeout}s")


def _download(url: str, path: Path) -> None:
    response = requests.get(url, timeout=120)
    response.raise_for_status()
    path.write_bytes(response.content)


def make_images(script: dict[str, Any], folder: Path) -> None:
    """picture-<n>-hero.png and picture-<n>-detail.png; a missing detail falls back to the hero."""

    def one(job: tuple[int, str, str]) -> tuple[int, str, str | None]:
        n, kind, prompt = job
        path = folder / f"picture-{n}-{kind}.png"
        if path.exists():
            return n, kind, None
        for attempt in range(2):
            try:
                _download(_runway("text_to_image", {"model": IMAGE_MODEL, "promptText": f"{prompt} {ART_DIRECTION}",
                                                    "ratio": "768:1344"}), path)
                return n, kind, None
            except Exception as exc:  # noqa: BLE001 - retried once, then reported
                error = str(exc)
        return n, kind, error

    jobs = [(int(st["n"]), kind, (st.get("shots") or ["", ""])[k] or st["label"])
            for st in script["stories"] for k, kind in enumerate(("hero", "detail"))]
    with ThreadPoolExecutor(5) as pool:
        failures = [r for r in pool.map(one, jobs) if r[2]]
    for n, kind, error in failures:
        hero = folder / f"picture-{n}-hero.png"
        if kind == "detail" and hero.exists():
            _log(f"detail picture {n} failed, reusing the hero: {error}")
            (folder / f"picture-{n}-detail.png").write_bytes(hero.read_bytes())
        else:
            raise RuntimeError(f"picture {n} {kind} failed: {error}")


def _norm(word: str) -> str:
    return re.sub(r"[^a-z0-9]", "", word.lower())


def segments(script: dict[str, Any]) -> list[tuple[str, str]]:
    return ([("hook", script["hook"])] + [(f"s{i}", st["text"]) for i, st in enumerate(script["stories"])]
            + [("outro", script["outro"])])


def align(script: dict[str, Any], heard: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Script words (their spelling, for subtitles) with times from the matching heard words."""
    words: list[dict[str, Any]] = []
    for seg, text in segments(script):
        for w in re.sub(r"\s*[—–]\s*", "— ", text).split():
            words.append({"w": w, "seg": seg})
    matcher = difflib.SequenceMatcher(None, [_norm(w["w"]) for w in words], [_norm(h["w"]) for h in heard], autojunk=False)
    for a, b, n in matcher.get_matching_blocks():
        for k in range(n):
            words[a + k]["s"], words[a + k]["e"] = heard[b + k]["s"], heard[b + k]["e"]
    end = heard[-1]["e"] if heard else 0.0
    i = 0
    while i < len(words):  # spread unmatched words between their timed neighbours
        if "s" in words[i]:
            i += 1
            continue
        j = i
        while j < len(words) and "s" not in words[j]:
            j += 1
        t0 = words[i - 1]["e"] if i else 0.0
        t1 = words[j]["s"] if j < len(words) else max(end, t0 + 0.3 * (j - i))
        step = (t1 - t0) / (j - i)
        for k in range(i, j):
            words[k]["s"], words[k]["e"] = t0 + step * (k - i), t0 + step * (k - i + 1)
        i = j
    return words


def _duration(path: Path) -> float:
    return float(subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)]).strip())


def keep_spans(heard: list[dict[str, Any]], total: float, pause: float = MAX_PAUSE) -> list[tuple[float, float]]:
    """Audio to keep so that no gap between words is longer than `pause` (half kept on each side)."""
    spans, start = [], 0.0
    for cur, nxt in zip(heard, heard[1:]):
        if nxt["s"] - cur["e"] > pause:
            spans.append((start, cur["e"] + pause / 2))
            start = nxt["s"] - pause / 2
    spans.append((start, min(total, (heard[-1]["e"] if heard else total) + 0.4)))
    return [(a, b) for a, b in spans if b > a]


def heard_share(script: dict[str, Any], heard: list[dict[str, Any]]) -> float:
    said = [_norm(w) for _, text in segments(script) for w in text.split()]
    matcher = difflib.SequenceMatcher(None, said, [_norm(h["w"]) for h in heard], autojunk=False)
    return sum(n for _, _, n in matcher.get_matching_blocks()) / max(1, len(said))


def remap(t: float, spans: list[tuple[float, float]], tempo: float) -> float:
    """A time in the raw take -> the same moment in the trimmed, sped-up voice."""
    out = 0.0
    for a, b in spans:
        if t <= a:
            break
        out += min(t, b) - a
    return out / tempo


MIN_HEARD = 0.85  # share of script words whisper must hear, or the take dropped lines


def make_voice(script: dict[str, Any], folder: Path) -> dict[str, Any]:
    for attempt in (1, 2):
        timings, heard_share = _make_voice_once(script, folder)
        if heard_share >= MIN_HEARD:
            return timings
        _log(f"voice take {attempt} only said {heard_share:.0%} of the script")
    raise RuntimeError("the voice kept dropping lines of the script")


def _make_voice_once(script: dict[str, Any], folder: Path) -> tuple[dict[str, Any], float]:
    """voice.mp3 and timings.json. ElevenLabs leaves about a second between sentences and newsreader
    sentences are short, so pauses over MAX_PAUSE are cut using whisper's word times. A take still
    over TARGET_SECONDS is sped up by at most MAX_TEMPO."""
    raw, voice = folder / "voice-raw.mp3", folder / "voice.mp3"
    _download(_runway("text_to_speech", {"model": "eleven_v3", "promptText": spoken_text(script),
                                         "voice": {"type": "runway-preset", "presetId": VOICE}}), raw)
    from openai import OpenAI

    with raw.open("rb") as f:
        result = OpenAI().audio.transcriptions.create(
            model="whisper-1", file=f, response_format="verbose_json", timestamp_granularities=["word"])
    heard = [{"w": w.word, "s": float(w.start), "e": float(w.end)} for w in result.words or []]
    if not heard:
        raise RuntimeError("whisper heard no words in the voice")
    spans = keep_spans(heard, _duration(raw))
    kept = sum(b - a for a, b in spans)
    tempo = max(1.0, min(MAX_TEMPO, kept / TARGET_SECONDS))
    # atrim + concat (aselect ignores the ranges on this audio)
    pieces = "".join(f"[0]atrim={a:.3f}:{b:.3f},asetpts=PTS-STARTPTS[p{i}];" for i, (a, b) in enumerate(spans))
    joined = "".join(f"[p{i}]" for i in range(len(spans))) + f"concat=n={len(spans)}:v=0:a=1"
    graph = pieces + joined + (f",atempo={tempo:.3f}" if tempo > 1.01 else "") + "[out]"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(raw), "-filter_complex", graph, "-map", "[out]",
                    "-b:a", "160k", str(voice)], check=True)
    _log(f"voice {_duration(raw):.1f}s raw, {kept:.1f}s after pauses, {tempo:.2f}x -> {_duration(voice):.1f}s")
    moved = [{"w": h["w"], "s": remap(h["s"], spans, tempo), "e": remap(h["e"], spans, tempo)} for h in heard]
    words = align(script, moved)
    timings = {"duration": _duration(voice), "words": words}
    (folder / "timings.json").write_text(json.dumps(timings))
    return timings, heard_share(script, heard)


# ---------------------------------------------------------------------------
# Render
# ---------------------------------------------------------------------------


def ease(x: float) -> float:
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def cover_fit(im: Image.Image, w: int, h: int, zoom: float, pan: float = 0.0) -> Image.Image:
    s = max(w / im.width, h / im.height) * zoom
    cw, ch = w / s, h / s
    x0 = (im.width - cw) / 2 * (1 + pan * 0.6)
    y0 = (im.height - ch) / 2
    return im.resize((w, h), Image.BILINEAR, box=(x0, y0, x0 + cw, y0 + ch))


def wrap(text: str, f: ImageFont.FreeTypeFont, width: int) -> list[str]:
    lines, cur = [], ""
    for word in text.split():
        trial = f"{cur} {word}".strip()
        if f.getlength(trial) <= width or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = word
    return lines + ([cur] if cur else [])


class Reel:
    """Shots per story (picture, source card, stat card, picture) cut on word boundaries."""

    def __init__(self, script: dict[str, Any], stories: list[dict[str, Any]], timings: dict[str, Any],
                 folder: Path, date_label: str):
        self.script, self.date_label = script, date_label
        self.stories = {int(st["n"]): stories[int(st["n"]) - 1] for st in script["stories"]}
        self.words, self.audio_dur = timings["words"], timings["duration"]
        self.count = len(script["stories"])
        self.f = {
            "sub": font("Inter-SemiBold.ttf", 60),
            "tag": font("Inter-Bold.ttf", 30),
            "mark": font("RobotoSerif-Display-700.ttf", 40),
            "pub": font("Inter-Bold.ttf", 30),
            "date": font("Inter-SemiBold.ttf", 30),
            "head": font("RobotoSerif-Display-700.ttf", 58),
            "stat": font("RobotoSerif-Display-700.ttf", 230),
            "unit": font("Inter-Bold.ttf", 60),
            "statlabel": font("Inter-SemiBold.ttf", 46),
        }
        self.img = {(int(st["n"]), kind): Image.open(folder / f"picture-{st['n']}-{kind}.png").convert("RGB")
                    for st in script["stories"] for kind in ("hero", "detail")}
        self.blur = {k: cover_fit(im, W, H, 1.1).filter(ImageFilter.GaussianBlur(24)) for k, im in self.img.items()}
        g = Image.new("L", (1, H))
        for y in range(H):
            top = 150 * max(0.0, 1 - y / 520) ** 1.6
            low = 175 * max(0.0, min(1.0, (y - 820) / 560)) ** 1.3
            g.putpixel((0, y), int(max(top, low)))
        self.grad = g.resize((W, H))
        self.black = Image.new("RGB", (W, H), (0, 0, 0))
        self.groups = self._subtitle_groups()
        self.shots = self._shots()
        self.dur = self.audio_dur + 0.5

    # ----- timing -----------------------------------------------------------
    def seg_order(self) -> list[str]:
        return ["hook"] + [f"s{i}" for i in range(self.count)] + ["outro"]

    def seg_words(self, seg: str) -> list[dict[str, Any]]:
        return [w for w in self.words if w["seg"] == seg]

    def seg_span(self, seg: str) -> tuple[float, float]:
        order = self.seg_order()
        own = self.seg_words(seg)
        start = (own[0]["s"] if own else 0.0) - 0.12
        nxt = order[order.index(seg) + 1] if seg != "outro" else None
        nxt_words = self.seg_words(nxt) if nxt else []
        end = nxt_words[0]["s"] - 0.12 if nxt_words else self.audio_dur + 0.5
        return max(0.0, start), end

    def find_word(self, seg: str, target: str) -> dict[str, Any] | None:
        key = _norm((target or "").split()[0]) if (target or "").split() else ""
        if not key:
            return None
        words = self.seg_words(seg)
        exact = next((w for w in words if _norm(w["w"]) == key), None)
        return exact or (next((w for w in words if _norm(w["w"]).startswith(key)), None) if len(key) >= 3 else None)

    def _subtitle_groups(self) -> list[list[int]]:
        """Phrases of up to six words that fit on one line; split at sentence ends and story changes."""
        groups: list[list[int]] = []
        cur: list[int] = []
        for i, w in enumerate(self.words):
            line = " ".join(self.words[k]["w"] for k in cur + [i])
            if cur and (len(cur) >= 6 or self.f["sub"].getlength(line) > W - 200
                        or self.words[cur[-1]]["seg"] != w["seg"] or re.search(r"[.!?,]$", self.words[cur[-1]]["w"])):
                groups.append(cur)
                cur = []
            cur.append(i)
        if cur:
            groups.append(cur)
        for k in range(1, len(groups)):  # no single-word tails
            if (len(groups[k]) == 1 and len(groups[k - 1]) > 2
                    and self.words[groups[k][0]]["seg"] == self.words[groups[k - 1][-1]]["seg"]
                    and not re.search(r"[.!?]$", self.words[groups[k - 1][-1]]["w"])):
                groups[k].insert(0, groups[k - 1].pop())
        return groups

    def _split(self, cuts: list[tuple[str, float, float]], seg: str, longest: float = 3.6):
        """Break picture shots longer than `longest` at word starts, alternating hero and detail."""
        starts = [w["s"] - 0.06 for w in self.seg_words(seg)]
        out = []
        for kind, t0, t1 in cuts:
            if kind not in ("hero", "detail") or t1 - t0 <= longest:
                out.append((kind, t0, t1))
                continue
            parts = max(2, round((t1 - t0) / 3.0))
            marks = [t0]
            for k in range(1, parts):
                target = t0 + (t1 - t0) * k / parts
                near = min(starts, key=lambda x: abs(x - target)) if starts else target
                if marks[-1] + 1.2 < near < t1 - 1.2:
                    marks.append(near)
            marks.append(t1)
            other = "detail" if kind == "hero" else "hero"
            out += [(kind if k % 2 == 0 else other, marks[k], marks[k + 1]) for k in range(len(marks) - 1)]
        return out

    def _shots(self) -> list[dict[str, Any]]:
        shots: list[dict[str, Any]] = []
        first = int(self.script["stories"][0]["n"])
        _, hook_end = self.seg_span("hook")
        for kind, t0, t1 in self._split([("hero", 0.0, hook_end)], "hook"):
            shots.append({"kind": kind, "t0": t0, "t1": t1, "n": first, "i": None})
        for i, st in enumerate(self.script["stories"]):
            seg, n = f"s{i}", int(st["n"])
            a, b = self.seg_span(seg)
            ws = self.seg_words(seg)
            sentence_starts = [ws[k]["s"] - 0.08 for k in range(1, len(ws)) if re.search(r"[.!?]$", ws[k - 1]["w"])]
            card_at = sentence_starts[0] if sentence_starts and sentence_starts[0] - a > 1.6 else a + min(2.6, (b - a) * 0.3)
            card_end = max(card_at + 1.2, min(card_at + 3.0, b - 1.2))
            # never the same picture twice in a row
            opening = "hero" if shots[-1]["kind"] != "hero" or shots[-1]["n"] != n else "detail"
            cuts = [(opening, a, card_at), ("receipt", card_at, min(card_end, b))]
            t = min(card_end, b)
            stat = st.get("stat") or {}
            hit = self.find_word(seg, stat.get("word", "")) if _number(stat.get("value")) is not None else None
            rest = "detail" if opening == "hero" else "hero"
            if hit and hit["s"] - 0.2 >= t - 0.05 and hit["s"] + 2.4 <= b + 0.3:
                if hit["s"] - 0.2 - t > 0.6:
                    cuts.append((rest, t, hit["s"] - 0.2))
                    rest = opening
                cuts.append(("stat", hit["s"] - 0.2, min(b, hit["s"] + 2.4)))
                t = min(b, hit["s"] + 2.4)
            if b - t > 0.3:
                cuts.append((rest, t, b))
            stress = [self.find_word(seg, s) for s in st.get("stress") or []]
            for kind, t0, t1 in self._split(cuts, seg):
                shots.append({"kind": kind, "t0": t0, "t1": t1, "n": n, "i": i,
                              "stress": [w for w in stress if w and t0 <= w["s"] < t1]})
        outro_start, outro_end = self.seg_span("outro")
        # The reel ends on its opening picture, so a replay runs on without a jump.
        shots.append({"kind": "hero", "t0": outro_start, "t1": outro_end + 1.0, "n": first, "i": None, "still": True})
        return shots

    def shot_at(self, t: float) -> dict[str, Any]:
        current = self.shots[0]
        for shot in self.shots:
            if t >= shot["t0"]:
                current = shot
        return current

    # ----- drawing ----------------------------------------------------------
    def picture(self, shot: dict[str, Any], t: float) -> Image.Image:
        """Settles 1.05 -> 1.0 after the cut, drifts slightly, punches in on stressed words."""
        local, dur = t - shot["t0"], max(shot["t1"] - shot["t0"], 1.0)
        if shot.get("still"):
            zoom, pan = 1.05, 0.0
        else:
            punch = max([0.07 * ease((t - w["s"]) / 0.2) for w in shot.get("stress") or [] if t >= w["s"]] or [0.0])
            zoom = 1.0 + 0.05 * (1 - ease(local / 0.35)) + 0.025 * local / dur + punch
            pan = 0.25 * math.sin(shot["n"] * 1.7 + (3 if shot["kind"] == "detail" else 0)) * local / dur
        im = cover_fit(self.img[(shot["n"], shot["kind"])], W, H, zoom, pan)
        return Image.composite(self.black, im, self.grad)

    def receipt(self, n: int, local: float) -> Image.Image:
        """Source card: publisher, date and the headline in our type, highlighter on the key phrase."""
        st = next(s for s in self.script["stories"] if int(s["n"]) == n)
        story = self.stories[n]
        bg = Image.blend(self.blur[(n, "hero")], self.black, 0.35).convert("RGBA")
        cw, x0 = W - 128, 64
        lines = wrap(story["title"], self.f["head"], cw - 88)[:4]
        ch = 120 + len(lines) * 74 + 60
        y0 = int(560 + 60 * (1 - ease(local / 0.3)))
        card = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
        cd = ImageDraw.Draw(card)
        cd.rounded_rectangle((0, 0, cw, ch), 28, fill=(255, 255, 255, 255))
        cd.text((44, 64), story["source"].upper()[:34], font=self.f["pub"], anchor="lm", fill=(10, 10, 10))
        cd.text((cw - 44, 64), self.date_label, font=self.f["date"], anchor="rm", fill=(118, 118, 118))
        cd.line((44, 104, cw - 44, 104), fill=(229, 229, 229), width=3)
        phrase = [w for w in (st.get("receipt_phrase") or "").lower().split() if w]
        sweep = ease((local - 0.35) / 0.5)
        y = 130
        for line in lines:
            low = line.lower()
            for word in phrase if sweep > 0 else []:
                j = low.find(word)
                if j >= 0:
                    wx = 44 + cd.textlength(line[:j], font=self.f["head"])
                    ww = cd.textlength(line[j:j + len(word)], font=self.f["head"])
                    cd.rectangle((wx - 4, y + 18, wx + 4 + ww * sweep, y + 70), fill=YELLOW)
            cd.text((44, y), line, font=self.f["head"], fill=(10, 10, 10))
            y += 74
        shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(shadow).rounded_rectangle((x0, y0 + 18, x0 + cw, y0 + ch + 18), 28, fill=(0, 0, 0, 120))
        bg.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(26)))
        alpha = ease(local / 0.2)
        card.putalpha(card.getchannel("A").point(lambda a: int(a * alpha)))
        bg.alpha_composite(card, (x0, y0))
        return bg.convert("RGB")

    def stat(self, n: int, local: float) -> Image.Image:
        st = next(s for s in self.script["stories"] if int(s["n"]) == n)["stat"]
        bg = Image.blend(self.blur[(n, "detail")], self.black, 0.45)
        d = ImageDraw.Draw(bg)
        raw = str(st["value"]).replace(",", "")
        value = _number(raw) or 0.0
        if raw.endswith(".0"):
            raw = raw[:-2]
        decimals = len(raw.split(".")[1]) if "." in raw else 0
        shown = f"{value * ease(local / 0.7):,.{decimals}f}"
        number = f"{st.get('prefix') or ''}{shown}"
        size = 230
        while font("RobotoSerif-Display-700.ttf", size).getlength(number) > W - 140 and size > 120:
            size -= 10
        d.text((W // 2, 760), number, font=font("RobotoSerif-Display-700.ttf", size), anchor="mm", fill=(255, 255, 255))
        if st.get("unit"):
            d.text((W // 2, 920), str(st["unit"])[:32], font=self.f["unit"], anchor="mm", fill=YELLOW)
        y = 1010
        for line in wrap(str(st.get("label") or ""), self.f["statlabel"], W - 220)[:2]:
            d.text((W // 2, y), line, font=self.f["statlabel"], anchor="mm", fill=(215, 215, 215))
            y += 60
        return bg

    def top(self, im: Image.Image, t: float, story: int | None) -> None:
        """Progress (one segment per story), the wordmark, and the story's tag."""
        d = ImageDraw.Draw(im)
        gap, x0, x1 = 12, 64, W - 64
        seg_w = (x1 - x0 - gap * (self.count - 1)) / self.count
        for k in range(self.count):
            a, b = self.seg_span(f"s{k}")
            fill = max(0.0, min(1.0, (t - a) / max(0.1, b - a)))
            sx = x0 + k * (seg_w + gap)
            d.rounded_rectangle((sx, TOP_SAFE, sx + seg_w, TOP_SAFE + 6), 3, fill=(95, 95, 98))
            if fill > 0:
                d.rounded_rectangle((sx, TOP_SAFE, sx + max(6, seg_w * fill), TOP_SAFE + 6), 3, fill=(255, 255, 255))
        d.text((64, TOP_SAFE + 52), "Trace", font=self.f["mark"], anchor="lm", fill=(255, 255, 255))
        if story is not None:
            label = f"{story + 1}/{self.count}  {self.script['stories'][story]['label']}"
            while d.textlength(label, font=self.f["tag"]) > W - 64 - 260 and len(label) > 8:
                label = label[:-2].rstrip() + "…"  # keep clear of the wordmark
            w = d.textlength(label, font=self.f["tag"])
            d.rounded_rectangle((W - 64 - w - 32, TOP_SAFE + 26, W - 64, TOP_SAFE + 78), 12, fill=YELLOW)
            d.text((W - 64 - w - 16, TOP_SAFE + 52), label, font=self.f["tag"], anchor="lm", fill=(10, 10, 10))

    def subtitle(self, im: Image.Image, t: float) -> None:
        """One line, sentence case, soft shadow; words brighten as they're spoken."""
        g = next((g for g in self.groups if self.words[g[0]]["s"] - 0.08 <= t <= self.words[g[-1]]["e"] + 0.25), None)
        if not g:
            return
        f = self.f["sub"]
        toks = [self.words[i]["w"] for i in g]
        x = (W - f.getlength(" ".join(toks))) / 2
        layer = Image.new("RGBA", (W, 200), (0, 0, 0, 0))
        ImageDraw.Draw(layer).text((x, 70), " ".join(toks), font=f, fill=(0, 0, 0, 210))
        layer = layer.filter(ImageFilter.GaussianBlur(10))
        d = ImageDraw.Draw(layer)
        for k, i in enumerate(g):
            said = t >= self.words[i]["s"] - 0.04
            d.text((x, 66), toks[k], font=f, fill=(255, 255, 255, 255 if said else 140))
            x += f.getlength(toks[k] + " ")
        im.paste(layer, (0, SUB_Y - 100), layer)

    def draw(self, shot: dict[str, Any], t: float) -> Image.Image:
        if shot["kind"] == "receipt":
            return self.receipt(shot["n"], t - shot["t0"])
        if shot["kind"] == "stat":
            return self.stat(shot["n"], t - shot["t0"])
        return self.picture(shot, t)

    def frame(self, t: float) -> Image.Image:
        shot = self.shot_at(t)
        im = self.draw(shot, t)
        idx = self.shots.index(shot)
        if idx and t - shot["t0"] < 0.12:  # a short dissolve so cuts don't flash
            im = Image.blend(self.draw(self.shots[idx - 1], t), im, ease((t - shot["t0"]) / 0.12))
        self.top(im, t, shot.get("i"))
        self.subtitle(im, t)
        return im


def render(script: dict[str, Any], stories: list[dict[str, Any]], timings: dict[str, Any], folder: Path,
           date_label: str) -> Path:
    """folder/reel.mp4 (H.264 + AAC, 30fps) and folder/cover.jpg (the opening frame)."""
    reel = Reel(script, stories, timings, folder, date_label)
    out = folder / "reel.mp4"
    frames = int(reel.dur * FPS)
    ffmpeg = subprocess.Popen([
        "ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
        "-i", str(folder / "voice.mp3"),
        "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-profile:v", "high",
        "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-af", "apad", "-t", f"{reel.dur:.2f}",
        "-movflags", "+faststart", str(out),
    ], stdin=subprocess.PIPE)
    started = time.time()
    assert ffmpeg.stdin is not None
    for k in range(frames):
        frame = reel.frame(k / FPS)
        if k == int(0.6 * FPS):
            frame.save(folder / "cover.jpg", "JPEG", quality=90)
        ffmpeg.stdin.write(frame.tobytes())
    ffmpeg.stdin.close()
    if ffmpeg.wait() != 0:
        raise RuntimeError("ffmpeg failed to encode the reel")
    _log(f"rendered {out} ({reel.dur:.1f}s, {len(reel.shots)} shots) in {time.time() - started:.0f}s")
    return out
