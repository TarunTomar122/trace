"""Daily X post for the founder: written on the server, finished on the laptop.

  cd backend
  ../.venv/bin/python -m v3.flows.build_post_kit --dry-run                      # today's post, image and videos in /tmp/trace-postkit; nothing written
  ../.venv/bin/python -m v3.flows.build_post_kit --dry-run --feed-json day.json # same, from a saved daily doc (no database at all)
  ../.venv/bin/python -m v3.flows.build_post_kit                                # write today's post (trace-postkit.timer, 07:30 UK)
  ../.venv/bin/python -m v3.flows.build_post_kit --json                         # the same, then print it with its image and videos for the laptop

The post opens "Biggest updates in tech in the last 24 hours:", has 3-6
short, plain lines ("- ..."), and ends "Did I miss anything??". The model picks the stories from the feed's last 24 hours
(today's and yesterday's topics, plus recent articles no topic covers yet), by
how interesting they are rather than how many outlets covered them. Every fact
and figure has to come from the stories, and the tone stays calm: a line with a
number its story never mentions, or with hype ("insane", "!"), is dropped.
Without the model the lines are the widest-covered stories' titles.
TRACE_KIT_X_MAX sets the length (360 by default: X Premium, but still short).

Nothing is emailed or posted. The founder's laptop runs
backend/laptop/trace_xpost.py the first time it wakes each morning: it calls
this with --json over SSH, downloads a short clip of the first story (YouTube
blocks the VPS, not a home connection), puts the post, the image and the clip
on one page, ~/x-posts/index.html, and shows a notification. Posts with a picture
or a video travel much further, so the image is the best one from the first
story's articles (a JPEG X accepts) and the videos are this week's YouTube
uploads about it: titles that name what the line says first, then short clips.

The post is written once per feed day and kept in `post_kits/{date}`, so the
07:30 run and the laptop get the same one (--fresh writes a new one; a
template post, written when the model failed, is retried on the next run). Every
run also copies the day's Tools and Top articles to the feed doc
(`featured_items`), so share pages keep working after the 3-hourly pulse
replaces the lists.
"""

from __future__ import annotations

import argparse
import base64
import contextlib
import fcntl
import io
import json
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeout
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable
from urllib.parse import urlencode, urljoin, urlsplit

import requests
from dotenv import load_dotenv

BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))
load_dotenv(BACKEND_ROOT.parent / ".env")

from v3.build_trending import _looks_promotional  # noqa: E402
from v3.flows.post_instagram import _clean, _similar  # noqa: E402
# The handle finder's guarded fetching: public hosts only, every redirect hop checked, a hard deadline.
from v3.lib.maker_handles import TIMEOUT, USER_AGENT, _public_http, _wall_clock  # noqa: E402
from v3.lib.store import TRENDING_POOL  # noqa: E402

MARKERS = "post_kits"
IST = timezone(timedelta(hours=5, minutes=30))

SITE_URL = "https://www.yourtrace.online"
REPLY_URL = f"{SITE_URL}/?utm_source=x&utm_medium=post"
REPLY_TEXT = f"I send the biggest tech stories every morning, free: {REPLY_URL}"
# One call a day, and picking what goes viral needs taste: a frontier model, not a mini one.
KIT_MODEL = os.getenv("TRACE_KIT_MODEL", "gpt-6.1-terra")
LOCK_FILE = BACKEND_ROOT.parent / ".postkit.lock"
SECTIONS = ("tools", "discussions")  # the pulse lists whose items get share pages
X_URL_LENGTH = 23  # X counts every link as 23 characters


def _env_int(name: str, default: int, low: int, high: int) -> int:
    try:
        value = int(os.getenv(name, "").strip() or default)
    except ValueError:
        value = default
    return max(low, min(high, value))


# X Premium allows long posts, but a short one reads better: room for a hook and 4-5 lines.
X_MAX = _env_int("TRACE_KIT_X_MAX", 360, 240, 25000)
MIN_BULLETS = 3
MAX_BULLETS = 6
BULLET_MAX = 75  # X characters, emoji included
MAX_CANDIDATES = 60  # feed topics
MAX_POOL = 100  # recent single articles the feed has not grouped (yet)
WINDOW = timedelta(hours=24)
# Fixed and plain: the founder found the model's own openers ("Tech just went completely off-script") overhyped.
DEFAULT_HOOK = "Biggest updates in tech in the last 24 hours:"
CLOSER = "Did I miss anything??"  # the founder's own sign-off: replies help the post travel
MODEL_ATTEMPTS = 3  # a template post is replaced on the next run, up to this many tries a day
# Fillers are cut from a bullet; a bullet with real hype words or "!" is dropped.
# Lowercase only, so names stay: "Just Eat", "Epic Games", "Wild Rift", "Chaos Computer Club".
FILLER = re.compile(r"\b(just|literally|actually|basically)\s+")
HYPE_WORDS = (r"insane|insanely|wild|unhinged|crazy|craziest|completely|totally|mind[- ]?blowing|game[- ]?chang\w*|"
              r"huge|shocking|off[- ]script|jaw[- ]?dropping|unbelievable|incredible|epic|bonkers|chaos|chaotic|"
              r"madness|breaking")
