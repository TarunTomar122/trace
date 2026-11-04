"""Make Trace's daily reel: a newsreader script, generated pictures, an ElevenLabs voice and a 1080x1920 MP4.

Used by v3.flows.post_reel. Steps, each its own function so a run can be checked piece by piece:

  write_script(stories)            -> script dict (write, then critique facts and style, then revise)
  make_images(script, folder)      -> two pictures per story (Runway, one art direction)
  make_logos(script, folder)       -> each story's company logo, when Wikimedia Commons has a clean one
  make_voice(script, folder)       -> voice.mp3 + word timings (Runway ElevenLabs v3, OpenAI whisper-1)
  render(script, stories, timings, folder, date_label) -> reel.mp4 and cover.jpg

Each story dict needs: title, source, paragraphs (list), lane.
"""

from __future__ import annotations

import difflib
import json
import math
import os
import re
import shutil
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

import requests
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

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
# The voice is used as one untouched take. Only a take that runs long is sped up, evenly and by at most
# MAX_TEMPO; cutting pauses out of it made sentences run into each other and the voice sound spliced.
TARGET_SECONDS = 52.0
MAX_TEMPO = 1.12

ART_DIRECTION = (
    "Editorial illustration for a calm tech news brief. Cinematic, soft directional light, muted blue-grey "
    "palette with one warm amber accent, shallow depth of field, minimal composition, one clear subject. "
    "Objects and places only: no people's faces, no text, letters, numbers, logos or user interfaces. "
    "One full-bleed photograph filling the whole vertical 9:16 frame: no borders, frames, panels or inset "
    "pictures. Subject in the middle third."
)


def _log(message: str) -> None:
    print(f"[{time.strftime('%Y-%m-%d %H:%M:%S', time.gmtime())}] [reel] {message}", flush=True)


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONTS / name), size)


# ---------------------------------------------------------------------------
# Script: write -> critique (facts + style) -> revise
# ---------------------------------------------------------------------------

