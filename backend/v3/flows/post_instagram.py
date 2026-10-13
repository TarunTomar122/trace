"""Post a Trace carousel to Instagram through Buffer.

  cd backend
  ../.venv/bin/python -m v3.flows.post_instagram --dry-run --out /tmp/ig   # render only, no writes
  ../.venv/bin/python -m v3.flows.post_instagram                           # render, host, share now

trace-instagram.timer runs it at 09:00 and 20:00 Europe/London. Each run
picks 3-5 of today's top stories that were not posted before (two AI, then
Markets, Startups and Design), renders a
photo slide and a story slide (its first paragraphs, as the feed splits
them) for each, writes the JPEGs where Caddy serves
them (INSTAGRAM_MEDIA_DIR -> INSTAGRAM_MEDIA_URL), shares the carousel now
through Buffer and waits until Buffer reports it sent.

Every post is logged in `instagram_posts/{date}-{slot}`. A slot that already
posted (or is posting) is skipped, so a re-run or retry never double-posts.
"""

from __future__ import annotations

import argparse
import hashlib
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
from v3.lib.instagram_slides import PALETTES, SlideStory, fetch_image, render_carousel  # noqa: E402
from v3.lib.store import V3Store  # noqa: E402

LONDON = ZoneInfo("Europe/London")
IST = timezone(timedelta(hours=5, minutes=30))
COLLECTION = "instagram_posts"
BUFFER_URL = "https://api.buffer.com"
MEDIA_DIR = Path(os.getenv("INSTAGRAM_MEDIA_DIR", "/var/www/trace-social"))
MEDIA_URL = os.getenv("INSTAGRAM_MEDIA_URL", "https://db.yourtrace.online/social").rstrip("/")
COPY_MODEL = os.getenv("INSTAGRAM_COPY_MODEL", "gpt-4.1-mini")
MIN_STORIES = int(os.getenv("INSTAGRAM_MIN_STORIES", "3"))
MAX_STORIES = int(os.getenv("INSTAGRAM_MAX_STORIES", "5"))
# One story per entry, in this order: two AI, then Markets, Startups, Design.
LANES = [lane.strip() for lane in os.getenv("INSTAGRAM_LANES", "ai,ai,markets,startups,ux-design").split(",") if lane.strip()]
LANE_LABELS = {"ai": "AI", "markets": "Markets", "startups": "Startups", "tech": "Tech", "ux-design": "Design"}
# Live posts already made by hand or by earlier runs stay unique for this long.
REPEAT_WINDOW_DAYS = 4
KEEP_MEDIA_DAYS = 14
# Statuses that mean the post went out or may have: never post that slot or
# its stories again. "unknown" is a post whose status could not be read.
DONE = {"posting", "sent", "scheduled", "sending", "unknown"}

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


