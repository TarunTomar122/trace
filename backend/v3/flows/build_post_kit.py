"""Daily post kit: one email to the founder with everything ready to post.

  cd backend
  ../.venv/bin/python -m v3.flows.build_post_kit --dry-run                      # preview files in /tmp/trace-postkit; no email, no writes
  ../.venv/bin/python -m v3.flows.build_post_kit --dry-run --feed-json day.json # same, from a saved daily doc (no database at all)
  ../.venv/bin/python -m v3.flows.build_post_kit --test-to you@example.com      # one copy to this address only
  ../.venv/bin/python -m v3.flows.build_post_kit                                # send today's kit to TRACE_KIT_TO

trace-postkit.timer runs it at 07:30 Europe/London, after the morning pulse.
The kit has three parts:

- Release day: today's biggest AI model or product release (at least
  MIN_SOURCES outlets covering it; a second one only if it is nearly as big),
  drafted as a long-form X article with a 1600x900 cover attached. The model
  writes the draft; if it can't (no key, bad key, bad output) the draft is
  built from the story's own summary and key points.
- A ready-to-post X post for the day's top story.
- Featured makers: everything in today's Tools and Top articles, with its
  share page (/featured/{date}/{id}), any X handles found for the people
  behind it (v3/lib/maker_handles.py) and a short line to send them.

One kit per day: `post_kits/{date}` is written before the email goes out and
a kit that is sending or sent is never sent again (a failed send is retried,
up to MAX_ATTEMPTS). The job takes ~/trace/.postkit.lock itself. Before
sending, the featured items are copied to the day's feed doc
(`featured_items`), so share pages keep working after the 3-hourly pulse
replaces the lists. Without TRACE_KIT_TO a live run does nothing.
"""

from __future__ import annotations

import argparse
import fcntl
import html
import io
import json
import os
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable
from urllib.parse import quote, urlsplit

from dotenv import load_dotenv

BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))
load_dotenv(BACKEND_ROOT.parent / ".env")

from v3.build_trending import _looks_like_model_release, _looks_promotional  # noqa: E402
from v3.flows.post_instagram import _clean, _similar  # noqa: E402
from v3.flows.send_audience_newsletter import _paragraphs  # noqa: E402  (the feed's paragraph split)
from v3.lib.article_cover import headline_font_name, render_cover  # noqa: E402
from v3.lib.maker_handles import HandleFinder, github_repo  # noqa: E402

BUCKET = "post_kit"
MARKERS = "post_kits"
MAX_ATTEMPTS = 3
IST = timezone(timedelta(hours=5, minutes=30))
# Share pages and links in posts always use the canonical site, whatever TRACE_APP_URL says.
SITE_URL = "https://www.yourtrace.online"
CTA_URL = f"{SITE_URL}/subscribe?utm_source=x&utm_medium=article"
KIT_MODEL = os.getenv("TRACE_KIT_MODEL", "gpt-4.1-mini")
LOCK_FILE = BACKEND_ROOT.parent / ".postkit.lock"
FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
SECTIONS = (("tools", "Tools"), ("discussions", "Top articles"))
# How the suggested line names each list.
LIST_NAMES = {"tools": "Tools picks", "discussions": "Top articles"}
HN_SOURCES = {"hacker news", "show hn"}
# Handle lookups stop after this long; the rest are tried tomorrow.
LOOKUP_BUDGET_SECONDS = 240
X_URL_LENGTH = 23  # X counts every link as 23 characters
X_MAX = 280
POST_LINK_LEAD = "\n\nMore in the free daily brief: "
# The post's own text: what is left of 280 after the line with the link.
POST_MAX_CHARS = X_MAX - len(POST_LINK_LEAD) - X_URL_LENGTH


def _env_int(name: str, default: int, low: int, high: int) -> int:
    try:
        value = int(os.getenv(name, "").strip() or default)
    except ValueError:
        value = default
    return max(low, min(high, value))


# A release needs this many outlets covering it to be worth an article.
MIN_SOURCES = _env_int("TRACE_KIT_MIN_SOURCES", 3, 1, 20)
MAX_DRAFTS = 2

