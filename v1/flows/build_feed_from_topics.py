"""
Build a simple feed for a single user using topic pools.

For each user interest:
- Find matching topic doc
- Pick 2 blogs + 2 discussions not in seen URLs
- Save to user_feeds and update user_seen_urls

Trending news is added separately via add_trending_news_to_feed.py

Usage:
  python v1/flows/build_feed_from_topics.py --user_id USER_ID
  python v1/flows/build_feed_from_topics.py --user_id USER_ID --skip-seen
"""
import argparse
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable

project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env")

from v1.storage import FirestoreStore


MAX_FEED_ITEMS = 10


def _normalize_interest(interest: str) -> str:
    return (interest.lower().strip()
            .replace(" ", "-")
            .replace("&", "and")
            .replace("/", "-")
            .replace("\\", "-")
            .replace("(", "")
            .replace(")", ""))


def _title_matches_topic(title: str, topic_name: str) -> bool:
    """Check if an article title is roughly related to the topic."""
    if not title or not topic_name:
        return False
    
    title_lower = title.lower()
    topic_lower = topic_name.lower()
    
    # Split topic into keywords
    topic_words = set(topic_lower.replace("-", " ").split())
    # Remove common filler words
    filler_words = {"the", "a", "an", "in", "on", "for", "to", "and", "or", "of", "with"}
    topic_words = topic_words - filler_words
    
    # Check if any topic keyword appears in title
    for word in topic_words:
        if len(word) >= 3 and word in title_lower:
            return True
    
    # Also check the full topic phrase
    topic_phrase = topic_lower.replace("-", " ")
    if topic_phrase in title_lower:
        return True
    
    return False


def _get_why_relevant(title: str, topic_name: str, topic_kind: str) -> str:
    """Generate appropriate why_relevant text based on actual relevance."""
    if _title_matches_topic(title, topic_name):
        if topic_kind == "hobby":
            return f"Matches your hobby in {topic_name}"
        else:
            return f"Matches your interest in {topic_name}"
    else:
        # Fallback for items that don't clearly match
        return "Curated for you"


def _get_today_ist_date() -> str:
    ist_tz = timezone(timedelta(hours=5, minutes=30))
    return datetime.now(ist_tz).strftime("%Y-%m-%d")


def _dedupe_preserve_order(items: Iterable[dict]) -> list[dict]:
    seen = set()
    deduped = []
    for item in items:
        url = item.get("url") if isinstance(item, dict) else None
        if url and url not in seen:
            seen.add(url)
            deduped.append(item)
    return deduped


def _get_user_seen_urls(store: FirestoreStore, user_id: str) -> set[str]:
    doc = store.db.collection("user_seen_urls").document(user_id).get()
    if not doc.exists:
        return set()
    data = doc.to_dict() or {}
    urls_dict = data.get("urls", {}) or {}
    return set(urls_dict.keys())


def _update_seen_urls(store: FirestoreStore, user_id: str, urls: list[str]) -> None:
    now = datetime.utcnow().isoformat()
    urls_update = {url: now for url in urls}

    doc_ref = store.db.collection("user_seen_urls").document(user_id)
    doc = doc_ref.get()

    if doc.exists:
        existing = doc.to_dict().get("urls", {}) or {}
        existing.update(urls_update)
        doc_ref.update({
            "urls": existing,
            "updated_at": now,
        })
    else:
        doc_ref.set({
            "urls": urls_update,
            "updated_at": now,
        })