HYPE = re.compile(
    rf"!\s*$|!!|\b({HYPE_WORDS})\b|\b(WTF|OMG|LOL)\b"
    # Sentence case puts hype first ("Huge outage hits AWS"); a name goes on capitalised ("Epic Games").
    rf"|^(?i:{HYPE_WORDS})\b(?!\s+[A-Z])"
)
# Ordinary tech phrases that contain a hype word.
NOT_HYPE = re.compile(r"in the wild|breaking changes?|record[- ]breaking|chaos engineering", re.I)
# X turns "x.ai" or "Booking.com" into a link (and counts it as 23): the only link belongs in the reply.
BARE_DOMAIN = re.compile(r"\b[\w-]+\.(com|ai|io|net|org|co|dev|app|xyz|tv|gg|me|so|sh|news|tech)\b", re.I)
# Emoji, dashes or arrows the model puts in front of a line: the post adds its own "- ".
EMOJI = ("[0-9#*]\ufe0f?\u20e3|[\u00a9\u00ae\u200b\u200d\u203c\u2049\u2122\u2139\u2190-\u21ff\u2300-\u27bf"
         "\u2b00-\u2bff\ufe0f\U0001F000-\U0001FAFF\U000E0020-\U000E007F]")
LEADING = re.compile(f"^(?:{EMOJI}|[\\s\\-–—•·*>])+")
TRAILING = re.compile(f"(?:{EMOJI}|\\s)+$")

IMAGE_NAME = "x-post.jpg"
IMAGE_TRIES = 4
IMAGE_MAX_BYTES = 10 * 1024 * 1024
IMAGE_MIN_WIDTH = 600
IMAGE_MAX_SIDE = 2048
IMAGE_DEADLINE = 15  # seconds per image, redirects included
MAX_REDIRECTS = 3
VIDEO_RESULTS = 5  # the laptop tries them in order until one downloads
LOCK_WAIT = 600  # seconds: the laptop waits for a 07:30 run that is still writing
VIDEO_DEADLINE = 45
SHORT_CLIP = 240  # seconds: easy to post as is

NUMBER = re.compile(r"\d+(?:[.,]\d+)*")
# Spelled-out amounts are numbers too ("ten times faster", "two million tokens").
NUMBER_WORD = re.compile(
    r"\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|forty|fifty|hundreds?|"
    r"thousands?|millions?|billions?|trillions?|twice|double[sd]?|triple[sd]?|quadruple[sd]?|halve[sd]?)\b",
    re.I,
)


def _log(message: str) -> None:
    print(f"[{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')}] [postkit] {message}", flush=True)


def _clip(text: str, limit: int) -> str:
    return text if len(text) <= limit else text[: limit - 1].rstrip(" ,.;:") + "…"


def _int(value: Any) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def _x_weight(char: str) -> int:
    """X's weighting: Latin and common punctuation count 1, everything else (CJK, emoji) 2."""
    code = ord(char)
    return 1 if code <= 4351 or 8192 <= code <= 8205 or 8208 <= code <= 8223 or 8242 <= code <= 8247 else 2


ZWJ = "\u200d"
# Variation selectors and skin tones change how an emoji looks, not how long it is.
EMOJI_MODIFIER = re.compile("[\ufe0e\ufe0f\U0001f3fb-\U0001f3ff]")


def x_length(text: str) -> int:
    """Length as X counts it: every link is 23 characters, CJK and each emoji 2 ("🕵️‍♂️" is one emoji)."""
    text = EMOJI_MODIFIER.sub("", re.sub(r"https?://\S+", "x" * X_URL_LENGTH, text))
    total, joined = 0, False
    for char in text:
        if char == ZWJ:
            joined = True
            continue
        if not joined:
            total += _x_weight(char)
        joined = False
    return total