LAUNCH_VERB = re.compile(
    r"\b(launch(?:es|ed)?|releas(?:es|ed)|unveil(?:s|ed)?|ship(?:s|ped)?|introduc(?:es|ed)|"
    r"rolls? out|rolled out|debuts?|debuted)\b",
    re.I,
)
NOT_A_LAUNCH = re.compile(
    r"\b(cancel\w*|delay\w*|halt\w*|scrap\w*|abandon\w*|postpon\w*|lawsuits?|sued|sues|probes?|bans?|banned|"
    r"leak\w*|outages?|recall\w*|funds?|funding|raises?|raised|ipo|nasdaq|nyse|shares|stocks?|valuation|"
    r"bids?|acquir\w*|acquisition|invest\w*|prices?|report|reports|plans? to|"
    r"(?:delay\w*|postpon\w*|pause\w*)\s+(?:\w+\s+){0,4}(?:before|ahead of))\b",
    re.I,
)
# A product launch names the thing launched: a release name or a product noun.
PRODUCT_NOUN = re.compile(
    r"\b(apps?|models?|agents?|assistants?|apis?|sdks?|tools?|features?|browsers?|chatbots?|platforms?|"
    r"plugins?|extensions?|editors?|ides?|cli|copilot|chatgpt|gemini|claude|codex|llama|grok|deepseek|qwen|"
    r"mistral|sora|veo|cursor|devin)\b",
    re.I,
)
# "<verb> Qwen3.8", "<verb> GPT-5", "<verb> Claude Opus 5": the release's own name.
NAMED_LAUNCH = re.compile(
    r"\b(?:releases?|released|launch(?:es|ed)?|unveils?|unveiled|ships?|shipped|introduces?|introduced|"
    r"debuts?|rolls out)\s+(?:its\s+|new\s+)?"
    r"((?:[A-Z][\w.-]*\d[\w.-]*|(?:[A-Z][\w.-]*\s+){1,3}\d+(?:\.\d+)?)"
    r"(?:\s+(?:Pro|Mini|Flash|Ultra|Max|Turbo|Nano|Lite|Sonnet|Opus|Haiku))?)"
)
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


def _date_label(date: str, style: str = "long") -> str:
    day = datetime.strptime(date, "%Y-%m-%d")
    return f"{day:%B} {day.day}" if style == "long" else f"{day:%b} {day.day}"


def _x_weight(char: str) -> int:
    """X's weighting: Latin and common punctuation count 1, everything else (CJK, emoji) 2."""
    code = ord(char)
    return 1 if code <= 4351 or 8192 <= code <= 8205 or 8208 <= code <= 8223 or 8242 <= code <= 8247 else 2


def x_length(text: str) -> int:
    """Length as X counts it: every link is 23 characters, CJK and emoji 2 each."""
    return sum(_x_weight(c) for c in re.sub(r"https?://\S+", "x" * X_URL_LENGTH, text))


def _intent(text: str) -> str:
    return f"https://x.com/intent/tweet?text={quote(text, safe='')}"


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


def _web_link(url: str) -> bool:
    try:
        parts = urlsplit(url)
        return parts.scheme in {"http", "https"} and bool(parts.hostname)
    except ValueError:
        return False


def featured_items(doc: dict[str, Any], date: str) -> list[dict[str, Any]]:
    """Today's Tools, then Top articles, each with its share page."""
    pulse = _pulse(doc)
    items: list[dict[str, Any]] = []
    seen: set[str] = set()
    for section, label in SECTIONS:
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
                "label": label,
                "title": title,
                "url": url,
                "source": _clean(raw.get("source")),
                "signal": _clean(raw.get("signal")),
                "thumbnail": str(raw.get("thumbnail") or "").strip(),
                "summary": _clean((summary.get("short_article") or {}).get("body") or summary.get("body")),
                "by": _clean(raw.get("by")) if _clean(raw.get("source")).lower() in HN_SOURCES else "",
                "share_url": f"{SITE_URL}/featured/{date}/{quote(item_id, safe='')}",
            })
    return items


def suggested_line(item: dict[str, Any], date: str, today: str) -> str:
    """A short, friendly note for the maker. No hype."""
    if github_repo(item["url"]):
        kind = "repo"
    elif item["section"] == "tools":
        kind = "project"
    else:
        kind = "post"
    title = _clip(item["title"], 80)
    where = LIST_NAMES.get(item["section"], item["label"])
    if date == today:
        return f'Your {kind} "{title}" is in today\'s {where} on Trace: {item["share_url"]}'
    return f'Your {kind} "{title}" was in Trace\'s {where} on {_date_label(date, "short")}: {item["share_url"]}'


def find_makers(items: list[dict[str, Any]], finder: HandleFinder, date: str, today: str,
                budget: float = LOOKUP_BUDGET_SECONDS) -> list[dict[str, Any]]:
    """Each item with its handles and line; those with a handle first, sections kept apart.

    `checked` is False when no lookup ran (out of time, GitHub's rate limit),
    so the email says "not checked" rather than "no handle found".
    """
    started = time.monotonic()
    makers = []
    skipped = 0
    for item in items:
        handles: list[dict[str, str]] | None = None
        if time.monotonic() - started > budget:
            skipped += 1
        else:
            try:
                handles = finder.lookup(item["url"])
            except Exception as exc:  # one odd link must not stop the kit
                _log(f"handle lookup failed for {item['url']}: {exc}")
        makers.append({**item, "handles": handles or [], "checked": handles is not None,
                       "line": suggested_line(item, date, today)})
    if skipped:
        _log(f"handle lookups ran out of time; {skipped} link(s) left for the next run")
    order = {section: i for i, (section, _) in enumerate(SECTIONS)}
    return sorted(makers, key=lambda m: (order.get(m["section"], 9), not m["handles"]))


# ---------------------------------------------------------------------------
# Stories: the release and the top story
# ---------------------------------------------------------------------------


