"""Post a Trace carousel to Instagram through Buffer.

  cd backend
  ../.venv/bin/python -m v3.flows.post_instagram --dry-run --out /tmp/ig   # render only, no writes
  ../.venv/bin/python -m v3.flows.post_instagram                           # render, host, share now

trace-instagram.timer runs it at 09:00 and 20:00 Europe/London. Each run
picks 3-4 of today's top stories that were not posted before (two AI, then
Markets and Startups), renders a cover listing them, then a photo slide and a
story slide (its first paragraphs, as the feed splits them) for each, all in
one theme (a light one in the morning, rotating by day; dark in the evening;
see instagram_slides.theme_for), writes the JPEGs where
Caddy serves them (INSTAGRAM_MEDIA_DIR -> INSTAGRAM_MEDIA_URL), shares the
carousel now through Buffer and waits until Buffer reports it sent.

Every post is logged in `instagram_posts/{date}-{slot}`. A slot is posted
again only when nothing can have gone out (see RETRY), so a re-run or retry
does not double-post. Live runs by hand should go through the service
(`systemctl --user start trace-instagram.service`), which holds the lock.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo

import requests
from dotenv import load_dotenv

BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))
load_dotenv(BACKEND_ROOT.parent / ".env")

from v3.build_trending import _looks_promotional  # noqa: E402
from v3.flows.send_audience_newsletter import _paragraphs  # noqa: E402  (the feed's paragraph split)
from v3.lib.instagram_slides import (  # noqa: E402
    Cover,
    SlideStory,
    drawable,
    fetch_image,
    fits_story_slide,
    render_carousel,
    theme_for,
    without_missing_glyphs,
)
from v3.lib.store import V3Store  # noqa: E402

LONDON = ZoneInfo("Europe/London")
IST = timezone(timedelta(hours=5, minutes=30))
COLLECTION = "instagram_posts"
BUFFER_URL = "https://api.buffer.com"
MEDIA_DIR = Path(os.getenv("INSTAGRAM_MEDIA_DIR", "/var/www/trace-social"))
MEDIA_URL = os.getenv("INSTAGRAM_MEDIA_URL", "https://db.yourtrace.online/social").rstrip("/")
COPY_MODEL = os.getenv("INSTAGRAM_COPY_MODEL", "gpt-4.1-mini")


def _env_int(name: str, default: int, low: int, high: int) -> int:
    try:
        value = int(os.getenv(name, "").strip() or default)
    except ValueError:
        value = default
    return max(low, min(high, value))


MIN_STORIES = _env_int("INSTAGRAM_MIN_STORIES", 3, 1, 4)
# A cover, then two slides per story, and an Instagram carousel holds at most 10.
MAX_STORIES = _env_int("INSTAGRAM_MAX_STORIES", 4, MIN_STORIES, 4)
# One story per entry, in this order: two AI, then Markets, Startups, Design.
LANES = [lane.strip() for lane in os.getenv("INSTAGRAM_LANES", "ai,ai,markets,startups,ux-design").split(",") if lane.strip()]
LANE_LABELS = {"ai": "AI", "markets": "Markets", "startups": "Startups", "tech": "Tech", "ux-design": "Design"}
# A story that went out is not posted again for this long.
REPEAT_WINDOW_DAYS = 14
KEEP_MEDIA_DAYS = 14
# A slot is tried again only when nothing can have gone out: Buffer turned the
# post down before creating it ("failed") or reports that publishing failed
# ("error"). Every other status (posting, draft, needs_approval, scheduled,
# sending, sent, unknown) counts as posted, as do its stories.
RETRY = {"failed", "error"}
# Buffer statuses still on their way; the next run re-reads them.
IN_FLIGHT = {"posting", "draft", "needs_approval", "scheduled", "sending"}
GENERIC_WORDS = {"launches", "launch", "unveils", "announces", "says", "plans", "with", "from", "after",
                 "over", "into", "about", "their", "will", "amid", "this", "that", "than", "more"}

HASHTAGS = {
    "ai": ["#ai", "#artificialintelligence"],
    "markets": ["#markets", "#business"],
    "startups": ["#startups", "#founders"],
    "ux-design": ["#design", "#ux"],
    "tech": ["#tech", "#gadgets"],
}


def _log(message: str) -> None:
    print(f"[{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')}] [instagram] {message}", flush=True)


def _clean(text: Any) -> str:
    return re.sub(r"\s+", " ", re.sub(r"\*\*?([^*]+)\*\*?", r"\1", str(text or ""))).strip()


def _url_key(url: str) -> str:
    parts = urlsplit(str(url or "").strip())
    return f"{parts.netloc.lower().removeprefix('www.')}{parts.path.rstrip('/')}" if parts.netloc else ""


def _words(title: str) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9]+", title.lower()) if len(w) >= 4 and w not in GENERIC_WORDS}


def _similar(a: str, b: str) -> bool:
    """Same story: near-identical titles, or most of the same distinctive words.

    "Apple launches iPhone 17 Pro" and "Apple launches iPad Pro M5" stay apart.
    """
    if SequenceMatcher(None, a.lower(), b.lower()).ratio() >= 0.85:
        return True
    wa, wb = _words(a), _words(b)
    shared = wa & wb
    return len(shared) >= 3 and len(shared) / len(wa | wb) >= 0.5


def slot_for(now: datetime) -> tuple[str, str]:
    """(London date, "am"/"pm") for a run at `now`."""
    local = now.astimezone(LONDON)
    return local.strftime("%Y-%m-%d"), "am" if local.hour < 14 else "pm"


# ---------------------------------------------------------------------------
# Stories
# ---------------------------------------------------------------------------


def load_topics(store: V3Store, now: datetime) -> tuple[list[dict[str, Any]], str]:
    """Today's ranked feed topics (IST, like the pipeline), else yesterday's."""
    today = now.astimezone(IST).date()
    for day in (today, today - timedelta(days=1)):
        key = day.strftime("%Y-%m-%d")
        topics = store.load_global_feed(key).get("trending_topics") or []
        if topics:
            return [t for t in topics if isinstance(t, dict)], key
    return [], ""


def recent_posts(store: V3Store, now: datetime) -> list[dict[str, Any]]:
    """Posts that went out (or may have) lately; failed attempts free their stories."""
    since = (now.astimezone(LONDON) - timedelta(days=REPEAT_WINDOW_DAYS)).strftime("%Y-%m-%d")
    docs = (d.to_dict() or {} for d in store.db.collection(COLLECTION).where("date", ">=", since).stream())
    return [doc for doc in docs if doc.get("status") not in RETRY]


def _image_urls(topic: dict[str, Any]) -> list[str]:
    urls = [str(topic.get("thumbnail") or "")]
    for article in topic.get("articles") or []:
        if isinstance(article, dict):
            urls += [str(article.get("og_image") or ""), str(article.get("thumbnail") or "")]
    seen: list[str] = []
    for url in urls:
        if url.startswith("http") and url not in seen:
            seen.append(url)
    return seen[:4]


def _best_image(topic: dict[str, Any]) -> Any:
    """The first candidate at least 600px on its short side, else the largest."""
    best = None
    for url in _image_urls(topic):
        image = fetch_image(url)
        if image is None:
            continue
        if best is None or image.width * image.height > best.width * best.height:
            best = image
        if min(image.size) >= 600:
            break
    return best


def _source(topic: dict[str, Any]) -> tuple[str, int]:
    """The lead outlet and how many outlets covered the story, for the story slide."""
    articles = [a for a in topic.get("articles") or [] if isinstance(a, dict)]
    name = _clean((articles[0].get("source_name") or articles[0].get("source")) if articles else "")
    try:
        count = int(topic.get("source_count") or len(articles) or 1)
    except (TypeError, ValueError):
        count = 1
    return without_missing_glyphs(name)[:60], max(1, count)


def _kicker(lane: str) -> str:
    return f"Top in {LANE_LABELS.get(lane, lane.replace('-', ' ').title())}"


def pick_stories(
    topics: list[dict[str, Any]], posted: list[dict[str, Any]], limit: int, lanes: list[str] | None = None
) -> list[dict[str, Any]]:
    """One story per entry in `lanes` (two AI, then Markets, Startups, Design):
    the best story in that lane with an image and a summary, not posted
    recently. A lane with nothing new is skipped and the best remaining story
    from any lane fills the gap at the end.

    Like the brief, the "Top in X" kicker shows once per lane, so the second
    AI story in a row has none, and a story filling a gap has none either.
    Stories the slide can't show well are skipped: text the font can't draw,
    or a first paragraph too long for the story slide.
    """
    lanes = lanes or LANES
    posted_ids = {i for p in posted for i in p.get("topic_ids") or []}
    posted_urls = {u for p in posted for u in p.get("url_keys") or []}
    posted_titles = [t for p in posted for t in p.get("titles") or []]

    candidates: list[dict[str, Any]] = []  # feed order
    for topic in topics:
        title = without_missing_glyphs(_clean(topic.get("title")))
        paragraphs = _paragraphs(_clean(topic.get("summary")))[:3]
        if not title or topic.get("jev_send_worthy") == 0 or _looks_promotional(title):
            continue
        if not fits_story_slide(paragraphs) or not drawable(" ".join(paragraphs)):
            continue
        url_keys = {_url_key(a.get("url", "")) for a in topic.get("articles") or [] if isinstance(a, dict)} - {""}
        if topic.get("id") in posted_ids or url_keys & posted_urls or any(_similar(title, old) for old in posted_titles):
            continue
        candidates.append({
            "topic": topic, "title": title, "paragraphs": paragraphs,
            "points": [_clean(p) for p in topic.get("key_points") or [] if _clean(p)],
            "url_keys": sorted(url_keys), "lane": str(topic.get("interest_id") or "tech"),
        })

    picked: list[dict[str, Any]] = []
    tried: set[int] = set()

    def take(story: dict[str, Any], lane_pick: bool) -> bool:
        if id(story) in tried:
            return False
        tried.add(id(story))
        if any(_similar(story["title"], p["title"]) for p in picked):
            return False
        image = _best_image(story["topic"])
        if image is None:
            _log(f"skip (no usable image): {story['title']}")
            return False
        picked.append({**story, "image": image, "lane_pick": lane_pick})
        return True

    for lane in lanes[:limit]:
        any(take(story, True) for story in candidates if story["lane"] == lane)
    for story in candidates:
        if len(picked) >= limit:
            break
        take(story, False)

    labelled: set[str] = set()
    for story in picked:
        story["kicker"] = ""
        if story["lane_pick"] and story["lane"] not in labelled:
            story["kicker"] = _kicker(story["lane"])
            labelled.add(story["lane"])
    return picked


# ---------------------------------------------------------------------------
# Copy
# ---------------------------------------------------------------------------

COPY_PROMPT = """You write Instagram carousel copy for Trace, a free app that reads tech news so readers don't have to.