WRITER_PROMPT = """You write the voiceover for Trace's daily Instagram reel: today's {count} news stories, read
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
6. Each story stands alone. Usually just start it with its subject: "Apple launched a new iPad Mini." A plain
   signpost is fine now and then ("Also today," "In markets," "Finally,"), but never "Next". Only connect two
   stories if they involve the same company, product or event.
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
14. Mix the topics: don't put stories from the same field or company next to each other.

Here is a script in the right style (from another day; never reuse its facts):
---
Nvidia says its new chips will ship to cloud providers in March, two months later than planned.
The company blamed a packaging problem at its main supplier. Google added a coding agent to
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
     "company": "the company or organisation the story is about, written as it usually is (e.g. 'Microsoft',
                 'T-Mobile'), or '' if there isn't one",
     "text": "this story's sentences. For the hook's story, continue after the hook without repeating it",
     "receipt_phrase": "2-4 words copied exactly from that story's headline to highlight",
     "stat": {{"value": <number as digits, or null>, "prefix": "e.g. $", "unit": "e.g. employees / times faster",
              "label": "short caption for the number", "word": "the number as it appears in your text, e.g. '60,000' or '$699'"}},
     "shots": ["picture 1: a specific, concrete scene that shows this story at a glance (an object or place with
                the story's key detail visible), no people, text, logos or brand marks",
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
6. Rhythm: a sentence over 20 words, two sentences in a row starting with the same words, or a story starting
   with "Next" (start it with its subject instead; "Also today," and "Finally," are fine).
7. Ending: the last story must end on a fact, then exactly "{sign_off}"
8. Length: {low}-{high} words across hook, story texts and outro (count them). Jargon a normal listener wouldn't follow.
9. Fields: every story used exactly once; receipt_phrase must appear in that story's headline; stat.word must appear in that story's text, and if the number is only in the hook
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


# "Next, Apple." between stories sounds read off a list; the user asked for it never to be used.
NEXT = re.compile(
    r"^\W*next\b(?!\s+(?:week|weekend|month|year|quarter|day|time|generation|season|summer|winter|spring|fall|"
    r"autumn|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|[-.]\w)", re.I)


def word_range(count: int) -> tuple[int, int]:
    """About 18 words a story plus the hook and sign-off: ~50s for five stories."""
    return 16 * count + 10, 20 * count + 10


def stories_block(stories: list[dict[str, Any]]) -> str:
    return "\n\n".join(
        f"{i + 1}. HEADLINE: {s['title']} (source: {s['source']}; topic: {s['lane']})\n" + "\n".join(s["paragraphs"])
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
    if any(NEXT.search(str(st.get("text") or "")) for st in script["stories"]):
        problems.append({"quote": "Next,", "issue": "stories never move on with 'Next'",
                         "fix": "start the story with its subject"})
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
            "company": re.sub(r"\s+", " ", str(st.get("company") or "")).strip()[:30],
            "receipt_phrase": str(st.get("receipt_phrase") or "")[:60],
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


WIKIDATA = "https://www.wikidata.org/w/api.php"
COMMONS = "https://commons.wikimedia.org/w/api.php"
WIKI_HEADERS = {"User-Agent": "TraceReel/1.0 (https://yourtrace.online)"}
LOGO_SECONDS = 60  # all logo lookups for one reel together; past this the cards show names


def logo_files(claims: list[dict[str, Any]]) -> list[str]:
    """Commons file names from a Wikidata logo (P154) claim list: the current logo first, then newest first."""
    def start(claim: dict[str, Any]) -> str:
        q = (claim.get("qualifiers") or {}).get("P580") or [{}]
        return str(((q[0].get("datavalue") or {}).get("value") or {}).get("time") or "")

    usable = [c for c in claims if c.get("rank") != "deprecated" and (c.get("mainsnak") or {}).get("datavalue")]
    ordered = sorted(usable, key=lambda c: (c.get("rank") == "preferred", "P582" not in (c.get("qualifiers") or {}),
                                            start(c)), reverse=True)
    return [str(c["mainsnak"]["datavalue"]["value"]) for c in ordered]


BUSINESS = re.compile(
    r"compan|corporat|business|startup|manufactur|developer|service|network|platform|brand|retail|maker|firm|"
    r"operator|website|software|laborator|organi[sz]ation|multinational|conglomerate|bank|airline|carrier|"
    r"publisher|provider|exchange|automaker|chain", re.I)


def logo_entity(company: str, hits: list[dict[str, Any]]) -> list[str]:
    """Wikidata search hits that are this company: named exactly so (or "Arm" -> "Arm Holdings") and described
    as a company, service or brand. Exact names first. "X" finds the social network, not XML; "Arm" finds
    Arm Holdings, not the US Military Academy (matched through its alias "Army")."""
    want = company.lower().strip()
    exact, prefixed = [], []
    for hit in hits:
        label = str(hit.get("label") or "").lower()
        if not BUSINESS.search(str(hit.get("description") or "")):
            continue
        if label == want:
            exact.append(hit["id"])
        elif label.startswith(want + " ") or label.startswith(want + ","):
            prefixed.append(hit["id"])
    return exact + prefixed


def logo_mark(im: Image.Image) -> Image.Image:
    """The logo for a dark card: black, grey and white parts turn near-white, colours stay. Apple's black apple
    turns white; Microsoft's squares and Nvidia's green eye keep their colour; Telegram's white plane stays
    visible on its blue disc instead of the whole badge becoming a white blob."""
    rgb = im.convert("RGB")
    _, sat, val = rgb.convert("HSV").split()
    neutral = Image.eval(sat, lambda v: 255 if v < 70 else 0)
    dark = Image.eval(val, lambda v: 255 if v < 80 else 0)
    to_white = Image.composite(Image.new("L", im.size, 255), neutral, dark)
    out = Image.composite(Image.new("RGB", im.size, (245, 245, 245)), rgb, to_white)
    out = out.convert("RGBA")
    out.putalpha(im.getchannel("A"))
    return out


def usable_logo(im: Image.Image) -> Image.Image | None:
    """The logo trimmed to its marks, or None if it can't sit on a dark card: no transparent background, or a
    block that fills its box and would show as a near-white slab once its plain parts turn white."""
    alpha = im.getchannel("A")
    box = alpha.getbbox()
    if not box or alpha.getextrema()[0] == 255:
        return None
    im = im.crop(box)
    solid = im.getchannel("A").point(lambda a: 255 if a > 128 else 0)
    filled = solid.histogram()[255] / (im.width * im.height)
    marked = logo_mark(im).convert("L").point(lambda v: 255 if v > 235 else 0)
    whitish = Image.composite(marked, Image.new("L", im.size, 0), solid).histogram()[255] / max(1, solid.histogram()[255])
    return None if filled > 0.9 and whitish > 0.6 else im


def _fetch_logo(company: str, deadline: float) -> Image.Image | None:
    """The company's current logo, from its Wikidata entry (the first search hit that has one), via Commons."""
    import io

    def get(url: str, **params: Any) -> Any:
        timeout = max(1.0, min(20.0, deadline - time.time()))
        return requests.get(url, params={**params, "format": "json"}, headers=WIKI_HEADERS, timeout=timeout).json()

    ids = logo_entity(company, get(WIKIDATA, action="wbsearchentities", search=company, language="en", type="item",
                                   limit=10).get("search", []))
    if not ids:
        return None
    entities = get(WIKIDATA, action="wbgetentities", ids="|".join(ids), props="claims").get("entities", {})
    files = next((logo_files(entities[i]["claims"]["P154"]) for i in ids
                  if (entities.get(i, {}).get("claims") or {}).get("P154")), [])
    for name in files[:4]:
        if time.time() > deadline:
            break
        try:
            pages = list(get(COMMONS, action="query", prop="imageinfo", iiprop="url", iiurlwidth=900,
                             titles=f"File:{name}").get("query", {}).get("pages", {}).values())
            info = (pages[0].get("imageinfo") or [{}])[0] if pages else {}
            url = info.get("thumburl") or info.get("url")
            if not url:
                continue
            data = requests.get(url, headers=WIKI_HEADERS, timeout=max(1.0, min(30.0, deadline - time.time()))).content
            logo = usable_logo(Image.open(io.BytesIO(data)).convert("RGBA"))
        except Exception:  # noqa: BLE001 - not an image; try the next file
            continue
        if logo is not None:
            return logo
    return None