def _articles(topic: dict[str, Any]) -> list[dict[str, Any]]:
    return [a for a in topic.get("articles") or [] if isinstance(a, dict) and str(a.get("url") or "").startswith("http")]


def _source_name(article: dict[str, Any]) -> str:
    name = _clean(article.get("source_name") or article.get("source"))
    if name:
        return name
    host = re.sub(r"^https?://(www\.)?", "", str(article.get("url") or "")).split("/")[0]
    return host


def _story(topic: dict[str, Any], rank: int) -> dict[str, Any]:
    articles = _articles(topic)
    domains = {re.sub(r"^https?://(www\.)?", "", str(a["url"])).split("/")[0].lower() for a in articles}
    sources: list[dict[str, str]] = []
    for article in articles:
        name = _source_name(article)
        if name and all(s["name"] != name for s in sources):
            sources.append({"name": name, "title": _clean(article.get("title")), "url": str(article["url"])})
    return {
        "topic_id": str(topic.get("id") or ""),
        "title": _clean(topic.get("title")),
        "summary": _clean(topic.get("summary")),
        "key_points": [_clean(p) for p in topic.get("key_points") or [] if _clean(p)],
        "url": str(articles[0]["url"]) if articles else "",
        "lead_source": sources[0]["name"] if sources else "",
        "sources": sources[:8],
        "source_count": max(int(topic.get("source_count") or 0), len(domains - {""})),
        "rank": rank,
    }


def _usable(topic: Any) -> bool:
    if not isinstance(topic, dict) or topic.get("jev_send_worthy") == 0:
        return False
    title = _clean(topic.get("title"))
    return bool(title and _articles(topic) and not _looks_promotional(title))


def is_release(story: dict[str, Any], interest: str) -> bool:
    """A model launch (the pipeline's own test), or an AI product launch.

    "Anthropic launches $100M fund", "CoreWeave debuts on Nasdaq" and "OpenAI
    releases report on ..." are not releases worth a builders' article.
    """
    title = story["title"]
    if NOT_A_LAUNCH.search(title):
        return False
    if _looks_like_model_release(title, story["lead_source"], story["summary"][:600]):
        return True
    return (interest == "ai" and bool(LAUNCH_VERB.search(title))
            and bool(release_name(title) or PRODUCT_NOUN.search(title)))


def pick_releases(topics: list[Any]) -> list[dict[str, Any]]:
    """The biggest release by coverage; a second only if it has 2/3 of the first's sources."""
    found = []
    for rank, topic in enumerate(topics):
        if not _usable(topic):
            continue
        story = _story(topic, rank)
        if story["source_count"] >= MIN_SOURCES and is_release(story, str(topic.get("interest_id") or "").lower()):
            found.append(story)
    found.sort(key=lambda s: (-s["source_count"], s["rank"]))
    picked: list[dict[str, Any]] = []
    for story in found:
        if any(_similar(story["title"], p["title"]) for p in picked):
            continue
        if picked and story["source_count"] * 3 < picked[0]["source_count"] * 2:
            break
        picked.append(story)
        if len(picked) >= MAX_DRAFTS:
            break
    return picked


def top_story(topics: list[Any]) -> dict[str, Any] | None:
    """The day's #1: the first usable topic in the feed's ranked order."""
    for rank, topic in enumerate(topics):
        if _usable(topic):
            return _story(topic, rank)
    return None


# ---------------------------------------------------------------------------
# Writing: the model when it can, the story's own words when it can't
# ---------------------------------------------------------------------------

SYSTEM = (
    "You write for Trace, a free daily tech and AI brief, in the founder's voice. "
    "Plain, specific and honest: only facts from the material given, no hype, no emoji, no hashtags."
)

ARTICLE_PROMPT = """Draft a long-form X article about a release that many outlets are covering today. Readers are builders: developers, founders, designers.

Rules:
- Use only facts in the material below. No numbers, benchmarks, prices or dates that are not in it. Do not state guesses as facts; say when something is unclear.
- Plain words. No hype words (game-changer, revolutionary, insane, huge), no emoji, no hashtags, no rhetorical questions.
- title: an outcome-style title in plain words, 5-12 words, about what this changes or lets builders do. No clickbait and no numbers that are not in the material.
- cover_kicker: the release's name, 1-4 words (the product or model name).
- cover_headline: 3-7 words that finish the cover, like "What changes for builders".
- intro: 2-3 sentences: who released what, and the one thing that matters most.
- details: 3-6 key details, each one or two sentences, each with the name of the source it comes from (one of the source names below).
- why_it_matters: 2-3 short paragraphs on why it matters for people building products: what they can try, what it may replace, what to watch.

Material:
Title: {title}
Summary: {summary}
Key points:
{points}
Sources:
{sources}"""

ARTICLE_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["title", "cover_kicker", "cover_headline", "intro", "details", "why_it_matters"],
    "properties": {
        "title": {"type": "string"},
        "cover_kicker": {"type": "string"},
        "cover_headline": {"type": "string"},
        "intro": {"type": "string"},
        "details": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["text", "source"],
                "properties": {"text": {"type": "string"}, "source": {"type": "string"}},
            },
        },
        "why_it_matters": {"type": "array", "items": {"type": "string"}},
    },
}