def _time(value: Any) -> datetime | None:
    try:
        parsed = datetime.fromisoformat(str(value or "").replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


# ---------------------------------------------------------------------------
# The day
# ---------------------------------------------------------------------------


def _pulse(doc: dict[str, Any]) -> dict[str, Any]:
    return ((doc.get("daily_pulse_roles") or {}).get("developer") or {}) if isinstance(doc, dict) else {}


def feed_today(now: datetime) -> str:
    """The feed's date for `now`: the pipeline dates its docs in IST."""
    return now.astimezone(IST).strftime("%Y-%m-%d")


def load_day(load_feed: Callable[[str], dict[str, Any]], now: datetime, date: str = "") -> tuple[str, dict[str, Any]]:
    """Today's feed doc (IST, like the pipeline) once the pulse has filled its lists.

    Until then (a new IST day starts at 18:30 UTC, before the next pulse)
    yesterday's full doc is the kit; a doc with stories but no lists is the
    last resort.
    """
    if date:
        return date, load_feed(date) or {}
    today = datetime.strptime(feed_today(now), "%Y-%m-%d").date()
    docs = [(day.isoformat(), load_feed(day.isoformat()) or {}) for day in (today, today - timedelta(days=1))]
    for key, doc in docs:
        if _pulse(doc).get("tools") or _pulse(doc).get("discussions"):
            return key, doc
    for key, doc in docs:
        if doc.get("trending_topics"):
            return key, doc
    return today.isoformat(), {}


def day_before(load_feed: Callable[[str], dict[str, Any]], date: str) -> dict[str, Any]:
    """The previous day's doc: an IST day starts at 18:30 UTC, so 24 hours spans two."""
    previous = (datetime.strptime(date, "%Y-%m-%d").date() - timedelta(days=1)).isoformat()
    try:
        return load_feed(previous) or {}
    except Exception as exc:
        _log(f"could not load {previous}'s feed, using one day: {exc}")
        return {}


def _web_link(url: str) -> bool:
    try:
        parts = urlsplit(url)
        return parts.scheme in {"http", "https"} and bool(parts.hostname)
    except ValueError:
        return False


def featured_items(doc: dict[str, Any]) -> list[dict[str, Any]]:
    """Today's Tools, then Top articles: copied to the feed doc so their share pages keep working."""
    pulse = _pulse(doc)
    items: list[dict[str, Any]] = []
    seen: set[str] = set()
    for section in SECTIONS:
        for raw in pulse.get(section) or []:
            if not isinstance(raw, dict):
                continue
            item_id = str(raw.get("id") or "").strip()
            title = _clean(raw.get("title"))
            url = str(raw.get("url") or "").strip()
            if not item_id or item_id in seen or not title or not _web_link(url):
                continue
            seen.add(item_id)
            summary = raw.get("summary") if isinstance(raw.get("summary"), dict) else {}
            items.append({
                "id": item_id,
                "section": section,
                "title": title,
                "url": url,
                "source": _clean(raw.get("source")),
                "signal": _clean(raw.get("signal")),
                "thumbnail": str(raw.get("thumbnail") or "").strip(),
                "summary": _clean((summary.get("short_article") or {}).get("body") or summary.get("body")),
            })
    return items


# ---------------------------------------------------------------------------
# Stories: everything in the last 24 hours
# ---------------------------------------------------------------------------


def _articles(topic: dict[str, Any]) -> list[dict[str, Any]]:
    return [a for a in topic.get("articles") or [] if isinstance(a, dict) and str(a.get("url") or "").startswith("http")]


def _source_name(article: dict[str, Any]) -> str:
    name = _clean(article.get("source_name") or article.get("source"))
    if name:
        return name
    return re.sub(r"^https?://(www\.)?", "", str(article.get("url") or "")).split("/")[0]


def _usable(topic: Any) -> bool:
    if not isinstance(topic, dict) or topic.get("jev_send_worthy") == 0:
        return False
    title = _clean(topic.get("title"))
    return bool(title and _articles(topic) and not _looks_promotional(title))


def _topic_time(topic: dict[str, Any]) -> datetime | None:
    """When the story last moved: its own stamps or its newest article."""
    stamps = [_time(topic.get("last_updated_at")), _time(topic.get("first_seen_at"))]
    stamps += [_time(a.get("published_date")) for a in _articles(topic)]
    stamps = [s for s in stamps if s]
    return max(stamps) if stamps else None


def _candidate(topic: dict[str, Any]) -> dict[str, Any]:
    articles = _articles(topic)
    domains = {re.sub(r"^https?://(www\.)?", "", str(a["url"])).split("/")[0].lower() for a in articles}
    sources: list[dict[str, str]] = []
    for article in articles:
        name = _source_name(article)
        if name and all(s["name"] != name for s in sources):
            sources.append({"name": name, "title": _clean(article.get("title")), "url": str(article["url"])})
    # The outlets' own headlines carry the surprise ("The Tesla Roadster flew, drove
    # upside down..."); the topic title is a flat summary of them.
    headlines: list[str] = []
    for source in sources:
        if source["title"] and source["title"] not in headlines:
            headlines.append(source["title"])
    images: list[str] = []
    image_sources: dict[str, str] = {}
    for url, source in [*((a.get("thumbnail"), _source_name(a)) for a in articles), (topic.get("thumbnail"), "")]:
        url = str(url or "").strip()
        if _web_link(url) and url not in images:
            images.append(url)
            image_sources[url] = source
    return {
        "topic_id": str(topic.get("id") or ""),
        "title": _clean(topic.get("title")),
        "summary": _clip(_clean(topic.get("summary")), 600),
        "key_points": [_clean(p) for p in topic.get("key_points") or [] if _clean(p)][:4],
        "headlines": headlines[:4],
        "url": str(articles[0]["url"]) if articles else "",
        "lead_source": sources[0]["name"] if sources else "",
        "sources": sources[:5],
        "source_count": max(_int(topic.get("source_count")), len(domains - {""})),
        "images": images,
        "image_sources": image_sources,
    }


def _pool_story(item: dict[str, Any]) -> dict[str, Any]:
    """A single article as a story: the feed sometimes keeps a stale version of a topic and
    drops the newest coverage (the Roadster's reveal, a day after "Tesla plans a reveal")."""
    title = _clean(item.get("title"))
    url = str(item.get("url") or "").strip()
    source = _clean(item.get("source_name")) or re.sub(r"^https?://(www\.)?", "", url).split("/")[0]
    image = str(item.get("og_image") or "").strip()
    return {
        "topic_id": "",
        "title": title,
        "summary": _clip(_clean(item.get("content")), 600),
        "key_points": [],
        "headlines": [title],
        "url": url,
        "lead_source": source,
        "sources": [{"name": source, "title": title, "url": url}],
        "source_count": 1,
        "images": [image] if _web_link(image) else [],
        "image_sources": {image: source} if _web_link(image) else {},
    }


def candidates(docs: list[dict[str, Any]], now: datetime, pool: list[dict[str, Any]] | None = None) -> list[dict[str, Any]]:
    """Every usable story from the last 24 hours, each event once: the feed's topics (newest
    doc first), then recent articles from the trending pool that no topic covers.

    "Now" is the newest story's time (never later than the clock), so a saved
    or older day still has its own 24 hours.
    """
    found: list[tuple[dict[str, Any], datetime | None, bool]] = []
    ids: set[str] = set()
    for i, doc in enumerate(docs):
        for topic in (doc or {}).get("trending_topics") or []:
            if not _usable(topic):
                continue
            topic_id = str(topic.get("id") or "")
            if topic_id and topic_id in ids:
                continue
            ids.add(topic_id)
            found.append((topic, _topic_time(topic), i == 0))
    articles = [(item, _time(item.get("published_date") or item.get("fetched_at"))) for item in pool or []
                if isinstance(item, dict) and _clean(item.get("title")) and _web_link(str(item.get("url") or ""))
                and not _looks_promotional(_clean(item.get("title")))]
    stamps = [when for _, when, _ in found if when] + [when for _, when in articles if when]
    reference = min(now, max(stamps)) if stamps else now
    picked: list[dict[str, Any]] = []
    for topic, when, newest_doc in found:
        # A story with no times at all only counts if it is in the newest doc.
        if (when and when < reference - WINDOW) or (not when and not newest_doc):
            continue
        story = _candidate(topic)
        if any(_similar(story["title"], other["title"]) for other in picked):
            continue
        picked.append(story)
        if len(picked) >= MAX_CANDIDATES:
            break
    covered = {source["url"] for story in picked for source in story["sources"]}
    extra: list[dict[str, Any]] = []
    for item, when in sorted(articles, key=lambda pair: pair[1] or reference, reverse=True):
        if not when or when < reference - WINDOW or str(item.get("url")) in covered:
            continue
        story = _pool_story(item)
        if any(_similar(story["title"], other["title"]) for other in picked + extra):
            continue
        extra.append(story)
        if len(extra) >= MAX_POOL:
            break
    return picked + extra


def load_pool(store: Any) -> list[dict[str, Any]]:
    """The trending pool's last two days ([] if it can't be read: the feed's topics still work)."""
    try:
        return store.load_pool(TRENDING_POOL, max_age_days=2)
    except Exception as exc:
        _log(f"could not read the trending pool, using the feed's topics only: {exc}")
        return []


# ---------------------------------------------------------------------------
# Writing: the model when it can, the stories' own titles when it can't
# ---------------------------------------------------------------------------

X_SYSTEM = (
    "You write X posts about tech news for the founder of Trace, a free daily tech and AI brief. "
    "Calm, plain and specific: the facts are interesting enough, so never hype them. "
    "Every fact must come from the stories you are given."
)

X_POST_PROMPT = """Pick the stories for one X post: the most interesting things that happened in tech in the last 24 hours. It opens with "Biggest updates in tech in the last 24 hours:", then one line per story (the post puts "- " in front), then "Did I miss anything??".

Picking: choose 4-5 stories (at least {low}, at most {high}) that people in tech would find genuinely surprising and want to share: things you can see (demos, launches, robots, vehicles, rockets), scientific firsts, records and striking numbers, notable failures and mishaps. Substance over drama: skip gossip, routine business news (funding rounds, earnings, hires), policy fine print, lawsuits that are only paperwork, and opinion pieces. How many outlets covered a story does not matter.

Writing each line:
- A plain, specific sentence of 5-12 words, under {bullet} characters: no emoji, no dash (the post adds "- "), no full stop at the end. Say what happened, with the concrete detail that makes it interesting, and let that detail do the work.
- Calm and factual, like a well-informed friend. No hype: no "insane", "wild", "crazy", "unhinged", "completely", "literally", "just", "huge", "shocking", "game-changer", no exclamation marks, no jokes about the industry.
- Good: "Tesla showed a Roadster that jumps and flips on thrusters", "Human brain tissue classified letters of the Braille alphabet", "Online ads delivered spyware to 45 Al Jazeera devices".
- Bad: "Tesla's Roadster LITERALLY flew", "Tech just went completely off-script", "Eight states sue OpenAI alleging ChatGPT harms kids and lies to parents about safety risks." (too long).
- Every fact, name and number must be in that story's text below. No numbers that are not there, and nothing stronger than what the story says.
- No hashtags, no links or web addresses (say "xAI", not "x.ai"), no @mentions, no questions.

Also:
- media_pick: the story people would most want to watch (a demo, a launch event, a robot, a car, a rocket); it must be marked [image]. It becomes the first line and gets a video clip, so a story with footage beats one without.
- video_query: a short YouTube search that finds a video of that story (company, product, event).
- All the lines together must fit in {limit} characters.

Stories (feed topics first, then single articles the feed has not grouped yet; a newer article can update an older topic):
{stories}"""

X_POST_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["bullets", "media_pick", "video_query"],
    "properties": {
        "bullets": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["pick", "text"],
                "properties": {"pick": {"type": "integer"}, "text": {"type": "string"}},
            },
        },
        "media_pick": {"type": "integer"},
        "video_query": {"type": "string"},
    },
}