def make_logos(script: dict[str, Any], folder: Path) -> None:
    """logo-<n>.png for each story whose company has a usable logo on Wikidata/Commons; the card shows the
    company's name when there isn't one. A failed or slow lookup never stops the reel."""
    deadline = time.time() + LOGO_SECONDS
    for st in script["stories"]:
        company, path = st.get("company") or "", folder / f"logo-{st['n']}.png"
        if not company or path.exists():
            continue
        if time.time() > deadline:
            _log(f"logo lookups ran out of time; {company} gets its name")
            continue
        try:
            logo = _fetch_logo(company, deadline)
            if logo is not None:
                logo.save(path)
        except Exception as exc:  # noqa: BLE001
            _log(f"logo lookup for {company} failed: {exc}")
            continue
        _log(f"logo for {company}: {'found' if logo is not None else 'none, using the name'}")


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


def heard_share(script: dict[str, Any], heard: list[dict[str, Any]]) -> float:
    said = [_norm(w) for _, text in segments(script) for w in text.split()]
    matcher = difflib.SequenceMatcher(None, said, [_norm(h["w"]) for h in heard], autojunk=False)
    return sum(n for _, _, n in matcher.get_matching_blocks()) / max(1, len(said))


def voice_tempo(duration: float) -> float:
    """1.0 for a normal take; a long one is sped up just enough to reach TARGET_SECONDS, at most MAX_TEMPO."""
    return max(1.0, min(MAX_TEMPO, duration / TARGET_SECONDS))


MIN_HEARD = 0.85  # share of script words whisper must hear, or the take dropped lines


def make_voice(script: dict[str, Any], folder: Path) -> dict[str, Any]:
    for attempt in (1, 2):
        timings, heard_share = _make_voice_once(script, folder)
        if heard_share >= MIN_HEARD:
            return timings
        _log(f"voice take {attempt} only said {heard_share:.0%} of the script")
    raise RuntimeError("the voice kept dropping lines of the script")


