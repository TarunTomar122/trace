"""Post Trace's daily reel to Instagram through Buffer.

  cd backend
  ../.venv/bin/python -m v3.flows.post_reel --dry-run      # make the reel in REEL_WORK_DIR, no hosting or posting
  ../.venv/bin/python -m v3.flows.post_reel                # make it, host it, share it now

trace-reel.timer runs it at 14:00 GMT. Each run takes today's top 3 AI stories
(feed order) and the 2 non-AI stories covered by the most outlets, skipping
anything a reel used in the last few days. v3.lib.reel_video writes a plain
newsreader script for them (checked for facts and AI-sounding phrasing),
generates two pictures per story and Elliot's voice through Runway, and renders
a 1080x1920 MP4 with subtitles. The file is served by Caddy from
INSTAGRAM_MEDIA_DIR and shared through Buffer as an Instagram reel, labelled as
AI-generated.

Every reel is logged in `instagram_reels/{date}`. Like the carousel, a day is
tried again only when nothing can have gone out (see post_instagram.RETRY), and
a retry resumes from the stories, script, pictures and voice saved in
REEL_WORK_DIR/{date}. Live runs by hand should go through the service
(`systemctl --user start trace-reel.service`), which holds the lock.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv

BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))
load_dotenv(BACKEND_ROOT.parent / ".env")

from v3.build_trending import _looks_promotional  # noqa: E402
from v3.flows.post_instagram import (  # noqa: E402
    IN_FLIGHT,
    MEDIA_DIR,
    MEDIA_URL,
    REFUSED_CODES,
    REFUSED_TYPES,
    RETRY,
    BufferRefused,
    _clean,
    _similar,
    _source,
    _state_fields,
    _url_key,
    buffer,
    instagram_channel,
    load_topics,
    prune_media,
    refresh,
    wait_until_sent,
)
from v3.flows.send_audience_newsletter import _paragraphs  # noqa: E402
from v3.lib import reel_video  # noqa: E402
from v3.lib.instagram_slides import without_missing_glyphs  # noqa: E402
from v3.lib.store import V3Store  # noqa: E402

COLLECTION = "instagram_reels"
AI_STORIES = 3
OTHER_STORIES = 2
MIN_STORIES = 4
# A story a reel used is not used again for this long.
REPEAT_WINDOW_DAYS = 3
WORK_DIR = Path(os.getenv("REEL_WORK_DIR", str(BACKEND_ROOT.parent / "reel-work"))).expanduser()
KEEP_WORK_DAYS = 7

HASHTAGS = {
    "ai": "#ai", "robotics": "#robotics", "markets": "#business", "startups": "#startups",
    "ux-design": "#design", "tech": "#tech",
}


def _log(message: str) -> None:
    print(f"[{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')}] [reel] {message}", flush=True)


# ---------------------------------------------------------------------------
# Stories
# ---------------------------------------------------------------------------


def recent_reels(store: V3Store, now: datetime) -> list[dict[str, Any]]:
    """Reels that went out (or may have) lately; failed attempts free their stories."""
    since = (now - timedelta(days=REPEAT_WINDOW_DAYS)).strftime("%Y-%m-%d")
    docs = (d.to_dict() or {} for d in store.db.collection(COLLECTION).where("date", ">=", since).stream())
    return [doc for doc in docs if doc.get("status") not in RETRY]


STOPWORDS = {"the", "and", "for", "its", "new", "now", "has", "are", "was", "with", "from", "over", "into", "after",
             "amid", "says", "will", "more", "than", "this", "that", "their", "about", "launches", "launch",
             "unveils", "announces", "plans", "major", "offers", "targets", "reveals", "addresses", "issues"}


def _stems(title: str) -> set[str]:
    words = re.findall(r"[a-z0-9]+", title.lower())
    return {w[:-1] if len(w) > 3 and w.endswith("s") else w
            for w in words if len(w) >= 3 and w not in STOPWORDS and not w.isdigit()}


def same_story(a: dict[str, Any], b: dict[str, Any]) -> bool:
    """Two feed topics about one event: the same thread, near-identical titles, or two shared distinctive words.

    Catches "Microsoft Announces Major Employee Buyouts" / "Microsoft Targets 60,000 Employees with Buyout
    Offers" and "Apple ... iPhone Duo Displays" / "iFixit ... iPhone Duo Screen", which plain word overlap misses.
    """
    thread_a, thread_b = a["topic"].get("thread_id"), b["topic"].get("thread_id")
    if thread_a and thread_a == thread_b:
        return True
    return _similar(a["title"], b["title"]) or len(_stems(a["title"]) & _stems(b["title"])) >= 2


def _coverage(topic: dict[str, Any]) -> int:
    try:
        return int(topic.get("source_count") or len(topic.get("articles") or []) or 1)
    except (TypeError, ValueError):
        return 1


def pick_reel_stories(
    topics: list[dict[str, Any]], posted: list[dict[str, Any]], ai: int = AI_STORIES, other: int = OTHER_STORIES
) -> list[dict[str, Any]]:
    """The top `ai` AI stories in feed order, then the `other` non-AI stories with the most outlets.

    Skips stories a recent reel used, promotional titles, stories the send-worthy
    judge turned down, ones without a summary, and near-duplicates of a pick.
    """
    posted_ids = {i for p in posted for i in p.get("topic_ids") or []}
    posted_urls = {u for p in posted for u in p.get("url_keys") or []}
    posted_titles = [t for p in posted for t in p.get("titles") or []]

    candidates: list[dict[str, Any]] = []
    for rank, topic in enumerate(topics):
        title = without_missing_glyphs(_clean(topic.get("title")))
        paragraphs = _paragraphs(_clean(topic.get("summary")))[:3]
        if not title or not paragraphs or topic.get("jev_send_worthy") == 0 or _looks_promotional(title):
            continue
        url_keys = {_url_key(a.get("url", "")) for a in topic.get("articles") or [] if isinstance(a, dict)} - {""}
        if topic.get("id") in posted_ids or url_keys & posted_urls or any(_similar(title, old) for old in posted_titles):
            continue
        candidates.append({
            "topic": topic, "rank": rank, "title": title, "paragraphs": paragraphs,
            "points": [_clean(p) for p in topic.get("key_points") or [] if _clean(p)][:5],
            "lane": str(topic.get("interest_id") or "tech"), "source": _source(topic)[0] or "Trace",
            "coverage": _coverage(topic), "url_keys": sorted(url_keys),
        })

    picked: list[dict[str, Any]] = []

    def take(pool: list[dict[str, Any]], limit: int) -> None:
        added = 0
        for story in pool:
            if added >= limit:
                break
            if any(same_story(story, p) for p in picked):
                continue
            picked.append(story)
            added += 1

    by_coverage = sorted(candidates, key=lambda c: (-c["coverage"], c["rank"]))
    take([c for c in candidates if c["lane"] == "ai"], ai)
    take([c for c in by_coverage if c["lane"] != "ai"], other)
    # A thin day in one category: fill up with the most-covered stories left.
    take([c for c in by_coverage if c not in picked], ai + other - len(picked))
    return picked


def caption_for(script: dict[str, Any], stories: list[dict[str, Any]]) -> str:
    """The opening line, the stories in the order they're read, the link, a few tags."""
    spoken = [stories[int(st["n"]) - 1] for st in script["stories"]]
    lines = [script["hook"], "", "In today's reel:"]
    lines += [f"{i}. {s['title']}" for i, s in enumerate(spoken, 1)]
    lines += ["", "Every story in full, free, at yourtrace.online (link in bio).",
              "Pictures and voice are AI-generated.", ""]
    tags = ["#technews", "#ainews"]
    for story in spoken:
        tag = HASHTAGS.get(story["lane"])
        if tag and tag not in tags:
            tags.append(tag)
    lines.append(" ".join(tags[:6] + ["#yourtrace"]))
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Hosting and Buffer
# ---------------------------------------------------------------------------