def _mark_previous_feed_seen(store: FirestoreStore, user_id: str, date: str) -> None:
    try:
        prev_date = (datetime.strptime(date, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")
    except ValueError:
        return
    feed_doc = (
        store.db.collection("user_feeds")
        .document(user_id)
        .collection("daily")
        .document(prev_date)
        .get()
    )
    if not feed_doc.exists:
        return
    feed_data = feed_doc.to_dict() or {}
    items = feed_data.get("items", []) or []
    urls = [item.get("url") for item in items if item.get("url")]
    if urls:
        _update_seen_urls(store, user_id, urls)


def _pick_urls(
    items: list[dict],
    limit: int,
    seen_urls: set[str],
    chosen_urls: set[str],
) -> list[dict]:
    picked = []
    for item in items:
        url = item.get("url")
        if not url:
            continue
        if url in chosen_urls:
            continue
        if url in seen_urls:
            continue
        picked.append(item)
        chosen_urls.add(url)
        if len(picked) >= limit:
            break
    return picked


def build_feed_from_topics(
    user_id: str,
    date: str | None = None,
    skip_seen: bool = False,
    force: bool = False,
) -> dict:
    store = FirestoreStore()
    profile = store.get_user_profile(user_id)
    if not profile:
        raise ValueError(f"User {user_id} not found")

    if not date:
        date = _get_today_ist_date()

    # Check if feed already exists
    if not force:
        existing = store.db.collection("user_feeds").document(user_id).collection("daily").document(date).get()
        if existing.exists:
            return {
                "user_id": user_id,
                "date": date,
                "items_written": 0,
                "skipped": True,
                "reason": "feed_exists",
            }

    interests = profile.get("interests", []) or []
    interests = [
        i.strip()
        for i in interests
        if isinstance(i, str) and i.strip()
    ]
    interests = list(dict.fromkeys(interests))

    hobbies = profile.get("hobbies", []) or []
    hobbies = [
        h.strip()
        for h in hobbies
        if isinstance(h, str) and h.strip()
    ]
    hobbies = list(dict.fromkeys(hobbies))[:3]

    seen_urls = set()
    if not skip_seen:
        _mark_previous_feed_seen(store, user_id, date)
        seen_urls = _get_user_seen_urls(store, user_id)

    items = []
    chosen_urls: set[str] = set()

    for interest in interests:
        topic_id = _normalize_interest(interest)
        doc = store.db.collection("topics").document(topic_id).get()
        if not doc.exists:
            continue
        topic = doc.to_dict() or {}
        latest = topic.get("latest", {}) or {}
        raw_blogs = latest.get("blogs", []) or []
        raw_discussions = latest.get("discussions", []) or []
        blogs = _dedupe_preserve_order([
            b if isinstance(b, dict) else {"url": b, "title": ""}
            for b in raw_blogs
        ])
        discussions = _dedupe_preserve_order([
            d if isinstance(d, dict) else {"url": d, "title": ""}
            for d in raw_discussions
        ])

        picked_blogs = _pick_urls(blogs, 2, seen_urls, chosen_urls)
        picked_discussions = _pick_urls(discussions, 2, seen_urls, chosen_urls)

        for idx, item in enumerate(picked_blogs):
            title = item.get("title", "")
            items.append({
                "id": f"topic_{topic_id}_blog_{idx}_{date}",
                "type": "blog",
                "title": title,
                "description": "",
                "url": item.get("url", ""),
                "tags": [topic_id],
                "source": "exa",
                "metadata": {
                    "why_relevant": _get_why_relevant(title, interest, "interest"),
                    "feed_category": "topics",
                },
            })

        for idx, item in enumerate(picked_discussions):
            title = item.get("title", "")
            items.append({
                "id": f"topic_{topic_id}_discussion_{idx}_{date}",
                "type": "discussion",
                "title": title,
                "description": "",
                "url": item.get("url", ""),
                "tags": [topic_id],
                "source": "exa",
                "metadata": {
                    "why_relevant": _get_why_relevant(title, interest, "interest"),
                    "feed_category": "topics",
                },
            })

    for hobby in hobbies:
        topic_id = _normalize_interest(hobby)
        doc = store.db.collection("topics").document(topic_id).get()
        if not doc.exists:
            continue
        topic = doc.to_dict() or {}
        latest = topic.get("latest", {}) or {}
        raw_blogs = latest.get("blogs", []) or []
        raw_videos = latest.get("videos", []) or []
        blogs = _dedupe_preserve_order([
            b if isinstance(b, dict) else {"url": b, "title": ""}
            for b in raw_blogs
        ])
        videos = _dedupe_preserve_order([
            v if isinstance(v, dict) else {"url": v, "title": ""}
            for v in raw_videos
        ])

        picked_blogs = _pick_urls(blogs, 1, seen_urls, chosen_urls)
        picked_videos = _pick_urls(videos, 1, seen_urls, chosen_urls)

        for idx, item in enumerate(picked_blogs):
            title = item.get("title", "")
            items.append({
                "id": f"topic_{topic_id}_blog_{idx}_{date}",
                "type": "blog",
                "title": title,
                "description": "",
                "url": item.get("url", ""),
                "tags": [topic_id],
                "source": "exa",
                "metadata": {
                    "why_relevant": _get_why_relevant(title, hobby, "hobby"),
                    "feed_category": "topics",
                },
            })

        for idx, item in enumerate(picked_videos):
            title = item.get("title", "")
            items.append({
                "id": f"topic_{topic_id}_video_{idx}_{date}",
                "type": "video",
                "title": title,
                "description": "",
                "url": item.get("url", ""),
                "thumbnail": item.get("thumbnail"),
                "tags": [topic_id],
                "source": "youtube",
                "metadata": {
                    "why_relevant": _get_why_relevant(title, hobby, "hobby"),
                    "feed_category": "topics",
                },
            })

    random.shuffle(items)
    if len(items) > MAX_FEED_ITEMS:
        items = items[:MAX_FEED_ITEMS]

    feed_data = {
        "date": date,
        "items": items,
        "generated_at": datetime.utcnow().isoformat(),
        "metadata": {
            "version": "topics_v1",
            "item_count": len(items),
            "source_counts": {
                "blog": sum(1 for i in items if i.get("type") == "blog"),
                "discussion": sum(1 for i in items if i.get("type") == "discussion"),
                "video": sum(1 for i in items if i.get("type") == "video"),
            },
            "skip_seen": skip_seen,
        },
    }

    store.db.collection("user_feeds").document(user_id).collection("daily").document(date).set(feed_data)

    return {
        "user_id": user_id,
        "date": date,
        "items_written": len(items),
        "skip_seen": skip_seen,
    }


def main():
    parser = argparse.ArgumentParser(description="Build a feed from topics for one user")
    parser.add_argument("--user_id", required=True, help="User ID to build feed for")
    parser.add_argument("--date", help="Date string (YYYY-MM-DD), defaults to today IST")
    parser.add_argument("--skip-seen", action="store_true", help="Skip seen URL filtering and updates")
    args = parser.parse_args()

    result = build_feed_from_topics(
        user_id=args.user_id,
        date=args.date,
        skip_seen=args.skip_seen,
    )
    print(f"Done. Items written: {result['items_written']}")


if __name__ == "__main__":
    main()