def _make_voice_once(script: dict[str, Any], folder: Path) -> tuple[dict[str, Any], float]:
    """voice.mp3 (the whole script in one take, never cut) and timings.json from whisper's word times."""
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
    tempo = voice_tempo(_duration(raw))
    if tempo > 1.01:
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(raw), "-af", f"atempo={tempo:.3f}",
                        "-b:a", "160k", str(voice)], check=True)
    else:
        tempo = 1.0
        shutil.copyfile(raw, voice)
    _log(f"voice {_duration(raw):.1f}s, {tempo:.2f}x -> {_duration(voice):.1f}s")
    words = align(script, [{"w": h["w"], "s": h["s"] / tempo, "e": h["e"] / tempo} for h in heard])
    timings = {"duration": _duration(voice), "words": words}
    (folder / "timings.json").write_text(json.dumps(timings))
    return timings, heard_share(script, heard)


# ---------------------------------------------------------------------------
# Render
# ---------------------------------------------------------------------------


def ease(x: float) -> float:
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def cover_fit(im: Image.Image, w: int, h: int, zoom: float) -> Image.Image:
    s = max(w / im.width, h / im.height) * zoom
    cw, ch = w / s, h / s
    x0, y0 = (im.width - cw) / 2, (im.height - ch) / 2
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


def fade(layer: Image.Image, alpha: float) -> Image.Image:
    layer = layer.copy()
    layer.putalpha(layer.getchannel("A").point(lambda a: int(a * alpha)))
    return layer


CHARCOAL, INK = (24, 25, 28), (22, 22, 22)