def host_reel(work: Path, folder: str) -> tuple[str, str]:
    """Copy the MP4 and cover under MEDIA_DIR and check both public URLs serve them."""
    target = MEDIA_DIR / folder
    target.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(work / "reel.mp4", target / "reel.mp4")
    shutil.copyfile(work / "cover.jpg", target / "cover.jpg")
    video_url, cover_url = f"{MEDIA_URL}/{folder}/reel.mp4", f"{MEDIA_URL}/{folder}/cover.jpg"
    for url, kind in ((video_url, "video/mp4"), (cover_url, "image/jpeg")):
        response = requests.head(url, timeout=20, allow_redirects=True)
        if response.status_code != 200 or response.headers.get("content-type", "").split(";")[0] != kind:
            raise RuntimeError(f"not served: {url} -> {response.status_code} {response.headers.get('content-type')}")
    return video_url, cover_url


def share_reel(channel_id: str, caption: str, video_url: str, cover_url: str) -> str:
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
            "assets": [{"video": {"url": video_url, "thumbnailUrl": cover_url}}],
            "metadata": {"instagram": {"type": "reel", "shouldShareToFeed": True, "isAiGenerated": True}},
        }},
    )
    result = data.get("createPost") or {}
    if (result.get("post") or {}).get("id"):
        return result["post"]["id"]
    kind = result.get("__typename") or ""
    codes = {str((e.get("extensions") or {}).get("code") or "") for e in errors}
    detail = f"{kind or ','.join(sorted(codes)) or 'no detail'}: {result.get('message') or errors or result}"[:500]
    if kind in REFUSED_TYPES or (errors and not kind and codes <= REFUSED_CODES):
        raise BufferRefused(f"Buffer refused the reel ({detail})")
    raise RuntimeError(f"Buffer returned no post id ({detail})")