def _similar(a: str, b: str) -> bool:
    return SequenceMatcher(None, a.lower(), b.lower()).ratio() >= 0.6


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
    return [doc for doc in docs if doc.get("status") in DONE]


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
    AI story in a row has none.
    """
    lanes = lanes or LANES
    posted_ids = {i for p in posted for i in p.get("topic_ids") or []}
    posted_urls = {u for p in posted for u in p.get("url_keys") or []}
    posted_titles = [t for p in posted for t in p.get("titles") or []]

    candidates: list[dict[str, Any]] = []  # feed order
    for topic in topics:
        title = _clean(topic.get("title"))
        paragraphs = _paragraphs(_clean(topic.get("summary")))[:3]
        if not title or topic.get("jev_send_worthy") == 0 or not paragraphs or _looks_promotional(title):
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

    def take(story: dict[str, Any]) -> bool:
        if id(story) in tried:
            return False
        tried.add(id(story))
        if any(_similar(story["title"], p["title"]) for p in picked):
            return False
        image = next((img for img in map(fetch_image, _image_urls(story["topic"])) if img is not None), None)
        if image is None:
            _log(f"skip (no usable image): {story['title']}")
            return False
        picked.append({**story, "image": image})
        return True

    for lane in lanes[:limit]:
        any(take(story) for story in candidates if story["lane"] == lane)
    for story in candidates:
        if len(picked) >= limit:
            break
        take(story)

    for i, story in enumerate(picked):
        story["kicker"] = _kicker(story["lane"]) if i == 0 or picked[i - 1]["lane"] != story["lane"] else ""
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
        headline = _clean(row.get("headline")).rstrip(".")
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
    lines.append(" ".join(tags[:8] + ["#trace"]))
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


def buffer(query: str, variables: dict[str, Any] | None = None) -> dict[str, Any]:
    key = os.getenv("BUFFER_API_KEY", "").strip()
    if not key:
        raise RuntimeError("BUFFER_API_KEY is not set")
    response = requests.post(
        BUFFER_URL,
        json={"query": query, "variables": variables or {}},
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        timeout=60,
    )
    response.raise_for_status()
    body = response.json()
    if body.get("errors"):
        raise RuntimeError(f"Buffer: {body['errors']}")
    return body.get("data") or {}


def instagram_channel() -> str:
    configured = os.getenv("BUFFER_INSTAGRAM_CHANNEL_ID", "").strip()
    if configured:
        return configured
    orgs = buffer("{ account { organizations { id } } }")["account"]["organizations"]
    for org in orgs:
        channels = buffer(
            "query($o: OrganizationId!) { channels(input: {organizationId: $o}) { id service isDisconnected isLocked } }",
            {"o": org["id"]},
        )["channels"]
        for channel in channels:
            if channel["service"] == "instagram" and not channel["isDisconnected"] and not channel["isLocked"]:
                return channel["id"]
    raise RuntimeError("no connected Instagram channel in Buffer")


def share_now(channel_id: str, caption: str, image_urls: list[str]) -> str:
    data = buffer(
        """mutation($input: CreatePostInput!) { createPost(input: $input) {
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
    post = result.get("post")
    if not post:
        raise RuntimeError(f"Buffer refused the post: {result.get('message') or result}")
    return post["id"]


def wait_until_sent(post_id: str, timeout: int = 600) -> dict[str, Any]:
    """Poll Buffer until the post is sent or errors; returns the last state."""
    deadline = time.time() + timeout
    state: dict[str, Any] = {}
    while time.time() < deadline:
        state = buffer(
            "query($id: PostId!) { post(input: {id: $id}) { id status externalLink sentAt error { message } } }",
            {"id": post_id},
        ).get("post") or {}
        if state.get("status") in {"sent", "error"}:
            break
        time.sleep(15)
    return state


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------


def run(args: argparse.Namespace) -> int:
    now = datetime.now(timezone.utc)
    date, slot = slot_for(now)
    slot = args.slot or slot
    doc_id = f"{date}-{slot}"
    store = V3Store()
    ref = store.db.collection(COLLECTION).document(doc_id)

    existing = ref.get().to_dict() if not args.dry_run else None
    if existing and existing.get("status") in DONE and not args.force:
        _log(f"{doc_id} already {existing.get('status')}; nothing to do")
        return 0

    topics, feed_date = load_topics(store, now)
    stories = pick_stories(topics, recent_posts(store, now), MAX_STORIES)
    _log(f"feed {feed_date}: {len(topics)} topics, picked {len(stories)}: " + " | ".join(s["title"] for s in stories))
    if len(stories) < MIN_STORIES:
        _log(f"only {len(stories)} usable stories (need {MIN_STORIES}); not posting")
        return 1

    hook = write_copy(stories)
    caption = caption_for(stories, hook)
    palette = PALETTES[int(hashlib.sha256(doc_id.encode()).hexdigest(), 16) % len(PALETTES)]
    slides = render_carousel(
        [SlideStory(s["headline"], s["paragraphs"], s["image"], s["kicker"]) for s in stories], palette
    )
    record = {
        "date": date,
        "slot": slot,
        "feed_date": feed_date,
        "palette": palette.name,
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
        _log(f"dry run: {len(slides)} slides ({palette.name}) and caption.txt in {out}")
        print(json.dumps({k: v for k, v in record.items() if k != "caption"}, indent=1))
        return 0

    prune_media(now)
    folder = f"{doc_id}-{uuid.uuid4().hex[:8]}"
    image_urls = host_slides(slides, folder)
    channel_id = instagram_channel()
    ref.set({**record, "status": "posting", "image_urls": image_urls, "created_at": now.isoformat()}, merge=True)
    try:
        post_id = share_now(channel_id, caption, image_urls)
    except Exception as exc:
        ref.set({"status": "failed", "error": str(exc)[:500]}, merge=True)
        _log(f"post failed: {exc}")
        return 1
    ref.set({"buffer_post_id": post_id}, merge=True)
    _log(f"shared to Buffer as {post_id}; waiting for Instagram")

    state = wait_until_sent(post_id)
    status = state.get("status") or "unknown"
    error = (state.get("error") or {}).get("message") if isinstance(state.get("error"), dict) else None
    ref.set({
        "status": status,
        "external_link": state.get("externalLink") or "",
        "sent_at": state.get("sentAt") or "",
        "error": error or "",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }, merge=True)
    _log(f"{doc_id}: {status} {state.get('externalLink') or ''} {error or ''}".strip())
    return 0 if status == "sent" else 1


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true", help="render slides and caption locally; no hosting, posting or writes")
    parser.add_argument("--out", default="/tmp/trace-instagram", help="where --dry-run writes the slides")
    parser.add_argument("--slot", choices=["am", "pm"], help="override the slot worked out from London time")
    parser.add_argument("--force", action="store_true", help="post even if this slot already posted")
    sys.exit(run(parser.parse_args()))


if __name__ == "__main__":
    main()