class Reel:
    """The calm charcoal look. Each story opens on its company's logo card, then its picture (toned down, slowly
    pushing in), a tilted source card with a highlighter, the other picture, and a number counting up inside a
    ring of dots, then an end card under the sign-off. Small subtitles sit in a dark pill. Cuts fall on word
    boundaries and a picture never follows itself."""

    PUSH = 0.045  # each picture pushes in this much over its shot, steadily
    FIRST_CARD, CARD = 1.7, 1.35  # seconds on the logo card: the opening one, then each later story's

    def __init__(self, script: dict[str, Any], stories: list[dict[str, Any]], timings: dict[str, Any],
                 folder: Path, date_label: str):
        self.script, self.date_label = script, date_label
        self.stories = {int(st["n"]): stories[int(st["n"]) - 1] for st in script["stories"]}
        self.words, self.audio_dur = timings["words"], timings["duration"]
        self.count = len(script["stories"])
        self.f = {
            "sub": font("Inter-SemiBold.ttf", 44),
            "credit": font("Inter-SemiBold.ttf", 24),
            "kick": font("Inter-SemiBold.ttf", 34),
            "name": font("Inter-Bold.ttf", 120),
            "pub": font("RobotoSerif-Display-700.ttf", 40),
            "date": font("Inter-SemiBold.ttf", 30),
            "card": font("RobotoSerif-Display-700.ttf", 54),
            "statlabel": font("Inter-SemiBold.ttf", 28),
            "mark": font("RobotoSerif-Display-700.ttf", 150),
        }
        self.img = {}
        for st in script["stories"]:
            for kind in ("hero", "detail"):
                im = Image.open(folder / f"picture-{st['n']}-{kind}.png").convert("RGB")
                self.img[(int(st["n"]), kind)] = ImageEnhance.Brightness(ImageEnhance.Color(im).enhance(0.55)).enhance(0.86)
        self.logos = {int(st["n"]): self._mark(st, folder) for st in script["stories"]}
        g = Image.new("L", (1, H))  # darken the top and bottom so text reads over any picture
        for y in range(H):
            top = 150 * max(0.0, 1 - y / 520) ** 1.6
            low = 175 * max(0.0, min(1.0, (y - 820) / 560)) ** 1.3
            g.putpixel((0, y), int(max(top, low)))
        self.grad = g.resize((W, H))
        self.black = Image.new("RGB", (W, H), (0, 0, 0))
        self.grid = Image.new("RGB", (W, H), CHARCOAL)
        d = ImageDraw.Draw(self.grid)
        for y in range(0, H, 54):
            for x in range(27, W, 54):
                d.ellipse((x - 1.5, y - 1.5, x + 1.5, y + 1.5), fill=(46, 47, 52))
        self.dur = self.audio_dur + 0.5
        self.groups = self._subtitle_groups()
        self.shots = self._shots()

    def _mark(self, st: dict[str, Any], folder: Path) -> Image.Image:
        """The story's logo (plain parts in white, colours kept), or its company's name (else label) in type."""
        path = folder / f"logo-{st['n']}.png"
        if path.exists():
            logo = Image.open(path).convert("RGBA")
            scale = min(600 / logo.width, 300 / logo.height)
            logo = logo.resize((max(1, int(logo.width * scale)), max(1, int(logo.height * scale))), Image.LANCZOS)
            return logo_mark(logo)
        name = st.get("company") or st.get("label") or ""
        f = self.f["name"]
        while f.getlength(name) > W - 160 and f.size > 60:
            f = font("Inter-Bold.ttf", f.size - 8)
        mark = Image.new("RGBA", (int(f.getlength(name)) + 8, 170), (0, 0, 0, 0))
        ImageDraw.Draw(mark).text((4, 85), name, font=f, anchor="lm", fill=(245, 245, 245, 255))
        return mark

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
        """Phrases of up to six words that fit on one line; split at commas, sentence ends and story changes."""
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

    def _shots(self) -> list[dict[str, Any]]:
        """Per story: logo card -> picture -> source card -> other picture -> number card, or, when the number
        comes early in the story, logo card -> picture -> number card -> source card -> other picture. Then an
        end card under the sign-off.

        The hook belongs to the first story. A number card always gets 1.4s to count up, running into the next
        story if it must. A picture held over 4.6s is split with the story's other picture, and a picture never
        follows itself.
        """
        shots: list[dict[str, Any]] = []

        def add(kind: str, t0: float, t1: float, n: int, i: int) -> None:
            if t1 - t0 > 0.05:
                shots.append({"kind": kind, "t0": t0, "t1": t1, "n": n, "i": i})

        carry = 0.0  # where the previous story's last shot ended
        for i, st in enumerate(self.script["stories"]):
            n, seg = int(st["n"]), f"s{i}"
            a, b = self.seg_span(seg)
            ws = self.seg_words(seg)
            if i == 0:
                a, ws = 0.0, self.seg_words("hook") + ws
            a = max(a, carry)
            b = max(b, a)
            card = min(self.FIRST_CARD if i == 0 else self.CARD, (b - a) * 0.4) if b - a >= 2.5 else 0.0
            stat = st.get("stat") or {}
            hit = self.find_word(seg, stat.get("word", "")) if _number(stat.get("value")) is not None else None
            if hit and card and hit["s"] - 0.2 < a + card:  # the number is said during the logo card
                card = max(0.8, hit["s"] - 0.2 - a) if hit["s"] - 0.2 - a >= 0.8 else card
            add("logo", a, a + card, n, i)
            t, used = a + card, []
            at = max(t, hit["s"] - 0.2) if hit else 0.0
            if hit and at - t < 2.8:  # an early number: its card comes before the source card
                if at - t > 0.8:
                    add("hero", t, at, n, i)
                    used.append("hero")
                else:
                    at = t
                t = max(min(b, hit["s"] + 2.4), at + 1.4)
                b = max(b, t)
                add("stat", at, t, n, i)
                if b - t >= 1.6:
                    card_end = b if b - (t + 2.8) < 0.8 else t + 2.8
                    add("receipt", t, card_end, n, i)
                    t = card_end
            else:
                starts = [w["s"] - 0.08 for k, w in enumerate(ws) if k and re.search(r"[.!?]$", ws[k - 1]["w"])]
                later = [x for x in starts if t + 1.6 <= x <= b - 2.0]
                card_at = later[0] if later else max(t + 1.4, min(b - 2.0, t + (b - t) * 0.35))
                if hit:
                    card_at = max(t + 1.4, min(card_at, at - 1.6))
                card_at = min(card_at, b)
                card_end = min(card_at + 2.8, b, at if hit else b)
                if card_end - card_at < 1.2:  # no room for the source card: the picture holds instead
                    card_at = card_end
                add("hero", t, card_at, n, i)
                used.append("hero")
                add("receipt", card_at, card_end, n, i)
                t = max(t, card_end)
                if hit:
                    if at - t > 0.8:
                        add("detail", t, at, n, i)
                        used.append("detail")
                    elif shots:
                        shots[-1]["t1"] = at
                    t = max(min(b, hit["s"] + 2.4), at + 1.4)
                    b = max(b, t)
                    add("stat", at, t, n, i)
            rest = "detail" if used == ["hero"] else "hero"
            if b - t > 0.8:
                add(rest, t, b, n, i)
            elif shots:
                shots[-1]["t1"] = max(shots[-1]["t1"], b)
            carry = max(b, shots[-1]["t1"] if shots else b)
        first = int(self.script["stories"][0]["n"]) if self.script["stories"] else next(iter(self.stories))
        spoken = [w["e"] for w in self.words if w["seg"] != "outro"]
        end_at = max(self.seg_span("outro")[0], carry, max(spoken) if spoken else 0.0)
        if shots:
            shots[-1]["t1"] = end_at
        self.dur = max(self.dur, end_at + 1.0)  # a late number card can't squeeze out the end card
        shots.append({"kind": "end", "t0": end_at, "t1": self.dur + 1.0, "n": first, "i": None})

        last: dict[int, str] = {}
        for k, shot in enumerate(shots):  # after a card, come back on the picture not just seen
            if shot["kind"] in ("hero", "detail"):
                if k and shots[k - 1]["kind"] not in ("hero", "detail") and last.get(shot["i"]) == shot["kind"]:
                    shot["kind"] = "detail" if shot["kind"] == "hero" else "hero"
                last[shot["i"]] = shot["kind"]
        word_starts = [w["s"] - 0.06 for w in self.words]
        split: list[dict[str, Any]] = []
        for k, shot in enumerate(shots):
            if shot["kind"] in ("hero", "detail") and shot["t1"] - shot["t0"] > 4.6 and word_starts:
                mid = min(word_starts, key=lambda x: abs(x - (shot["t0"] + shot["t1"]) / 2))
                other = "detail" if shot["kind"] == "hero" else "hero"
                following = shots[k + 1] if k + 1 < len(shots) else {}
                if shot["t0"] + 1.8 < mid < shot["t1"] - 1.5 and (following.get("kind"), following.get("n")) != (other, shot["n"]):
                    split += [dict(shot, t1=mid), dict(shot, kind=other, t0=mid)]
                    continue
            split.append(shot)
        out: list[dict[str, Any]] = []
        for shot in split:  # never the same picture twice in a row: hold the first one instead
            prev = out[-1] if out else None
            if prev and shot["kind"] in ("hero", "detail") and (prev["kind"], prev["n"]) == (shot["kind"], shot["n"]):
                prev["t1"] = shot["t1"]
                continue
            out.append(shot)
        return out

    def shot_at(self, t: float) -> dict[str, Any]:
        current = self.shots[0]
        for shot in self.shots:
            if t >= shot["t0"]:
                current = shot
        return current

    # ----- drawing ----------------------------------------------------------
    def picture(self, shot: dict[str, Any], t: float) -> Image.Image:
        local, dur = t - shot["t0"], max(shot["t1"] - shot["t0"], 1.0)
        im = cover_fit(self.img[(shot["n"], shot["kind"])], W, H, 1.0 + self.PUSH * min(1.0, local / dur))
        im = Image.composite(self.black, im, self.grad)
        ImageDraw.Draw(im).text((64, TOP_SAFE + 10), "Illustration", font=self.f["credit"], fill=(190, 190, 190))
        return im

    def logo_card(self, shot: dict[str, Any], local: float) -> Image.Image:
        """The company's logo (or name) rising in, a yellow rule drawing out under it, and where we are."""
        bg = self.grid.copy()
        mark = self.logos[shot["n"]]
        a = ease(local / 0.3)
        y = int(800 - mark.height / 2 + 30 * (1 - a))
        bg.paste(mark, ((W - mark.width) // 2, y), fade(mark, a))
        d = ImageDraw.Draw(bg)
        line = ease((local - 0.2) / 0.5)
        d.rectangle((W // 2 - 140 * line, y + mark.height + 60, W // 2 + 140 * line, y + mark.height + 66), fill=YELLOW)
        i = shot["i"]
        label = (f"Today on Trace  ·  {self.date_label}" if i == 0
                 else f"{i + 1} of {self.count}  ·  {self.script['stories'][i]['label']}")
        d.text((W // 2, y + mark.height + 130), label, font=self.f["kick"], anchor="mm", fill=(200, 200, 204))
        return bg

    def receipt(self, n: int, local: float) -> Image.Image:
        """Source card, slightly tilted: publisher, date and the headline, a highlighter over the key phrase."""
        st = next(s for s in self.script["stories"] if int(s["n"]) == n)
        story = self.stories[n]
        bg = self.grid.convert("RGBA")
        cw = W - 150
        lines = wrap(story["title"], self.f["card"], cw - 100)[:4]
        ch = 150 + len(lines) * 70 + 70
        card = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
        cd = ImageDraw.Draw(card)
        cd.rounded_rectangle((0, 0, cw, ch), 10, fill=(250, 249, 245, 255))
        source = str(story.get("source") or "")
        while cd.textlength(source, font=self.f["pub"]) > cw - 260 and len(source) > 4:
            source = source[:-2].rstrip() + "…"
        cd.text((50, 70), source, font=self.f["pub"], anchor="lm", fill=INK)
        cd.text((cw - 50, 70), self.date_label, font=self.f["date"], anchor="rm", fill=(120, 120, 120))
        cd.line((50, 118, cw - 50, 118), fill=(220, 218, 212), width=2)
        phrase = [w for w in re.findall(r"[\w$€£.,'-]+", (st.get("receipt_phrase") or "").lower().replace("’", "'"))
                  if len(w) > 2 or w.isdigit() or w in ("ai", "us", "uk", "eu")]
        sweep = ease((local - 0.4) / 0.5)
        y = 146
        for line in lines:
            low = line.lower().replace("’", "'")
            for word in phrase if sweep > 0 else []:
                found = re.search(rf"(?<![\w]){re.escape(word)}(?![\w])", low)
                j = found.start() if found else -1
                if j >= 0:
                    x = 50 + cd.textlength(line[:j], font=self.f["card"])
                    width = cd.textlength(line[j:j + len(word)], font=self.f["card"])
                    cd.rectangle((x - 4, y + 16, x + 4 + width * sweep, y + 66), fill=YELLOW)
            cd.text((50, y), line, font=self.f["card"], fill=INK)
            y += 70
        a = ease(local / 0.25)
        tilted = card.rotate(-1.6 + 0.5 * ease(local / 0.6), Image.BICUBIC, expand=True)
        shadow = Image.new("RGBA", tilted.size, (0, 0, 0, 0))
        shadow.putalpha(tilted.getchannel("A").point(lambda v: int(v * 0.55)))
        shadow = shadow.filter(ImageFilter.GaussianBlur(22))
        x0, y0 = (W - tilted.width) // 2, int(620 + 50 * (1 - a))
        bg.alpha_composite(fade(shadow, a), (x0, y0 + 24))
        bg.alpha_composite(fade(tilted, a), (x0, y0))
        return bg.convert("RGB")

    def stat(self, n: int, local: float) -> Image.Image:
        """The story's number counting up inside a ring of dots that lights up yellow as it counts."""
        st = next(s for s in self.script["stories"] if int(s["n"]) == n)["stat"]
        bg = self.grid.copy()
        d = ImageDraw.Draw(bg)
        p = ease(local / 1.1)
        cx, cy, total = W // 2, 790, 220
        for k in range(total):
            ring, angle = k % 4, (k // 4) / (total / 4) * 2 * math.pi - math.pi / 2
            r = 200 + ring * 28
            x, y = cx + r * math.cos(angle), cy + r * math.sin(angle)
            lit = k < int(total * p)
            rad = 6 if lit else 4
            d.ellipse((x - rad, y - rad, x + rad, y + rad), fill=YELLOW if lit else (60, 61, 66))
        raw = str(st["value"]).replace(",", "")
        value = _number(raw) or 0.0
        raw = raw[:-2] if raw.endswith(".0") else raw
        decimals = len(raw.split(".")[1]) if "." in raw else 0
        shown = value if abs(value) < 20 else value * p  # "$2 trillion" shouldn't count 0, 1, 2
        number = f"{st.get('prefix') or ''}{shown:,.{decimals}f}"
        size = 150
        while font("RobotoSerif-Display-700.ttf", size).getlength(number) > 340 and size > 60:
            size -= 6
        d.text((cx, cy - 20), number, font=font("RobotoSerif-Display-700.ttf", size), anchor="mm", fill=(250, 250, 250))
        if st.get("unit"):
            d.text((cx, cy + 70), str(st["unit"])[:22], font=self.f["kick"], anchor="mm", fill=YELLOW)
        label = str(st.get("label") or "")
        while self.f["statlabel"].getlength(label) > 330 and len(label) > 4:
            label = label[:-2].rstrip() + "…"
        d.text((cx, cy + (120 if st.get("unit") else 80)), label, font=self.f["statlabel"], anchor="mm", fill=(170, 170, 176))
        return bg

    def subtitle(self, im: Image.Image, t: float) -> None:
        """One line, sentence case, in a dark pill."""
        g = next((g for g in self.groups if self.words[g[0]]["s"] - 0.08 <= t <= self.words[g[-1]]["e"] + 0.25), None)
        if not g:
            return
        text = " ".join(self.words[i]["w"] for i in g)
        width = self.f["sub"].getlength(text)
        layer = Image.new("RGBA", (W, 120), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        d.rounded_rectangle(((W - width) / 2 - 22, 22, (W + width) / 2 + 22, 98), 10, fill=(10, 10, 12, 175))
        d.text((W / 2, 60), text, font=self.f["sub"], anchor="mm", fill=(245, 245, 245))
        im.paste(layer, (0, SUB_Y - 20), layer)

    def end_card(self, local: float) -> Image.Image:
        """Under the sign-off: the Trace wordmark and where to read every story."""
        bg = self.grid.copy()
        d = ImageDraw.Draw(bg)
        a = ease(local / 0.3)
        y = int(780 + 30 * (1 - a))
        shade = tuple(int(c + (245 - c) * a) for c in CHARCOAL)
        d.text((W // 2, y), "Trace", font=self.f["mark"], anchor="mm", fill=shade)
        line = ease((local - 0.2) / 0.5)
        d.rectangle((W // 2 - 140 * line, y + 110, W // 2 + 140 * line, y + 116), fill=YELLOW)
        d.text((W // 2, y + 180), "Every story in full at yourtrace.online", font=self.f["kick"], anchor="mm",
               fill=tuple(int(c + (200 - c) * a) for c in CHARCOAL))
        return bg

    def draw(self, shot: dict[str, Any], t: float) -> Image.Image:
        local = t - shot["t0"]
        if shot["kind"] == "end":
            return self.end_card(local)
        if shot["kind"] == "logo":
            return self.logo_card(shot, local)
        if shot["kind"] == "receipt":
            return self.receipt(shot["n"], local)
        if shot["kind"] == "stat":
            return self.stat(shot["n"], local)
        return self.picture(shot, t)

    def frame(self, t: float) -> Image.Image:
        shot = self.shot_at(t)
        im = self.draw(shot, t)
        idx = self.shots.index(shot)
        if idx and t - shot["t0"] < 0.2:  # a short dissolve so cuts don't flash
            im = Image.blend(self.draw(self.shots[idx - 1], t), im, ease((t - shot["t0"]) / 0.2))
        self.subtitle(im, t)
        return im


def render(script: dict[str, Any], stories: list[dict[str, Any]], timings: dict[str, Any], folder: Path,
           date_label: str) -> Path:
    """folder/reel.mp4 (H.264 + AAC, 30fps) and folder/cover.jpg (the opening logo card)."""
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
    reel.draw(reel.shots[0], 1.0).save(folder / "cover.jpg", "JPEG", quality=90)  # the opening card, no subtitle
    assert ffmpeg.stdin is not None
    for k in range(frames):
        ffmpeg.stdin.write(reel.frame(k / FPS).tobytes())
    ffmpeg.stdin.close()
    if ffmpeg.wait() != 0:
        raise RuntimeError("ffmpeg failed to encode the reel")
    _log(f"rendered {out} ({reel.dur:.1f}s, {len(reel.shots)} shots) in {time.time() - started:.0f}s")
    return out
