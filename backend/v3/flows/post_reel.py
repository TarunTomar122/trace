"""Post Trace's daily reel to Instagram through Buffer.

  cd backend
  ../.venv/bin/python -m v3.flows.post_reel --dry-run      # make the reel in REEL_WORK_DIR, no hosting or posting
  ../.venv/bin/python -m v3.flows.post_reel                # make it, host it, share it now

trace-reel.timer runs it at 14:00 GMT. Each run shortlists the best-covered
stories of the last 24 hours in any category (one per event, skipping anything
a reel used in the last few days) and has the script model pick the 5 most
interesting, falling back to coverage order. v3.lib.reel_video writes a plain
newsreader script for them (checked for facts and AI-sounding phrasing),
generates two pictures per story and Elliot's voice through Runway, fetches each
story's company logo from Wikimedia Commons, and renders a 1080x1920 MP4 with
subtitles. The file is served by Caddy from
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
STORIES = 5
MIN_STORIES = 4
# Stories updated within this window are eligible; the editor chooses from the best-covered few.
RECENT_HOURS = 24
SHORTLIST = 12
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


# Words that say nothing about which event a headline is about. Checked in base form ("files", "filed" -> "file").
STOPWORDS = {"the", "and", "for", "its", "new", "now", "has", "are", "was", "with", "from", "over", "into", "after",
             "amid", "say", "says", "said", "will", "more", "than", "this", "that", "their", "about", "launch", "unveil", "announce",
             "plan", "major", "offer", "target", "reveal", "address", "issue", "file", "display", "feature",
             "billion", "million", "trillion", "invest", "investment", "secure", "fund", "funding", "raise", "round",
             "series", "deal", "stake", "record", "value", "valuation", "model", "tool", "enhance", "update", "upgrade",
             # headline openers that aren't the company ("Report: Apple ...", "AI Startup Mistral ...")
             "report", "reports", "exclusive", "breaking", "startup", "analysis", "opinion", "source", "watch"}
AMOUNT = re.compile(r"[$€£]\s?(\d[\d,]*(?:\.\d+)?)\s*(trillion|billion|million|bn|tn|[mbk])?\b", re.I)


def _base_forms(word: str) -> set[str]:
    """The word and its base forms of 4+ letters ("files" -> "file", "secured" -> "secure"). Shorter bases are
    left out so names survive: "Ford" is not "for", "News" is not "new"."""
    forms = {word}
    for end in ("s", "es", "ed", "d"):
        if len(word) - len(end) >= 4 and word.endswith(end):
            forms.add(word[: -len(end)])
    return forms


def _stem_list(title: str) -> list[str]:
    """Distinctive words in order (plural "s" dropped), plus amounts like "$13 billion" as one token ("13b")."""
    out: list[str] = []
    for w in re.findall(r"[a-z0-9]+", title.lower().replace("'s ", " ")):
        if len(w) < 3 or w.isdigit() or _base_forms(w) & STOPWORDS:
            continue
        stem = w[:-1] if len(w) > 3 and w.endswith("s") else w
        if stem not in out:
            out.append(stem)
    for number, unit in AMOUNT.findall(title):
        out.append(f"{number.replace(',', '')}{(unit or '')[:1].lower()}")
    return out


def _stems(title: str) -> set[str]:
    return set(_stem_list(title))


def _lead(title: str) -> str:
    """The headline's first distinctive word, usually the company: "Apple Launches ..." -> "apple"."""
    words = _stem_list(title)
    return words[0] if words else title.lower()


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


def _updated_hours_ago(topic: dict[str, Any], now: datetime) -> float | None:
    for field in ("last_updated_at", "first_seen_at"):
        raw = topic.get(field)
        try:
            when = raw if isinstance(raw, datetime) else datetime.fromisoformat(str(raw or "").replace("Z", "+00:00"))
        except ValueError:
            continue
        if when.tzinfo is None:
            when = when.replace(tzinfo=timezone.utc)
        return (now - when).total_seconds() / 3600
    return None


def _popularity(topic: dict[str, Any]) -> float:
    try:
        return float(topic.get("popularity_score") or 0.0)
    except (TypeError, ValueError):
        return 0.0


def reel_candidates(topics: list[dict[str, Any]], posted: list[dict[str, Any]], now: datetime) -> list[dict[str, Any]]:
    """Feed stories updated in the last RECENT_HOURS that a reel can use.

    Skips stories a recent reel used, promotional titles, stories the send-worthy
    judge turned down, and ones without a summary. A story with no timestamp is kept.
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
        age = _updated_hours_ago(topic, now)
        if age is not None and age > RECENT_HOURS:
            continue
        url_keys = {_url_key(a.get("url", "")) for a in topic.get("articles") or [] if isinstance(a, dict)} - {""}
        if topic.get("id") in posted_ids or url_keys & posted_urls or any(_similar(title, old) for old in posted_titles):
            continue
        candidates.append({
            "topic": topic, "rank": rank, "title": title, "paragraphs": paragraphs,
            "lane": str(topic.get("interest_id") or "tech"), "source": _source(topic)[0] or "Trace",
            "coverage": _coverage(topic), "url_keys": sorted(url_keys),
        })
    return candidates


def shortlist(candidates: list[dict[str, Any]], size: int = SHORTLIST) -> list[dict[str, Any]]:
    """The best-covered stories, one per event: most outlets, then the feed's popularity, then feed order."""
    ordered = sorted(candidates, key=lambda c: (-c["coverage"], -_popularity(c["topic"]), c["rank"]))
    picked: list[dict[str, Any]] = []
    for story in ordered:
        if len(picked) >= size:
            break
        if not any(same_story(story, p) for p in picked):
            picked.append(story)
    return picked


