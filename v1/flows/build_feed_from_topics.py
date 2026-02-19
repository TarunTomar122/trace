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
from v1.algorithm.interest_schema import (
    build_query_id,
    get_interest_ids,
    get_interest_label,
    get_interest_queries,
    normalize_query_text,
)


MAX_FEED_ITEMS = 25  # Subscribed users get more content
MIN_QUERY_POOL_ITEMS = 4

# Extended keyword map for interests whose names are too short/generic
# to match article titles directly. Maps interest_id → extra keywords.
_INTEREST_KEYWORDS: dict[str, list[str]] = {
    "technology": ["tech", "software", "hardware", "digital", "computing", "internet", "app", "startup", "code", "programming", "developer", "engineering", "algorithm", "blockchain", "cloud", "cyber"],
    "business-market": ["business", "market", "startup", "entrepreneur", "company", "founder", "revenue", "customer", "strategy", "product strategy", "market trends", "economy", "economic", "marketing"],
    "experience": ["ux", "ui", "design", "visual", "branding", "creative process", "storytelling", "user psychology", "research", "interface", "prototype", "figma"],
    "productivity": ["productivity", "career growth", "personal finance", "investments", "wellbeing", "wellness", "soft skills", "focus", "execution", "habits", "planning"],
}


def _normalize_interest(interest: str) -> str:
    return (interest.lower().strip()
            .replace(" ", "-")
            .replace("&", "and")
            .replace("/", "-")
            .replace("\\", "-")
            .replace("(", "")
            .replace(")", ""))


def _title_matches_topic(title: str, topic_name: str, interest_id: str | None = None) -> bool:
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
    
    # Add extended keywords if available
    if interest_id and interest_id in _INTEREST_KEYWORDS:
        topic_words.update(_INTEREST_KEYWORDS[interest_id])
    
    # Check if any topic keyword appears in title
    for word in topic_words:
        if len(word) >= 3 and word in title_lower:
            return True
    
    # Also check the full topic phrase
    topic_phrase = topic_lower.replace("-", " ")
    if topic_phrase in title_lower:
        return True
    
    return False


def _get_why_relevant(title: str, topic_name: str, topic_kind: str, query_text: str | None = None, interest_id: str | None = None) -> str:
    """Generate appropriate why_relevant text based on actual relevance."""
    if _title_matches_topic(title, topic_name, interest_id=interest_id):
        if topic_kind == "hobby":
            return f"Matches your hobby in {topic_name}"
        if query_text:
            return f"Matches your interest in {topic_name} · {query_text}"
        return f"Matches your interest in {topic_name}"
    return "Curated for you"


def _pool_item_count(latest: dict) -> int:
    blogs = latest.get("blogs", []) or []
    discussions = latest.get("discussions", []) or []
    return len(blogs) + len(discussions)


def _load_interest_pools(
    store: FirestoreStore,
    interest_id: str,
    interest_queries: dict[str, list[str]],
) -> list[dict]:
    pools: list[dict] = []
    raw_queries = interest_queries.get(interest_id, [])[:2]
    for raw in raw_queries:
        query_text = normalize_query_text(interest_id, raw)
        query_id = build_query_id(query_text)
        doc_ref = (
            store.db.collection("topics")
            .document(interest_id)
            .collection("__q")
            .document(query_id)
        )
        doc = doc_ref.get()
        if not doc.exists:
            continue
        data = doc.to_dict() or {}
        pools.append({"latest": data.get("latest", {}) or {}, "query_text": query_text})

    if pools:
        total_items = sum(_pool_item_count(p["latest"]) for p in pools)
        if total_items >= MIN_QUERY_POOL_ITEMS:
            return pools

    doc = store.db.collection("topics").document(interest_id).get()
    if not doc.exists:
        return []
    data = doc.to_dict() or {}
    return [{"latest": data.get("latest", {}) or {}, "query_text": None}]


def _merge_pool_items(pools: list[dict], key: str) -> list[dict]:
    merged = []
    for pool in pools:
        latest = pool.get("latest", {}) or {}
        items = latest.get(key, []) or []
        for item in items:
            if isinstance(item, dict):
                url = item.get("url")
                title = item.get("title", "")
                payload = {**item, "url": url, "title": title}
            else:
                payload = {"url": item, "title": ""}
            payload["query_text"] = pool.get("query_text")
            merged.append(payload)
    return _dedupe_preserve_order(merged)


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