def _chat_json(prompt: str, name: str, schema: dict[str, Any], system: str = X_SYSTEM) -> dict[str, Any] | None:
    """The model's JSON answer, or None (no key, bad key, timeout, bad JSON): callers use a template."""
    from v3.lib.summarizer import _get_client

    client = _get_client()
    if client is None:
        _log(f"{name}: OPENAI_API_KEY is not set; using the template")
        return None
    try:
        response = client.with_options(max_retries=1).chat.completions.create(
            model=KIT_MODEL,  # no temperature: the GPT-5 and 6 models only take the default
            timeout=240,  # a ~20k-token prompt for a reasoning model
            messages=[{"role": "system", "content": system}, {"role": "user", "content": prompt}],
            response_format={"type": "json_schema", "json_schema": {"name": name, "strict": True, "schema": schema}},
        )
        result = json.loads(response.choices[0].message.content or "{}")
        return result if isinstance(result, dict) else None
    except Exception as exc:
        # OpenAI echoes part of a bad key in its error: keep that out of the log.
        detail = re.sub(r"sk-[\w*-]+", "sk-…", str(exc))[:160]
        _log(f"{name}: model failed ({type(exc).__name__}: {detail}); using the template")
        return None


def _material(story: dict[str, Any]) -> str:
    return " ".join([story["title"], story["summary"], *story["key_points"], *story["headlines"]])


def invented_numbers(text: str, material: str) -> set[str]:
    """Numbers (digits or words) in `text` that the source material never mentions."""
    known = set(NUMBER.findall(material)) | {w.lower() for w in NUMBER_WORD.findall(material)}
    found = set(NUMBER.findall(text)) | {w.lower() for w in NUMBER_WORD.findall(text)}
    return found - known