POST_PROMPT = """Write one X post about this story for the founder of Trace to post today.

Rules: at most {limit} characters (a link to the brief is added after it). One or two plain sentences that lead with the most concrete fact in the text. No hype, no emoji, no hashtags, no questions, no links, nothing that is not in the text.

Title: {title}
Summary: {summary}
Key points:
{points}"""

POST_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["post"],
    "properties": {"post": {"type": "string"}},
}


def _chat_json(prompt: str, name: str, schema: dict[str, Any]) -> dict[str, Any] | None:
    """The model's JSON answer, or None (no key, bad key, timeout, bad JSON): callers use a template."""
    from v3.lib.summarizer import _get_client

    client = _get_client()
    if client is None:
        _log(f"{name}: OPENAI_API_KEY is not set; using the template")
        return None
    try:
        response = client.with_options(max_retries=1).chat.completions.create(
            model=KIT_MODEL,
            temperature=0.4,
            timeout=60,
            messages=[{"role": "system", "content": SYSTEM}, {"role": "user", "content": prompt}],
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
    parts = [story["title"], story["summary"], *story["key_points"], *(s["title"] for s in story["sources"])]
    return " ".join(parts)


def invented_numbers(text: str, material: str) -> set[str]:
    """Numbers (digits or words) in `text` that the source material never mentions."""
    known = set(NUMBER.findall(material)) | {w.lower() for w in NUMBER_WORD.findall(material)}
    found = set(NUMBER.findall(text)) | {w.lower() for w in NUMBER_WORD.findall(text)}
    return found - known


def release_name(title: str) -> str:
    match = NAMED_LAUNCH.search(title)
    return match.group(1).strip(" .,:;") if match else ""


def template_article(story: dict[str, Any]) -> dict[str, Any]:
    """The draft from the story's own summary and key points, for when the model can't help."""
    name = release_name(story["title"])
    title = story["title"].rstrip(".")
    paragraphs = _paragraphs(story["summary"])
    details = story["key_points"][:5] or paragraphs[1:4]
    return {
        "title": f"{title}: what it means for builders" if len(title) <= 80 else title,
        "cover_kicker": name or "Out today",
        "cover_headline": "What it means for builders" if name else _clip(title, 90),
        "intro": paragraphs[0] if paragraphs else title,
        "details": [{"text": text, "source": ""} for text in details],
        "why_it_matters": ["[Your take: who should try this first, what it changes for them, and what is still unclear.]"],
        "written_by": "template",
    }


def write_article(story: dict[str, Any]) -> dict[str, Any]:
    """The model's draft if it follows the rules; the template otherwise (or field by field)."""
    fallback = template_article(story)
    points = "\n".join(f"- {p}" for p in story["key_points"][:8]) or "- (none)"
    sources = "\n".join(f"[{i}] {s['name']}: {s['title']} ({s['url']})" for i, s in enumerate(story["sources"], 1))
    result = _chat_json(
        ARTICLE_PROMPT.format(title=story["title"], summary=story["summary"], points=points, sources=sources),
        "release_article",
        ARTICLE_SCHEMA,
    )
    if not result:
        return fallback
    names = {s["name"] for s in story["sources"]}
    material = _material(story)
    # Anything with a number the material never mentions is dropped: no made-up figures.
    details = [
        {"text": _clean(d.get("text")), "source": _clean(d.get("source")) if _clean(d.get("source")) in names else ""}
        for d in result.get("details") or []
        if isinstance(d, dict) and _clean(d.get("text")) and not invented_numbers(_clean(d.get("text")), material)
    ][:6]
    why = [_clean(p) for p in result.get("why_it_matters") or [] if _clean(p) and not invented_numbers(_clean(p), material)][:3]
    intro = _clean(result.get("intro"))
    if invented_numbers(intro, material):
        intro = ""
    if len(details) < 2 or not why or not intro:
        _log("release_article: the model's draft was incomplete or had numbers not in the sources; using the template")
        return fallback
    title = _clean(result.get("title")).rstrip(".")
    if not 3 <= len(title.split()) <= 16 or len(title) > 110 or invented_numbers(title, material):
        _log(f"release_article: title {title!r} broke the rules; using the story's")
        title = fallback["title"]
    kicker = _clean(result.get("cover_kicker"))
    headline = _clean(result.get("cover_headline"))
    if not kicker or len(kicker) > 28 or invented_numbers(kicker, material):
        kicker = fallback["cover_kicker"]
    if not headline or len(headline) > 60 or invented_numbers(headline, material):
        headline = fallback["cover_headline"]
    return {"title": title, "cover_kicker": kicker, "cover_headline": headline, "intro": intro,
            "details": details, "why_it_matters": why, "written_by": "model"}


def article_text(draft: dict[str, Any], story: dict[str, Any]) -> str:
    """The article as plain text, ready to paste into X's article editor."""
    lines = [draft["title"], "", draft["intro"], ""]
    if draft["details"]:
        lines.append("What's new")
        for detail in draft["details"]:
            lines.append(f"- {detail['text']}" + (f" ({detail['source']})" if detail["source"] else ""))
        lines.append("")
    lines.append("Why it matters for builders")
    for paragraph in draft["why_it_matters"]:
        lines += [paragraph, ""]
    lines.append("Sources")
    lines += [f"- {s['name']}: {s['url']}" for s in story["sources"][:6]]
    lines += [
        "",
        "I write Trace, a free daily brief with the tech and AI stories that matter, in about five minutes. "
        f"Get it in your inbox: {CTA_URL}",
    ]
    return "\n".join(lines)


def _first_sentence(text: str) -> str:
    paragraphs = _paragraphs(text)
    if not paragraphs:
        return ""
    match = re.match(r"(.+?[.!?])(\s|$)", paragraphs[0])
    return (match.group(1) if match else paragraphs[0]).strip()


def write_post(story: dict[str, Any], date: str) -> dict[str, Any]:
    """A post for the day's #1 story, with a link to the day's brief."""
    link = f"{SITE_URL}/brief/{date}?utm_source=x&utm_medium=post"
    points = "\n".join(f"- {p}" for p in story["key_points"][:5]) or "- (none)"
    result = _chat_json(
        POST_PROMPT.format(limit=POST_MAX_CHARS, title=story["title"], summary=story["summary"], points=points),
        "top_story_post",
        POST_SCHEMA,
    )
    text = _clean((result or {}).get("post"))
    written_by = "model"
    if (not 20 <= x_length(text) <= POST_MAX_CHARS or "#" in text or "http" in text
            or invented_numbers(text, _material(story))):
        if result:
            _log("top_story_post: the model's post broke the rules; using the template")
        title = story["title"] if story["title"][-1:] in ".!?" else f"{story['title']}."
        sentence = _first_sentence(story["summary"])
        text = f"{title}\n\n{sentence}" if sentence and x_length(f"{title}\n\n{sentence}") <= POST_MAX_CHARS else title
        while x_length(text) > POST_MAX_CHARS:  # CJK and emoji count double
            text = _clip(text, len(text) - 1)
        written_by = "template"
    post = f"{text}{POST_LINK_LEAD}{link}"
    return {"text": post, "length": x_length(post), "written_by": written_by}


# ---------------------------------------------------------------------------
# The kit
# ---------------------------------------------------------------------------


def build_kit(date: str, doc: dict[str, Any], finder: HandleFinder, now: datetime) -> dict[str, Any]:
    today = feed_today(now)
    topics = [t for t in doc.get("trending_topics") or [] if isinstance(t, dict)]
    drafts = []
    for i, story in enumerate(pick_releases(topics), 1):
        draft = write_article(story)
        cover = render_cover(draft["cover_kicker"], draft["cover_headline"], _date_label(date))
        buffer = io.BytesIO()
        # JPEG, like the Instagram slides: the grain makes a PNG ten times bigger.
        cover.save(buffer, "JPEG", quality=92, optimize=True, progressive=True)
        drafts.append({**draft, "story": story, "text": article_text(draft, story),
                       "cover_name": f"cover-{i}.jpg", "cover_bytes": buffer.getvalue()})
    story = top_story(topics)
    post = {**write_post(story, date), "story": story} if story else None
    makers = find_makers(featured_items(doc, date), finder, date, today)
    return {"date": date, "today": today, "drafts": drafts, "post": post, "makers": makers,
            "font": headline_font_name(), "topics": len(topics)}


def subject_for(kit: dict[str, Any]) -> str:
    count = len(kit["drafts"])
    drafts = f"{count} release draft{'s' if count != 1 else ''}" if count else "no big release"
    return f"Post kit for {_date_label(kit['date'], 'short')}: {drafts}, {len(kit['makers'])} featured to tell"


def _esc(text: Any) -> str:
    return html.escape(str(text or ""))


def _a(url: str, text: str = "") -> str:
    return f'<a href="{_esc(url)}" style="color: #1d9bf0; text-decoration: none;">{_esc(text or url)}</a>'


def _p(inner: str, size: int = 15, color: str = "#0f1419", margin: str = "0 0 10px 0", weight: int = 400) -> str:
    return (f'<p style="margin: {margin}; font-size: {size}px; line-height: 1.5; color: {color}; '
            f'font-weight: {weight}; font-family: {FONT};">{inner}</p>')


def _box(text: str, size: int = 14) -> str:
    """Copy-ready text: line breaks kept, nothing to clean up after pasting."""
    return (f'<div style="margin: 0 0 12px 0; padding: 14px 16px; background: #f7f9f9; border: 1px solid #eff3f4; '
            f'border-radius: 12px; white-space: pre-wrap; font-size: {size}px; line-height: 1.55; color: #0f1419; '
            f'font-family: {FONT};">{_esc(text)}</div>')


def _heading(text: str) -> str:
    return (f'<p style="margin: 32px 0 12px 0; padding-top: 20px; border-top: 1px solid #eff3f4; font-size: 19px; '
            f'font-weight: 800; color: #0f1419; font-family: {FONT};">{_esc(text)}</p>')


def _kicker(text: str) -> str:
    return _p(_esc(text.upper()), size=11, color="#536471", margin="18px 0 4px 0", weight=700)


def _no_handle(maker: dict[str, Any]) -> str:
    return "no X handle found" if maker.get("checked", True) else "X handle not checked today"


def _handles_text(maker: dict[str, Any]) -> str:
    parts = [f"{h['handle']} ({h['via']})" for h in maker["handles"]] or [_no_handle(maker)]
    if maker.get("by"):
        parts.append(f"HN submitter: {maker['by']}")
    return " · ".join(parts)


def render_email(kit: dict[str, Any], preview: bool = False) -> tuple[str, str, str]:
    """(subject, html, text). `preview` shows the covers inline (the email attaches them)."""
    subject = subject_for(kit)
    date_long = _date_label(kit["date"])
    found = sum(1 for m in kit["makers"] if m["handles"])
    drafts = len(kit["drafts"])
    summary = " · ".join(filter(None, [
        f"{drafts} release draft{'s' if drafts != 1 else ''}" if drafts else "no release draft",
        "a post for the top story" if kit["post"] else "",
        f"{len(kit['makers'])} featured ({found} with an X handle)",
    ]))
    body: list[str] = [
        _p("TRACE · POST KIT", size=12, color="#1d9bf0", margin="0 0 6px 0", weight=800),
        _p(_esc(date_long), size=24, margin="0 0 6px 0", weight=800),
        _p(_esc(summary), color="#536471", margin="0 0 8px 0"),
    ]
    text: list[str] = [f"Trace post kit · {date_long}", summary, ""]

    body.append(_heading("Release-day article"))
    text += ["RELEASE-DAY ARTICLE", ""]
    if not kit["drafts"]:
        note = f"No AI release with wide coverage today (needs {MIN_SOURCES}+ sources), so no article to draft."
        body.append(_p(_esc(note), color="#536471"))
        text += [note, ""]
    for i, draft in enumerate(kit["drafts"], 1):
        story = draft["story"]
        who = ("drafted by the model; check every detail before posting" if draft["written_by"] == "model"
               else "built from the story's own summary (the model was unavailable); fill in your take before posting")
        body.append(_kicker(f"Draft {i} · {story['source_count']} sources"))
        body.append(_p(f"Story: {_a(story['url'], story['title'])}"))
        body.append(_p(_esc(f"Cover attached: {draft['cover_name']} (1600x900). This draft was {who}."),
                       size=13, color="#536471"))
        if preview:
            body.append(f'<img src="{_esc(draft["cover_name"])}" width="560" alt="" '
                        'style="display: block; width: 100%; max-width: 560px; border-radius: 12px; margin: 0 0 12px 0;">')
        body.append(_box(draft["text"]))
        text += [f"Draft {i} ({story['source_count']} sources): {story['title']}", story["url"],
                 f"Cover attached: {draft['cover_name']}. This draft was {who}.", "", draft["text"], ""]

    body.append(_heading("X post for today's top story"))
    text += ["X POST FOR TODAY'S TOP STORY", ""]
    post = kit["post"]
    if post:
        story = post["story"]
        body.append(_p(f"{_a(story['url'], story['title'])} · {story['source_count']} sources", size=14))
        body.append(_box(post["text"], size=15))
        count = f"{post['length']}/{X_MAX} characters"
        if post["length"] > X_MAX:
            count = f'<span style="color: #f4212e; font-weight: 700;">{count}: too long for one post</span>'
        body.append(_p(f"{count} · {_a(_intent(post['text']), 'Open in X')}", size=13, color="#536471"))
        text += [f"{story['title']} ({story['url']})", "", post["text"], f"({post['length']}/280)", ""]
    else:
        body.append(_p("No stories in today's feed yet.", color="#536471"))
        text += ["No stories in today's feed yet.", ""]

    body.append(_heading("Featured today: tell the makers"))
    intro = ("Everything in today's Tools and Top articles, each with a share page. "
             "Handles are best-effort, so check the profile before you tag anyone.")
    body.append(_p(_esc(intro), size=14, color="#536471"))
    text += ["FEATURED TODAY: TELL THE MAKERS", intro, ""]
    if not kit["makers"]:
        body.append(_p("Nothing in Tools or Top articles today.", color="#536471"))
        text += ["Nothing in Tools or Top articles today.", ""]
    for maker in kit["makers"]:
        contacts = [f"{_a('https://x.com/' + h['handle'][1:], h['handle'])} ({_esc(h['via'])})" for h in maker["handles"]]
        if not contacts:
            contacts = [_esc(_no_handle(maker))]
        if maker.get("by"):
            user = _a("https://news.ycombinator.com/user?id=" + quote(maker["by"]), maker["by"])
            contacts.append(f"HN submitter: {user}")
        body.append(_kicker(" · ".join(filter(None, [maker["label"], maker["source"], maker["signal"]]))))
        body.append(_p(_a(maker["url"], maker["title"]), size=16, margin="0 0 4px 0", weight=700))
        if maker["summary"]:
            body.append(_p(_esc(maker["summary"]), size=13, color="#536471", margin="0 0 4px 0"))
        body.append(_p(" · ".join(contacts), size=13, color="#536471", margin="0 0 4px 0"))
        body.append(_p(f"Share page: {_a(maker['share_url'])}", size=13, color="#536471", margin="0 0 8px 0"))
        body.append(_box(maker["line"], size=13))
        if maker["handles"]:
            tagged = f"{' '.join(h['handle'] for h in maker['handles'][:2])} {maker['line']}"
            body.append(_p(_a(_intent(tagged), "Post it on X, tagged"), size=13, margin="0 0 12px 0"))
        text += [f"[{maker['label']}] {maker['title']}", maker["url"], f"Contacts: {_handles_text(maker)}",
                 f"Share page: {maker['share_url']}", f"Line: {maker['line']}", ""]

    footer = f"Cover headline font: {kit['font']}. Sent by trace-postkit (backend/v3/flows/build_post_kit.py)."
    body.append(_p(_esc(footer), size=12, color="#536471", margin="32px 0 0 0"))
    text.append(footer)
    page = (
        "<!doctype html><html><head>"
        '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
        '<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">'
        f"<title>{_esc(subject)}</title></head>"
        '<body style="margin: 0; padding: 0; background: #ffffff;">'
        '<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff"><tr>'
        '<td align="center" style="padding: 32px 16px;">'
        '<table width="600" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 600px;"><tr><td>'
        + "".join(body)
        + "</td></tr></table></td></tr></table></body></html>"
    )
    return subject, page, "\n".join(text)


# ---------------------------------------------------------------------------
# Send
# ---------------------------------------------------------------------------


def due(marker: dict[str, Any] | None) -> bool:
    """No kit yet today, or a failed send to try again ("sending" may have gone out: never again)."""
    if not marker:
        return True
    return marker.get("status") == "failed" and int(marker.get("attempts") or 0) < MAX_ATTEMPTS


def save_featured(store: Any, date: str, doc: dict[str, Any], makers: list[dict[str, Any]], now: datetime) -> None:
    """Copy today's featured items onto the feed doc, so share pages outlive the pulse's refreshes."""
    kept: dict[str, dict[str, Any]] = {
        str(item["id"]): item for item in doc.get("featured_items") or [] if isinstance(item, dict) and item.get("id")
    }
    for maker in makers:
        kept[maker["id"]] = {
            "id": maker["id"],
            "section": maker["section"],
            "title": maker["title"],
            "url": maker["url"],
            "source": maker["source"],
            "signal": maker["signal"],
            "thumbnail": maker["thumbnail"],
            "summary": {"body": maker["summary"]},
            "featured_at": kept.get(maker["id"], {}).get("featured_at") or now.isoformat(),
        }
    (store.db.collection("v3_user_feeds").document("_global").collection("daily").document(date)
     .set({"featured_items": list(kept.values())}, merge=True))


def send_kit(kit: dict[str, Any], to: str, bucket: str = BUCKET) -> dict[str, Any]:
    from v1.tools.email_sender import send_email

    subject, page, text = render_email(kit)
    if bucket == "test":
        subject = f"[test] {subject}"
    attachments = [(d["cover_name"], d["cover_bytes"], "image/jpeg") for d in kit["drafts"]]
    return send_email(to, None, subject, page, text, bucket=bucket, attachments=attachments)


def _send_daily(store: Any, to: str, args: argparse.Namespace, now: datetime) -> int:
    date, doc = load_day(store.load_global_feed, now, args.date or "")
    if not doc:
        _log(f"no feed for {date} yet; nothing to send")
        return 1
    ref = store.db.collection(MARKERS).document(date)
    snap = ref.get()
    marker = (snap.to_dict() or {}) if snap.exists else None
    if not due(marker):
        _log(f"kit for {date} already {marker.get('status')} (attempts {marker.get('attempts')}); nothing to do")
        return 0

    kit = build_kit(date, doc, HandleFinder(store.db, log=_log), now)
    stamp = now.isoformat()
    attempts = int((marker or {}).get("attempts") or 0) + 1
    # Both writes go down before the email: if either fails, stop. A send we
    # can't record would be repeated, and share links would stop working.
    try:
        save_featured(store, date, doc, kit["makers"], now)
        ref.set({"date": date, "to": to, "status": "sending", "attempts": attempts, "updated_at": stamp,
                 "created_at": (marker or {}).get("created_at") or stamp}, merge=True)
    except Exception as exc:
        _log(f"cannot record the kit, stopping: {exc}")
        return 1
    try:
        result = send_kit(kit, to)
    except Exception as exc:
        result = {"success": False, "error": str(exc)}
    ok = result.get("success") is not False
    try:
        ref.set({"status": "sent" if ok else "failed", "transport": result.get("transport") or "",
                 "error": "" if ok else str(result.get("error") or "")[:300],
                 "drafts": len(kit["drafts"]), "featured": len(kit["makers"]),
                 "updated_at": datetime.now(timezone.utc).isoformat()}, merge=True)
    except Exception as exc:
        # Left at "sending": never retried, so never sent twice.
        _log(f"cannot record the result, stopping: {exc}")
        return 1
    if ok:
        _log(f"sent the {date} kit to {to} via {result.get('transport')}: {subject_for(kit)}")
        return 0
    _log(f"FAILED to send the {date} kit (attempt {attempts}/{MAX_ATTEMPTS}): {result.get('error')}")
    return 1


def _summary(kit: dict[str, Any]) -> list[str]:
    lines = [f"kit for {kit['date']} ({kit['topics']} topics in the feed): {subject_for(kit)}"]
    for draft in kit["drafts"]:
        story = draft["story"]
        lines.append(f"  draft ({draft['written_by']}, {story['source_count']} sources): {draft['title']}")
    if not kit["drafts"]:
        lines.append(f"  no release with {MIN_SOURCES}+ sources")
    if kit["post"]:
        lines.append(f"  post ({kit['post']['written_by']}, {kit['post']['length']}/280): {kit['post']['story']['title']}")
    found = [m for m in kit["makers"] if m["handles"]]
    lines.append(f"  featured: {len(kit['makers'])}, with an X handle: {len(found)}")
    for maker in found:
        lines.append(f"    {maker['title'][:60]}: {', '.join(h['handle'] for h in maker['handles'])}")
    lines.append(f"  cover font: {kit['font']}")
    return lines


def _dry_run(args: argparse.Namespace, now: datetime, store: Any = None) -> int:
    if args.feed_json:
        saved = json.loads(Path(args.feed_json).read_text())
        date, doc = load_day(lambda _date: saved, now, args.date or "")
        finder = HandleFinder(None, log=_log, now=now)
    else:
        store = store or _store()
        date, doc = load_day(store.load_global_feed, now, args.date or "")
        finder = HandleFinder(store.db, read_only=True, log=_log, now=now)
    if not doc:
        _log(f"no feed for {date}; nothing to preview")
        return 1
    kit = build_kit(date, doc, finder, now)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    subject, page, text = render_email(kit, preview=True)
    (out / "post-kit.html").write_text(page)
    (out / "post-kit.txt").write_text(f"Subject: {subject}\n\n{text}")
    for draft in kit["drafts"]:
        (out / draft["cover_name"]).write_bytes(draft["cover_bytes"])
    for line in _summary(kit):
        _log(f"[dry-run] {line}")
    to = os.getenv("TRACE_KIT_TO", "").strip()
    _log(f"[dry-run] would send to {to}" if to else "[dry-run] TRACE_KIT_TO is not set: a live run would send nothing")
    _log(f"[dry-run] preview: {out / 'post-kit.html'} ({len(kit['drafts'])} cover(s) beside it); handle lookups "
         f"{finder.fetched} fetched, {finder.cached} cached, nothing written")
    return 0


def _store() -> Any:
    from v3.lib.store import V3Store

    return V3Store()


def run(args: argparse.Namespace, now: datetime | None = None, store: Any = None) -> int:
    now = now or datetime.now(timezone.utc)
    if args.dry_run:
        return _dry_run(args, now, store)
    if args.test_to:
        store = store or _store()
        date, doc = load_day(store.load_global_feed, now, args.date or "")
        if not doc:
            _log(f"no feed for {date}; nothing to send")
            return 1
        kit = build_kit(date, doc, HandleFinder(store.db, log=_log, now=now), now)
        result = send_kit(kit, args.test_to, bucket="test")
        ok = result.get("success") is not False
        _log(f"test kit for {date} to {args.test_to}: {result.get('transport')} success={ok} {result.get('error') or ''}")
        return 0 if ok else 1

    to = os.getenv("TRACE_KIT_TO", "").strip()
    if not to:
        _log("TRACE_KIT_TO is not set; no kit to send")
        return 0
    # One run at a time, whether from the timer or by hand.
    with open(getattr(args, "lock", None) or LOCK_FILE, "a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            _log("another post kit run is going; skipping")
            return 0
        return _send_daily(store or _store(), to, args, now)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true", help="build the kit and write an HTML preview; no email, no writes")
    parser.add_argument("--out", default="/tmp/trace-postkit", help="where --dry-run writes the preview and covers")
    parser.add_argument("--feed-json", help="with --dry-run: read the day's feed doc from this JSON file, not the database")
    parser.add_argument("--date", help="feed date (YYYY-MM-DD); default today in IST, else yesterday")
    parser.add_argument("--test-to", help="send one copy to this address only (no marker, no featured copy)")
    parser.add_argument("--lock", help=argparse.SUPPRESS)
    args = parser.parse_args()
    if args.feed_json and not args.dry_run:
        parser.error("--feed-json only works with --dry-run")
    if args.date:
        try:
            datetime.strptime(args.date, "%Y-%m-%d")
        except ValueError:
            parser.error("--date must be a real date, YYYY-MM-DD")
    sys.exit(run(args))


if __name__ == "__main__":
    main()