def _is_junk_url(url: str) -> bool:
    """Quick check for homepage/archive URLs that slipped into pools."""
    if not url:
        return True
    from urllib.parse import urlparse
    try:
        parsed = urlparse(url)
        host = parsed.hostname or ""
        path = (parsed.path or "").lower().rstrip("/")
        # Bare domain / homepage
        if not path or path == "/" or path == "/index.html":
            return True
        # Blog index pages
        if path in ("/blog", "/blogs", "/articles", "/posts", "/news",
                     "/newsletter", "/latest", "/stories"):
            return True
        # Blogspot date archives (e.g. /2024/03/)
        import re
        if "blogspot" in host and re.match(r"^/\d{4}(/\d{2})?/?$", path):
            return True
        # Medium publication pages (single-segment path without article hash)
        if "medium.com" in host and re.match(r"^/[a-z0-9][\w-]*/?$", path):
            return True
        # Beehiiv bare archive
        if "beehiiv.com" in host and len([s for s in path.split("/") if s]) == 0:
            return True
        return False
    except Exception:
        return False


def _pick_urls(
    items: list[dict],
    limit: int,
    seen_urls: set[str],
    chosen_urls: set[str],
    interest_id: str | None = None,
    topic_name: str | None = None,
) -> list[dict]:
    """Pick items, prioritizing those whose title matches the topic."""
    relevant = []
    other = []
    for item in items:
        url = item.get("url")
        if not url or url in chosen_urls or url in seen_urls:
            continue
        if _is_junk_url(url):
            continue
        title = item.get("title", "")
        if topic_name and _title_matches_topic(title, topic_name, interest_id=interest_id):
            relevant.append(item)
        else:
            other.append(item)

    # Pick from relevant first, then fill from other
    picked = []
    for item in relevant + other:
        picked.append(item)
        chosen_urls.add(item["url"])
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

    interest_ids = get_interest_ids(profile)
    interest_queries = get_interest_queries(profile)

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

    for interest_id in interest_ids:
        pools = _load_interest_pools(store, interest_id, interest_queries)
        if not pools:
            continue
        interest_label = get_interest_label(interest_id)
        blogs = _merge_pool_items(pools, "blogs")
        discussions = _merge_pool_items(pools, "discussions")

        picked_blogs = _pick_urls(blogs, 2, seen_urls, chosen_urls,
                                  interest_id=interest_id, topic_name=interest_label)
        picked_discussions = _pick_urls(discussions, 2, seen_urls, chosen_urls,
                                        interest_id=interest_id, topic_name=interest_label)

        for idx, item in enumerate(picked_blogs):
            title = item.get("title", "")
            query_text = item.get("query_text")
            items.append({
                "id": f"topic_{interest_id}_blog_{idx}_{date}",
                "type": "blog",
                "title": title,
                "description": "",
                "url": item.get("url", ""),
                "tags": [interest_id],
                "source": "exa",
                "metadata": {
                    "why_relevant": _get_why_relevant(title, interest_label, "interest", query_text, interest_id=interest_id),
                    "feed_category": "topics",
                },
            })

        for idx, item in enumerate(picked_discussions):
            title = item.get("title", "")
            query_text = item.get("query_text")
            items.append({
                "id": f"topic_{interest_id}_discussion_{idx}_{date}",
                "type": "discussion",
                "title": title,
                "description": "",
                "url": item.get("url", ""),
                "tags": [interest_id],
                "source": "exa",
                "metadata": {
                    "why_relevant": _get_why_relevant(title, interest_label, "interest", query_text, interest_id=interest_id),
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

        picked_blogs = _pick_urls(blogs, 1, seen_urls, chosen_urls,
                                  topic_name=hobby)
        picked_videos = _pick_urls(videos, 1, seen_urls, chosen_urls,
                                   topic_name=hobby)

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
    parser.add_argument("--force", action="store_true", help="Rebuild even if feed already exists for date")
    args = parser.parse_args()

    result = build_feed_from_topics(
        user_id=args.user_id,
        date=args.date,
        skip_seen=args.skip_seen,
        force=args.force,
    )
    print(f"Done. Items written: {result['items_written']}")


if __name__ == "__main__":
    main()