def _breaks_rules(text: str) -> bool:
    """A hashtag, a link, a mention or a bare domain ("C#" and "HTTP/3" are fine)."""
    return bool(re.search(r"(^|\s)[#@]\w|https?://|www\.", text, re.I) or BARE_DOMAIN.search(text))


def _hype(text: str) -> str:
    match = HYPE.search(NOT_HYPE.sub("", text))
    return match.group(0) if match else ""


def _story_lines(stories: list[dict[str, Any]]) -> str:
    lines = []
    for i, story in enumerate(stories):
        image = "[image] " if story["images"] else ""
        outlets = f"{story['source_count']} outlet{'s' if story['source_count'] != 1 else ''}"
        lines.append(f"[{i}] {image}{outlets} · {story['title']}")
        if story["headlines"] and story["headlines"] != [story["title"]]:
            lines.append(f"    Headlines: {' | '.join(story['headlines'])}")
        if story["summary"]:
            # A single article's opening is enough to judge it; topics get their whole summary.
            lines.append(f"    {'Summary' if story['topic_id'] else 'Text'}: "
                         f"{_clip(story['summary'], 360 if story['topic_id'] else 220)}")
        if story["key_points"]:
            lines.append(f"    Key points: {' | '.join(story['key_points'][:2])}")
    return "\n".join(lines)


def _assemble(hook: str, bullets: list[dict[str, Any]]) -> str:
    return f"{hook}\n\n" + "\n".join(f"- {b['text']}" for b in bullets) + f"\n\n{CLOSER}"


def _line_budget(limit: int) -> int:
    """What the model may spend on its lines: the limit less the opener, sign-off and dashes."""
    return limit - x_length(_assemble(DEFAULT_HOOK, [])) - 3 * MAX_BULLETS


def _lead_with_image(bullets: list[dict[str, Any]], stories: list[dict[str, Any]], pick: int = -1) -> list[dict[str, Any]]:
    """The story with the picture goes first: the model's choice if it has one, else the first that does."""
    with_image = [b for b in bullets if stories[b["pick"]]["images"]]
    lead = next((b for b in with_image if b["pick"] == pick), with_image[0] if with_image else None)
    return [lead, *(b for b in bullets if b is not lead)] if lead else bullets