EDITOR_PROMPT = """You choose the stories for Trace's daily one-minute news reel on Instagram. The audience is curious
people who follow tech and business news but are not specialists.

From the shortlist below, choose the {count} most interesting stories of the last 24 hours. Interesting means many
people would care or be surprised, and something concrete happened: a launch, a deal, a ruling, a decision, a
number. Prefer real developments over opinion pieces, newsletters, explainers and small funding rounds. AI,
business, gadgets, apps, robotics and startups count equally; pick on interest, not category.

Make the set varied: never two stories about the same company or the same event, and not all from one category.

Shortlist (key | category | outlets covering it | headline | summary):
{items}

Return JSON: {{"picks": ["key", ...]}} with exactly {count} keys from the shortlist, most interesting first."""


def _brief(text: str, limit: int = 320) -> str:
    text = text.replace("|", "/")
    return text if len(text) <= limit else text[:limit].rsplit(" ", 1)[0] + "..."


def editor_pick(stories: list[dict[str, Any]], count: int) -> list[int]:
    """Indexes into `stories`, most interesting first, as the script model judges them.

    Returns only what the model chose (unknown keys dropped); pick_reel_stories fills any gap in coverage order.
    """
    count = min(count, len(stories))
    if len(stories) < MIN_STORIES:
        return []  # not enough for a reel anyway; don't spend a call
    items = "\n".join(
        f"s{k} | {s['lane']} | {s['coverage']} | {_brief(s['title'], 200)} | {_brief(' '.join(s['paragraphs']))}"
        for k, s in enumerate(stories)
    )
    chosen: list[int] = []
    try:
        picks = reel_video._ask(EDITOR_PROMPT.format(count=count, items=items), "low").get("picks") or []
        for key in picks if isinstance(picks, list) else []:
            match = re.fullmatch(r"s?(\d+)", str(key).strip(), re.I)
            k = int(match.group(1)) if match else -1
            if 0 <= k < len(stories) and k not in chosen:
                chosen.append(k)
    except Exception as exc:  # the reel still goes out on coverage order
        _log(f"editor pick failed ({exc}); using coverage order")
        return []
    if len(chosen) < count:
        _log(f"editor picked {len(chosen)} usable stories of {count}; filling in coverage order")
    return chosen[:count]


def pick_reel_stories(
    topics: list[dict[str, Any]], posted: list[dict[str, Any]], now: datetime | None = None,
    count: int = STORIES, choose: Any = editor_pick,
) -> list[dict[str, Any]]:
    """The `count` most interesting stories of the last day, in any category: one per event and per company.

    The editor's choices come first; coverage order fills the rest. A pick that leads with the same company
    as an earlier one ("Apple ...", "Apple ...") is skipped, whoever chose it.
    """
    short = shortlist(reel_candidates(topics, posted, now or datetime.now(timezone.utc)))
    order = [k for k in choose(short, count) if 0 <= k < len(short)] if short else []
    order += [k for k in range(len(short)) if k not in order]
    picked: list[dict[str, Any]] = []
    for k in order:
        if len(picked) >= count:
            break
        if _lead(short[k]["title"]) not in {_lead(p["title"]) for p in picked}:
            picked.append(short[k])
    return picked


def caption_for(script: dict[str, Any], stories: list[dict[str, Any]]) -> str:
    """The opening line, the stories in the order they're read, the link, a few tags."""
    spoken = [stories[int(st["n"]) - 1] for st in script["stories"]]
    lines = [script["hook"], "", "In today's reel:"]
    lines += [f"{i}. {s['title']}" for i, s in enumerate(spoken, 1)]
    lines += ["", "Every story in full, free, at yourtrace.online (link in bio).",
              "Pictures and voice are AI-generated.", ""]
    tags = ["#technews"]
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


SAVED_FIELDS = ("rank", "title", "paragraphs", "lane", "source", "coverage", "url_keys")


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
    reel_video.make_logos(script, work)
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

    work = WORK_DIR / (doc_id if not args.dry_run else f"{doc_id}-dry")
    prune_work(now)
    if args.dry_run:
        shutil.rmtree(work, ignore_errors=True)  # a dry run always starts fresh
    topics, feed_date = load_topics(store, now)
    if (work / "stories.json").exists():  # a retry: same stories as the first run, no new pick
        stories = resume_stories([], work)
        verb = "resumed"
    else:
        stories = pick_reel_stories(topics, [] if args.dry_run else recent_reels(store, now), now)
        verb = "picked"
    _log(f"feed {feed_date}: {len(topics)} topics, {verb} {len(stories)}: "
         + " | ".join(f"[{s['lane']}, {s['coverage']} outlets] {s['title']}" for s in stories))
    if len(stories) < MIN_STORIES:
        _log(f"only {len(stories)} usable stories (need {MIN_STORIES}); not posting")
        return 1
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