For each story return:
- headline: 4-8 words that stop the scroll, like a sharp magazine cover line. Lead with the most striking concrete fact in the story (a number, a price, a first, a consequence) rather than just saying something was launched or announced. Sentence case, no clickbait, no question, no emoji, no trailing period, nothing that isn't in the text. Examples of the style: "Men use AI coding twice as much", "Meta's $4B loss won't stop AI pendant", "Spotify's ad-free plan now costs $2 more".

Also return hook: one line of at most 80 characters that introduces the whole post, plain and specific, no emoji.

Stories:
{stories}"""

COPY_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["hook", "stories"],
    "properties": {
        "hook": {"type": "string"},
        "stories": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["index", "headline"],
                "properties": {
                    "index": {"type": "integer"},
                    "headline": {"type": "string"},
                },
            },
        },
    },
}


def write_copy(stories: list[dict[str, Any]]) -> str:
    """Fill story["headline"] for the photo slide; return the caption hook.

    Falls back to the feed's own title if the model fails. The story slide's
    text is the feed summary itself, never rewritten.
    """
    for story in stories:
        story["headline"] = story["title"]
    blocks = "\n\n".join(
        f"[{i}] {s['title']}\nSummary: {' '.join(s['paragraphs'])}\nKey points: " + " | ".join(s["points"][:5])
        for i, s in enumerate(stories)
    )
    try:
        from openai import OpenAI

        response = OpenAI().chat.completions.create(
            model=COPY_MODEL,
            temperature=0.6,
            timeout=60,
            messages=[{"role": "user", "content": COPY_PROMPT.format(stories=blocks)}],
            response_format={"type": "json_schema", "json_schema": {"name": "carousel", "strict": True, "schema": COPY_SCHEMA}},
        )
        result = json.loads(response.choices[0].message.content or "{}")
    except Exception as exc:
        _log(f"copy model failed, using feed titles: {exc}")
        return ""
    for row in result.get("stories") or []:
        index = row.get("index")
        if not isinstance(index, int) or not 0 <= index < len(stories):
            continue
        headline = without_missing_glyphs(_clean(row.get("headline"))).rstrip(".")
        if 2 <= len(headline.split()) <= 10 and len(headline) <= 70:
            stories[index]["headline"] = headline
    return _clean(result.get("hook"))[:120]


def caption_for(stories: list[dict[str, Any]], hook: str) -> str:
    lines = [hook or "Today's top tech stories, in one swipe.", ""]
    lines += [f"{i}. {s['headline']}" for i, s in enumerate(stories, 1)]
    lines += ["", "Trace reads the internet so you don't have to. Every story in full, free, at yourtrace.online (link in bio).", ""]
    tags = ["#technews"]
    for story in stories:
        for tag in HASHTAGS.get(story["lane"], []):
            if tag not in tags:
                tags.append(tag)
    lines.append(" ".join(tags[:8] + ["#yourtrace"]))
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Hosting and Buffer
# ---------------------------------------------------------------------------


def host_slides(slides: list[Any], folder: str) -> list[str]:
    """Write the JPEGs under MEDIA_DIR and check each public URL serves it."""
    target = MEDIA_DIR / folder
    target.mkdir(parents=True, exist_ok=True)
    urls = []
    for i, slide in enumerate(slides, 1):
        slide.save(target / f"{i:02d}.jpg", "JPEG", quality=90, optimize=True, progressive=True)
        urls.append(f"{MEDIA_URL}/{folder}/{i:02d}.jpg")
    for url in urls:
        response = requests.get(url, timeout=20)
        if response.status_code != 200 or response.headers.get("content-type", "").split(";")[0] != "image/jpeg":
            raise RuntimeError(f"slide not served: {url} -> {response.status_code} {response.headers.get('content-type')}")
    return urls


def prune_media(now: datetime) -> None:
    if not MEDIA_DIR.is_dir():
        return
    cutoff = now.timestamp() - KEEP_MEDIA_DAYS * 86400
    for folder in MEDIA_DIR.iterdir():
        if folder.is_dir() and folder.stat().st_mtime < cutoff:
            shutil.rmtree(folder, ignore_errors=True)


class BufferRefused(RuntimeError):
    """Buffer turned the request down before creating anything: safe to retry."""


# Buffer's documented refusals (top-level codes and typed mutation errors).
# Anything else, UNEXPECTED or a timeout above all, may have created the post.
REFUSED_CODES = {"UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND", "RATE_LIMIT_EXCEEDED"}
REFUSED_TYPES = {
    "InvalidInputError", "LimitReachedError", "NotFoundError", "UnauthorizedError",
    "PostInvalidInputError", "PostLimitReachedError", "PostChannelNotFoundError", "ChannelRefreshRequired",
}


def buffer(query: str, variables: dict[str, Any] | None = None) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """(data, errors) from Buffer. Errors can ride along with good data as warnings."""
    key = os.getenv("BUFFER_API_KEY", "").strip()
    if not key:
        raise BufferRefused("BUFFER_API_KEY is not set")
    response = requests.post(
        BUFFER_URL,
        json={"query": query, "variables": variables or {}},
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        timeout=60,
    )
    response.raise_for_status()
    body = response.json()
    return body.get("data") or {}, body.get("errors") or []


def _read(query: str, variables: dict[str, Any] | None = None) -> dict[str, Any]:
    data, errors = buffer(query, variables)
    if errors and not any(data.values()):
        raise RuntimeError(f"Buffer: {errors}"[:500])
    return data


def instagram_channel() -> str:
    configured = os.getenv("BUFFER_INSTAGRAM_CHANNEL_ID", "").strip()
    if configured:
        return configured
    for org in _read("{ account { organizations { id } } }")["account"]["organizations"]:
        channels = _read(
            "query($o: OrganizationId!) { channels(input: {organizationId: $o}) { id service isDisconnected isLocked } }",
            {"o": org["id"]},
        )["channels"]
        for channel in channels:
            if channel["service"] == "instagram" and not channel["isDisconnected"] and not channel["isLocked"]:
                return channel["id"]
    raise BufferRefused("no connected Instagram channel in Buffer")


def share_now(channel_id: str, caption: str, image_urls: list[str]) -> str:
    """Create the post; BufferRefused when nothing was created, RuntimeError when unsure."""
    data, errors = buffer(
        """mutation($input: CreatePostInput!) { createPost(input: $input) {
            __typename
            ... on PostActionSuccess { post { id status } }
            ... on MutationError { message }
        } }""",
        {"input": {
            "channelId": channel_id,
            "text": caption,
            "schedulingType": "automatic",
            "mode": "shareNow",
            "needsApproval": False,
            "assets": [{"image": {"url": url}} for url in image_urls],
            # Several images make a carousel; Buffer's Instagram types are post, story and reel.
            "metadata": {"instagram": {"type": "post", "shouldShareToFeed": True}},
        }},
    )
    result = data.get("createPost") or {}
    if (result.get("post") or {}).get("id"):
        return result["post"]["id"]
    kind = result.get("__typename") or ""
    codes = {str((e.get("extensions") or {}).get("code") or "") for e in errors}
    detail = f"{kind or ','.join(sorted(codes)) or 'no detail'}: {result.get('message') or errors or result}"[:500]
    if kind in REFUSED_TYPES or (errors and not kind and codes <= REFUSED_CODES):
        raise BufferRefused(f"Buffer refused the post ({detail})")
    raise RuntimeError(f"Buffer returned no post id ({detail})")


def post_state(post_id: str) -> dict[str, Any]:
    return _read(
        "query($id: PostId!) { post(input: {id: $id}) { id status externalLink sentAt error { message } } }",
        {"id": post_id},
    ).get("post") or {}


def _state_fields(state: dict[str, Any]) -> dict[str, Any]:
    error = state.get("error") if isinstance(state.get("error"), dict) else {}
    return {
        "status": state.get("status") or "unknown",
        "external_link": state.get("externalLink") or "",
        "sent_at": state.get("sentAt") or "",
        "error": error.get("message") or "",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


def wait_until_sent(post_id: str, timeout: int = 600) -> dict[str, Any]:
    """Poll until Buffer reports sent or error (every 20s, then every minute).

    A failed check is logged and retried, never raised: the post exists either way.
    """
    started = time.time()
    state: dict[str, Any] = {}
    while time.time() - started < timeout:
        try:
            state = post_state(post_id) or state
        except Exception as exc:
            _log(f"status check failed, trying again: {exc}")
        if state.get("status") in {"sent", "error"}:
            break
        time.sleep(20 if time.time() - started < 120 else 60)
    return state


def refresh(ref: Any, record: dict[str, Any]) -> dict[str, Any]:
    """Re-read a post that was still on its way when its run ended."""
    post_id = record.get("buffer_post_id")
    if not post_id or record.get("status") not in IN_FLIGHT:
        return record
    try:
        state = post_state(post_id)
    except Exception as exc:
        _log(f"could not re-read Buffer post {post_id}: {exc}")
        return record
    if not state:
        return record
    fields = _state_fields(state)
    ref.set(fields, merge=True)
    return {**record, **fields}


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------


def run(args: argparse.Namespace) -> int:
    now = datetime.now(timezone.utc)
    date, slot = slot_for(now)
    slot = args.slot or slot
    # --force never touches the slot's own record, so a live post's history stays.
    doc_id = f"{date}-{slot}" + (f"-{now:%H%M%S}" if args.force else "")
    store = V3Store()
    ref = store.db.collection(COLLECTION).document(doc_id)

    existing = ref.get().to_dict() if not (args.dry_run or args.force) else None
    if existing:
        existing = refresh(ref, existing)
        if existing.get("status") not in RETRY:
            _log(f"{doc_id} already {existing.get('status')} {existing.get('external_link') or ''}; nothing to do")
            return 0

    topics, feed_date = load_topics(store, now)
    stories = pick_stories(topics, recent_posts(store, now), MAX_STORIES)
    _log(f"feed {feed_date}: {len(topics)} topics, picked {len(stories)}: " + " | ".join(s["title"] for s in stories))
    if len(stories) < MIN_STORIES:
        _log(f"only {len(stories)} usable stories (need {MIN_STORIES}); not posting")
        return 1

    hook = write_copy(stories)
    caption = caption_for(stories, hook)
    # One theme per post: a light one in the morning (rotating by day), dark at night.
    theme = theme_for(date, slot)
    cover = Cover(
        date_label=datetime.strptime(date, "%Y-%m-%d").strftime("%A, %B %-d"),
        when="morning" if slot == "am" else "evening",
        headlines=[s["headline"] for s in stories],
    )
    slides = render_carousel(
        [SlideStory(s["headline"], s["paragraphs"], s["image"], s["kicker"], *_source(s["topic"])) for s in stories],
        theme,
        cover,
    )
    record = {
        "date": date,
        "slot": slot,
        "feed_date": feed_date,
        "palette": theme.name,
        "topic_ids": [str(s["topic"].get("id") or "") for s in stories],
        "titles": [s["title"] for s in stories],
        "headlines": [s["headline"] for s in stories],
        "lanes": [s["lane"] for s in stories],
        "url_keys": sorted({k for s in stories for k in s["url_keys"]}),
        "caption": caption,
        "updated_at": now.isoformat(),
    }

    if args.dry_run:
        out = Path(args.out)
        out.mkdir(parents=True, exist_ok=True)
        for i, slide in enumerate(slides, 1):
            slide.save(out / f"{i:02d}.jpg", "JPEG", quality=90)
        (out / "caption.txt").write_text(caption)
        _log(f"dry run: {len(slides)} slides ({theme.name}) and caption.txt in {out}")
        print(json.dumps({k: v for k, v in record.items() if k != "caption"}, indent=1))
        return 0

    prune_media(now)
    image_urls = host_slides(slides, f"{doc_id}-{uuid.uuid4().hex[:8]}")
    channel_id = instagram_channel()
    ref.set({**record, "status": "posting", "image_urls": image_urls, "created_at": now.isoformat()}, merge=True)
    try:
        post_id = share_now(channel_id, caption, image_urls)
    except BufferRefused as exc:
        # Nothing was created, so the service's retry may post this slot.
        ref.set({"status": "failed", "error": str(exc)[:500]}, merge=True)
        _log(f"post refused: {exc}")
        return 1
    except Exception as exc:
        # The post may exist; trying again could post it twice.
        ref.set({"status": "unknown", "error": str(exc)[:500]}, merge=True)
        _log(f"post may or may not exist, not retrying (check Buffer): {exc}")
        return 0
    ref.set({"buffer_post_id": post_id}, merge=True)
    _log(f"shared to Buffer as {post_id}; waiting for Instagram")

    fields = _state_fields(wait_until_sent(post_id))
    ref.set(fields, merge=True)
    _log(f"{doc_id}: {fields['status']} {fields['external_link']} {fields['error']}")
    # Only a publish error is worth the service's retry; anything else is live or on its way.
    return 1 if fields["status"] == "error" else 0


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true", help="render slides and caption locally; no hosting, posting or writes")
    parser.add_argument("--out", default="/tmp/trace-instagram", help="where --dry-run writes the slides")
    parser.add_argument("--slot", choices=["am", "pm"], help="override the slot worked out from London time")
    parser.add_argument("--force", action="store_true", help="post again even if this slot posted (logged separately)")
    sys.exit(run(parser.parse_args()))


if __name__ == "__main__":
    main()