def refresh_in_flight(store: V3Store, now: datetime) -> None:
    """Re-read earlier reels Buffer was still publishing when their run ended."""
    since = (now - timedelta(days=REPEAT_WINDOW_DAYS)).strftime("%Y-%m-%d")
    for doc in store.db.collection(COLLECTION).where("date", ">=", since).stream():
        record = doc.to_dict() or {}
        if record.get("status") in IN_FLIGHT and record.get("buffer_post_id"):
            refresh(doc.reference, record)


def prune_work(now: datetime) -> None:
    if not WORK_DIR.is_dir():
        return
    cutoff = now.timestamp() - KEEP_WORK_DAYS * 86400
    for folder in WORK_DIR.iterdir():
        if folder.is_dir() and folder.stat().st_mtime < cutoff:
            shutil.rmtree(folder, ignore_errors=True)


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------


SAVED_FIELDS = ("rank", "title", "paragraphs", "points", "lane", "source", "coverage", "url_keys")


def resume_stories(stories: list[dict[str, Any]], work: Path) -> list[dict[str, Any]]:
    """The stories this day's reel was made from. A retry after the feed changed keeps the first run's
    stories, so the voice, cards, caption and record always agree."""
    saved = work / "stories.json"
    if saved.exists():
        rows = json.loads(saved.read_text())
        return [{**{k: row[k] for k in SAVED_FIELDS}, "topic": {"id": row["id"]}} for row in rows]
    work.mkdir(parents=True, exist_ok=True)
    saved.write_text(json.dumps([{"id": str(s["topic"].get("id") or ""), **{k: s[k] for k in SAVED_FIELDS}}
                                 for s in stories], ensure_ascii=False, indent=1))
    return stories


def make_reel(stories: list[dict[str, Any]], work: Path, date: str) -> dict[str, Any]:
    """Script, pictures, voice and video in `work`; each step is kept so a retry can resume."""
    work.mkdir(parents=True, exist_ok=True)
    script_file = work / "script.json"
    if script_file.exists():
        script = reel_video.clean_script(json.loads(script_file.read_text()))
    else:
        script = reel_video.write_script(stories)
        script_file.write_text(json.dumps(script, indent=1, ensure_ascii=False))
    _log("script: " + reel_video.spoken_text(script))
    reel_video.make_images(script, work)
    timings_file = work / "timings.json"
    timings = json.loads(timings_file.read_text()) if timings_file.exists() and (work / "voice.mp3").exists() \
        else reel_video.make_voice(script, work)
    reel_video.render(script, stories, timings, work, datetime.strptime(date, "%Y-%m-%d").strftime("%b %-d"))
    return script