def _fit(hook: str, bullets: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    """Drop bullets from the end (never the lead) until the post fits."""
    bullets = list(bullets)
    while len(bullets) > MIN_BULLETS and x_length(_assemble(hook, bullets)) > limit:
        bullets.pop()
    return bullets


def template_post(stories: list[dict[str, Any]], limit: int = X_MAX) -> dict[str, Any] | None:
    """The widest-covered stories' own titles, for when the model can't help."""
    if not stories:
        return None
    order = sorted(range(len(stories)), key=lambda i: (-stories[i]["source_count"], i))
    usable = [i for i in order if not _breaks_rules(stories[i]["title"]) and not _hype(stories[i]["title"])]
    bullets = [{"pick": i, "text": _clip(stories[i]["title"], BULLET_MAX)} for i in (usable or order)[:MAX_BULLETS]]
    bullets = _fit(DEFAULT_HOOK, _lead_with_image(bullets, stories), limit)
    while bullets and x_length(_assemble(DEFAULT_HOOK, bullets)) > limit:
        bullets.pop()
    lead = stories[bullets[0]["pick"]] if bullets else stories[order[0]]
    return _post(DEFAULT_HOOK, bullets, stories, lead["title"], "template")


def _post(hook: str, bullets: list[dict[str, Any]], stories: list[dict[str, Any]], video_query: str,
          written_by: str) -> dict[str, Any]:
    text = _assemble(hook, bullets)
    picked = [{"text": b["text"], "story": stories[b["pick"]]} for b in bullets]
    return {"text": text, "length": x_length(text), "hook": hook, "bullets": picked,
            "lead": picked[0]["story"] if picked else None, "video_query": video_query, "written_by": written_by}


def write_x_post(stories: list[dict[str, Any]], limit: int = X_MAX) -> dict[str, Any] | None:
    """The model's post if it follows the rules (bullet by bullet); the template otherwise."""
    if not stories:
        return None
    result = _chat_json(
        X_POST_PROMPT.format(low=MIN_BULLETS, high=MAX_BULLETS, bullet=BULLET_MAX, limit=_line_budget(limit),
                             stories=_story_lines(stories)),
        "x_post",
        X_POST_SCHEMA,
    )
    if not result:
        return template_post(stories, limit)
    bullets: list[dict[str, Any]] = []
    for raw in result.get("bullets") or []:
        if not isinstance(raw, dict):
            continue
        text = TRAILING.sub("", LEADING.sub("", _clean(raw.get("text")))).rstrip(" .")
        pick, text = _int(raw.get("pick")), _clean(FILLER.sub("", text))
        if not 0 <= pick < len(stories) or any(b["pick"] == pick for b in bullets) or not text:
            continue
        # A bullet with a figure its story never mentions is dropped: no made-up numbers.
        bad = invented_numbers(text, _material(stories[pick]))
        hype = _hype(text)
        if bad or hype or _breaks_rules(text) or not 8 <= x_length(text) <= BULLET_MAX:
            why = f"numbers {', '.join(sorted(bad))}" if bad else f"hype {hype!r}" if hype else "rules"
            _log(f"x_post: dropped a bullet ({why}): {text!r}")
            continue
        bullets.append({"pick": pick, "text": text})
    hook = DEFAULT_HOOK
    bullets = _fit(hook, _lead_with_image(bullets[:MAX_BULLETS], stories, _int(result.get("media_pick"))), limit)
    if len(bullets) < MIN_BULLETS or x_length(_assemble(hook, bullets)) > limit:
        _log(f"x_post: {len(bullets)} usable bullet(s) or too long; using the template")
        return template_post(stories, limit)
    media_pick = _int(result.get("media_pick"))
    lead = stories[bullets[0]["pick"]]
    # The model's search is for its own pick: if that line was dropped, search for the line that leads.
    query = _clip(_clean(result.get("video_query")), 100) if bullets[0]["pick"] == media_pick else ""
    return _post(hook, bullets, stories, query or _clip(lead["title"], 100), "model")


# ---------------------------------------------------------------------------
# Media: an image to attach, videos to consider
# ---------------------------------------------------------------------------


def fetch_bytes(url: str, max_bytes: int = IMAGE_MAX_BYTES, session: Any = requests) -> bytes | None:
    """The body at `url` (up to `max_bytes`), or None: public hosts only, each redirect hop checked."""
    deadline = time.monotonic() + IMAGE_DEADLINE
    try:
        with _wall_clock(IMAGE_DEADLINE):
            for _hop in range(MAX_REDIRECTS + 1):
                if not _public_http(url) or time.monotonic() > deadline:
                    return None
                with session.get(url, timeout=TIMEOUT, headers={"User-Agent": USER_AGENT}, stream=True,
                                 allow_redirects=False) as response:
                    if response.status_code in {301, 302, 303, 307, 308}:
                        url = urljoin(url, str(response.headers.get("location") or ""))
                        continue
                    if response.status_code != 200 or _int(response.headers.get("content-length")) > max_bytes:
                        return None
                    data = b""
                    for chunk in response.iter_content(64 * 1024):
                        data += chunk
                        if len(data) > max_bytes or time.monotonic() > deadline:
                            return None
                    return data
    except Exception:  # the deadline included
        return None
    return None  # too many redirects


def pick_image(urls: list[str], fetch: Callable[[str], bytes | None] = fetch_bytes) -> dict[str, Any] | None:
    """The biggest usable picture among the first few, as a JPEG X accepts (AVIF and WebP converted)."""
    from PIL import Image

    best = None
    for url in urls[:IMAGE_TRIES]:
        data = fetch(url)
        if not data:
            continue
        try:
            image = Image.open(io.BytesIO(data))
            image.load()
        except Exception:  # not an image, truncated, a decompression bomb
            continue
        if image.width < IMAGE_MIN_WIDTH:
            continue
        if best is None or image.width * image.height > best[0].width * best[0].height:
            best = (image, url)
    if best is None:
        return None
    image, url = best
    if image.mode in {"RGBA", "LA", "P"}:
        image = image.convert("RGBA")
        backed = Image.new("RGB", image.size, (255, 255, 255))
        backed.paste(image, mask=image.getchannel("A"))
        image = backed
    image = image.convert("RGB")
    image.thumbnail((IMAGE_MAX_SIDE, IMAGE_MAX_SIDE))
    buffer = io.BytesIO()
    image.save(buffer, "JPEG", quality=90, optimize=True, progressive=True)
    return {"name": IMAGE_NAME, "bytes": buffer.getvalue(), "source_url": url, "size": image.size}


def _youtube_search(query: str) -> list[dict[str, Any]]:
    import yt_dlp

    # Uploaded this week, in YouTube's relevance order: last year's launch videos stay out.
    url = "https://www.youtube.com/results?" + urlencode({"search_query": query, "sp": "EgIIAw=="})
    options = {"quiet": True, "no_warnings": True, "skip_download": True, "extract_flat": True,
               "playlistend": 12, "socket_timeout": 15}
    with yt_dlp.YoutubeDL(options) as ydl:
        info = ydl.extract_info(url, download=False) or {}
    return [e for e in info.get("entries") or [] if isinstance(e, dict)]


def _words(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9]+", text.lower()) if len(w) >= 3}


def _stem(word: str) -> str:
    return word[:-1] if len(word) > 4 and word.endswith("s") else word


def rank_videos(entries: list[dict[str, Any]], story: dict[str, Any], line: str = "",
                limit: int = VIDEO_RESULTS) -> list[dict[str, Any]]:
    """The videos most likely to show what the post says: matching titles, short clips, then views.

    A title that names what happened ("riding walls and doing backflips") beats
    the company's own polished ad: words every title shares (the brand, the
    product) count for nothing, and "flips" matches "backflips".
    """
    videos = []
    for entry in entries:
        link = str(entry.get("url") or "")
        if not link.startswith(("https://www.youtube.com/watch?v=", "https://www.youtube.com/shorts/")):
            continue  # channels and playlists come back from search too
        channel = _clean(entry.get("channel") or entry.get("uploader"))
        videos.append({
            "title": _clean(entry.get("title")),
            "channel": channel,
            "duration": _int(entry.get("duration")),
            "views": _int(entry.get("view_count")),
            "url": link,
            "official": bool(_words(channel)) and _words(channel) <= _words(" ".join([story["title"], *story["headlines"]])),
        })
    story_words = {_stem(w) for w in _words(" ".join([line, story["title"], *story["headlines"]])) if len(w) >= 4}
    titles = [v["title"].lower() for v in videos]
    shared = {w for w in story_words if len(titles) >= 3 and sum(w in t for t in titles) >= len(titles) * 0.8}
    for video, title in zip(videos, titles):
        video["match"] = sum(1 for w in story_words - shared if w in title)
    # Any match first; then short clips, which news desks cut down to the moment itself.
    videos.sort(key=lambda v: (not v["match"], not 0 < v["duration"] <= SHORT_CLIP, -v["match"], not v["official"],
                               -v["views"]))
    return videos[:limit]


def find_videos(query: str, story: dict[str, Any], search: Callable[[str], list[dict[str, Any]]] = _youtube_search,
                deadline: float = VIDEO_DEADLINE, line: str = "") -> list[dict[str, Any]]:
    """Up to VIDEO_RESULTS YouTube videos of the lead story; [] when search is slow or unavailable."""
    if not query:
        return []
    pool = ThreadPoolExecutor(max_workers=1)
    try:
        return rank_videos(pool.submit(search, query).result(timeout=deadline), story, line)
    except FutureTimeout:
        _log(f"video search took over {deadline}s; no videos today")
    except Exception as exc:  # yt-dlp missing, YouTube blocking the server, a changed page
        _log(f"video search failed ({type(exc).__name__}: {str(exc)[:120]}); no videos today")
    finally:
        pool.shutdown(wait=False)
    return []


# ---------------------------------------------------------------------------
# The kit
# ---------------------------------------------------------------------------


def _image_for(post: dict[str, Any] | None) -> dict[str, Any] | None:
    if not post or not post["lead"]:
        return None
    try:
        return pick_image(post["lead"]["images"])
    except Exception as exc:
        _log(f"image failed, going on without one: {exc}")
        return None


def build_kit(date: str, doc: dict[str, Any], now: datetime, earlier: dict[str, Any] | None = None, *,
              pool: list[dict[str, Any]] | None = None, stored: dict[str, Any] | None = None,
              with_media: bool = True) -> dict[str, Any]:
    """Each part is built on its own: a failed image or video search never costs the day's post.

    `stored` is the day's post_kits doc: a post already written today is kept,
    so the model is asked once per day.
    """
    stories = _int((stored or {}).get("stories"))
    post = (stored or {}).get("post")  # a model post written earlier today
    if not post:
        try:
            found = candidates([doc, earlier or {}], now, pool)
            stories = len(found)
            post = write_x_post(found)
        except Exception as exc:
            _log(f"post failed: {exc}")
    image = _image_for(post) if with_media else None
    videos = (find_videos(post["video_query"], post["lead"], line=post["bullets"][0]["text"])
              if with_media and post and post["lead"] else [])
    # The featured items are always kept: share pages need them.
    featured: list[dict[str, Any]] = []
    try:
        featured = featured_items(doc)
    except Exception as exc:
        _log(f"featured items failed: {exc}")
    return {"date": date, "today": feed_today(now), "post": post, "image": image, "videos": videos,
            "featured": featured, "stories": stories}


def kit_json(kit: dict[str, Any]) -> dict[str, Any]:
    """What the laptop needs, as JSON: the post, the reply, the image (base64) and the videos to try."""
    image = kit["image"]
    lead = (kit["post"] or {}).get("lead") or {}
    return {
        "date": kit["date"],
        "post": kit["post"],
        "reply": REPLY_TEXT,
        "image": {"name": image["name"], "size": list(image["size"]),
                  "from": (lead.get("image_sources") or {}).get(image["source_url"]) or lead.get("lead_source") or "",
                  "base64": base64.b64encode(image["bytes"]).decode()} if image else None,
        "limit": X_MAX,
        # A template post is retried by the next run: the laptop waits for a final one.
        "final": bool(kit["post"]) and (kit["post"]["written_by"] == "model" or kit.get("final", False)),
        "videos": kit["videos"],
        "stories": kit["stories"],
    }


def save_featured(store: Any, date: str, doc: dict[str, Any], items: list[dict[str, Any]], now: datetime) -> None:
    """Copy today's featured items onto the feed doc, so share pages outlive the pulse's refreshes."""
    kept: dict[str, dict[str, Any]] = {
        str(item["id"]): item for item in doc.get("featured_items") or [] if isinstance(item, dict) and item.get("id")
    }
    for featured in items:
        kept[featured["id"]] = {
            "id": featured["id"],
            "section": featured["section"],
            "title": featured["title"],
            "url": featured["url"],
            "source": featured["source"],
            "signal": featured["signal"],
            "thumbnail": featured["thumbnail"],
            "summary": {"body": featured["summary"]},
            "featured_at": kept.get(featured["id"], {}).get("featured_at") or now.isoformat(),
        }
    (store.db.collection("v3_user_feeds").document("_global").collection("daily").document(date)
     .set({"featured_items": list(kept.values())}, merge=True))


@contextlib.contextmanager
def _locked(path: Path, wait: float = LOCK_WAIT):
    """One writer at a time: the laptop waits for a 07:30 run that is still asking the model."""
    with open(path, "a") as lock:
        deadline = time.monotonic() + wait
        while True:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except BlockingIOError:
                if time.monotonic() > deadline:
                    raise TimeoutError(f"another run held {path} for {wait:.0f}s")
                time.sleep(2)
        yield


def _summary(kit: dict[str, Any]) -> list[str]:
    post = kit["post"]
    lines = [f"post for {kit['date']} from {kit['stories']} stories in the last 24 hours"]
    if post:
        lines.append(f"  written by the {post['written_by']}, {post['length']}/{X_MAX} characters")
        lines += [f"    {line}" for line in post["text"].splitlines()]
    else:
        lines.append("  no post: no stories in the last 24 hours")
    image = kit["image"]
    if image:
        lines.append(f"  image: {image['size'][0]}x{image['size'][1]} from {image['source_url']}")
    lines += [f"  video: {v['channel']} · {v['duration']}s · {v['url']}" for v in kit["videos"]]
    lines.append(f"  featured items kept for share pages: {len(kit['featured'])}")
    return lines


def _emit(kit: dict[str, Any], as_json: bool) -> None:
    for line in _summary(kit):
        _log(line)
    if as_json:
        # The laptop reads the one line that starts with this; the log lines above are for people.
        print("POSTKIT_JSON " + json.dumps(kit_json(kit), ensure_ascii=False), flush=True)


def stored_post(marker: dict[str, Any]) -> dict[str, Any] | None:
    """Today's post if it is final: written by the model, or the template after MODEL_ATTEMPTS tries."""
    try:
        post = json.loads(marker.get("post_json") or "null")
    except (TypeError, ValueError):
        return None
    if not isinstance(post, dict) or not post.get("text"):
        return None
    final = post.get("written_by") == "model" or _int(marker.get("attempts")) >= MODEL_ATTEMPTS
    return post if final else None


def _write(store: Any, args: argparse.Namespace, now: datetime) -> int:
    date, doc = load_day(store.load_global_feed, now, args.date or "")
    if not doc:
        _log(f"no feed for {date} yet; nothing to write")
        return 1
    if getattr(args, "day", None) and date != args.day:
        # The laptop asks for its own day: before the pulse fills today, or after India's day
        # turns over in the evening, there is nothing to write for it (and nothing is written).
        _log(f"the feed is on {date}, not {args.day}; nothing to write yet")
        if args.json:
            print("POSTKIT_JSON " + json.dumps({"date": date, "post": None, "final": False}), flush=True)
        return 1
    with _locked(getattr(args, "lock", None) or LOCK_FILE):
        ref = store.db.collection(MARKERS).document(date)
        snap = ref.get()
        marker = (snap.to_dict() or {}) if snap.exists else {}
        earlier_post = stored_post(marker)
        kept = None if args.fresh else earlier_post
        # An older day's own 24 hours: today's pool articles would push its stories out of the window.
        pool = None if kept or args.date else load_pool(store)
        kit = build_kit(date, doc, now, day_before(store.load_global_feed, date), pool=pool,
                        stored={"post": kept, "stories": marker.get("stories")} if kept else None, with_media=args.json)
        if args.fresh and kit["post"] and kit["post"]["written_by"] != "model" and earlier_post \
                and earlier_post.get("written_by") == "model":
            _log("--fresh: the model failed, so today's earlier post stays")
            kit = {**kit, "post": earlier_post}
            kept = earlier_post
        # Email-era docs (the old kit) counted sends in "attempts": only this job's tries count.
        attempts = (_int(marker.get("attempts")) if marker.get("post_json") else 0) + (0 if kept else 1)
        kit["final"] = attempts >= MODEL_ATTEMPTS
        try:
            save_featured(store, date, doc, kit["featured"], now)
        except Exception as exc:
            _log(f"could not keep the featured items: {exc}")
        if kit["post"] and not kept:
            try:
                ref.set({"date": date, "post_json": json.dumps(kit["post"], ensure_ascii=False),
                         "stories": kit["stories"], "attempts": attempts, "written_at": now.isoformat()}, merge=True)
            except Exception as exc:  # the laptop still gets today's post; a later run writes another
                _log(f"could not keep today's post: {exc}")
    _emit(kit, args.json)
    return 0 if kit["post"] else 1


def _dry_run(args: argparse.Namespace, now: datetime, store: Any = None) -> int:
    if args.feed_json:
        saved = json.loads(Path(args.feed_json).read_text())
        date, doc = load_day(lambda _date: saved, now, args.date or "")
        earlier: dict[str, Any] = {}
        pool: list[dict[str, Any]] = []
    else:
        store = store or _store()
        date, doc = load_day(store.load_global_feed, now, args.date or "")
        earlier = day_before(store.load_global_feed, date) if doc else {}
        pool = load_pool(store) if doc and not args.date else []
    if not doc:
        _log(f"no feed for {date}; nothing to preview")
        return 1
    kit = build_kit(date, doc, now, earlier, pool=pool)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    data = kit_json(kit)
    if kit["image"]:
        (out / kit["image"]["name"]).write_bytes(kit["image"]["bytes"])
        data["image"].pop("base64")
    (out / "post.txt").write_text(f"{kit['post']['text']}\n\n---\n{REPLY_TEXT}\n" if kit["post"] else "No post today.\n")
    (out / "kit.json").write_text(json.dumps(data, indent=2, ensure_ascii=False))
    _emit(kit, args.json)
    _log(f"[dry-run] preview in {out}; nothing written to the database")
    return 0


def _store() -> Any:
    from v3.lib.store import V3Store

    return V3Store()


def run(args: argparse.Namespace, now: datetime | None = None, store: Any = None) -> int:
    now = now or datetime.now(timezone.utc)
    if args.dry_run:
        return _dry_run(args, now, store)
    return _write(store or _store(), args, now)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true", help="write a preview to --out; nothing written to the database")
    parser.add_argument("--out", default="/tmp/trace-postkit", help="where --dry-run writes the post, the image and kit.json")
    parser.add_argument("--feed-json", help="with --dry-run: read the day's feed doc from this JSON file, not the database")
    parser.add_argument("--date", help="feed date (YYYY-MM-DD); default today in IST, else yesterday")
    parser.add_argument("--json", action="store_true", help="also fetch the image and videos and print them as JSON")
    parser.add_argument("--fresh", action="store_true", help="write a new post even if today's is already written")
    parser.add_argument("--day", help="only for this feed day (YYYY-MM-DD): the laptop's own date")
    parser.add_argument("--lock", help=argparse.SUPPRESS)
    args = parser.parse_args()
    if args.feed_json and not args.dry_run:
        parser.error("--feed-json only works with --dry-run")
    for name in ("date", "day"):
        if getattr(args, name):
            try:
                datetime.strptime(getattr(args, name), "%Y-%m-%d")
            except ValueError:
                parser.error(f"--{name} must be a real date, YYYY-MM-DD")
    sys.exit(run(args))


if __name__ == "__main__":
    main()