def run(args: argparse.Namespace) -> int:
    now = datetime.now(timezone.utc)
    date = now.strftime("%Y-%m-%d")
    doc_id = date + (f"-{now:%H%M%S}" if args.force else "")
    store = V3Store()
    ref = store.db.collection(COLLECTION).document(doc_id)

    if not os.getenv("RUNWAY_API_KEY", "").strip():
        _log("RUNWAY_API_KEY is not set; not making a reel")
        return 1
    if not args.dry_run:
        refresh_in_flight(store, now)
    existing = ref.get().to_dict() if not (args.dry_run or args.force) else None
    if existing:
        existing = refresh(ref, existing)
        if existing.get("status") not in RETRY:
            _log(f"{doc_id} already {existing.get('status')} {existing.get('external_link') or ''}; nothing to do")
            return 0

    topics, feed_date = load_topics(store, now)
    stories = pick_reel_stories(topics, [] if args.dry_run else recent_reels(store, now))
    _log(f"feed {feed_date}: {len(topics)} topics, picked {len(stories)}: "
         + " | ".join(f"[{s['lane']}, {s['coverage']} outlets] {s['title']}" for s in stories))
    if len(stories) < MIN_STORIES:
        _log(f"only {len(stories)} usable stories (need {MIN_STORIES}); not posting")
        return 1

    work = WORK_DIR / (doc_id if not args.dry_run else f"{doc_id}-dry")
    prune_work(now)
    if args.dry_run:
        shutil.rmtree(work, ignore_errors=True)  # a dry run always starts fresh
    stories = resume_stories(stories, work)
    script = make_reel(stories, work, date)
    caption = caption_for(script, stories)
    (work / "caption.txt").write_text(caption)
    record = {
        "date": date,
        "feed_date": feed_date,
        "voice": reel_video.VOICE,
        "topic_ids": [str(s["topic"].get("id") or "") for s in stories],
        "titles": [s["title"] for s in stories],
        "lanes": [s["lane"] for s in stories],
        "url_keys": sorted({k for s in stories for k in s["url_keys"]}),
        "script": reel_video.spoken_text(script),
        "caption": caption,
        "updated_at": now.isoformat(),
    }
    if args.dry_run:
        _log(f"dry run: reel, cover and caption in {work}")
        return 0

    prune_media(now)
    video_url, cover_url = host_reel(work, f"reel-{doc_id}-{uuid.uuid4().hex[:8]}")
    channel_id = instagram_channel()
    # Clear what an earlier, refused attempt left, so a later refresh can't read its old post.
    ref.set({**record, "status": "posting", "video_url": video_url, "created_at": now.isoformat(),
             "buffer_post_id": None, "external_link": "", "error": ""}, merge=True)
    try:
        post_id = share_reel(channel_id, caption, video_url, cover_url)
    except BufferRefused as exc:
        ref.set({"status": "failed", "error": str(exc)[:500]}, merge=True)
        _log(f"reel refused: {exc}")
        return 1
    except Exception as exc:
        ref.set({"status": "unknown", "error": str(exc)[:500]}, merge=True)
        _log(f"reel may or may not exist, not retrying (check Buffer): {exc}")
        return 0
    ref.set({"buffer_post_id": post_id}, merge=True)
    _log(f"shared to Buffer as {post_id}; waiting for Instagram")
    fields = _state_fields(wait_until_sent(post_id, timeout=1200))
    ref.set(fields, merge=True)
    _log(f"{doc_id}: {fields['status']} {fields['external_link']} {fields['error']}")
    if fields["status"] in IN_FLIGHT:
        _log("still processing on Instagram; the next run re-reads its status")
    return 1 if fields["status"] == "error" else 0


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true", help="make the reel in REEL_WORK_DIR; no hosting, posting or writes")
    parser.add_argument("--force", action="store_true", help="post again even if today's reel posted (logged separately)")
    sys.exit(run(parser.parse_args()))


if __name__ == "__main__":
    main()
