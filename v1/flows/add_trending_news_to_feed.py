"""
Append trending news items to a user's existing feed.

This script reads from the cached trending_news collection (umbrella-based)
and adds relevant news items to the user's feed.

Two-step process:
1. Run build_trending_news_for_day.py first (caches news by umbrella)
2. Run this script to add news to user feeds

Usage:
    python v1/flows/add_trending_news_to_feed.py --user_id USER_ID
    python v1/flows/add_trending_news_to_feed.py --user_id USER_ID --date 2026-01-28
"""
import argparse
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env")

from v1.storage import FirestoreStore


MAX_NEWS_PER_FEED = 5
MAX_NEWS_PER_UMBRELLA = 2


def _get_today_ist_date() -> str:
    ist_tz = timezone(timedelta(hours=5, minutes=30))
    return datetime.now(ist_tz).strftime("%Y-%m-%d")


def _get_user_seen_urls(store: FirestoreStore, user_id: str) -> set[str]:
    doc = store.db.collection("user_seen_urls").document(user_id).get()
    if not doc.exists:
        return set()
    data = doc.to_dict() or {}
    urls_dict = data.get("urls", {}) or {}
    return set(urls_dict.keys())


def _normalize_topic_name(name: str) -> str:
    """Normalize topic name for matching (lowercase, stripped)."""
    return name.lower().strip()


def _get_trending_news_for_user(
    store: FirestoreStore,
    user_topics: set[str],
    date: str,
    seen_urls: set[str],
    existing_urls: set[str],
) -> list[dict[str, Any]]:
    """
    Get trending news articles from umbrellas matching user's topics.

    Args:
        store: FirestoreStore instance
        user_topics: Set of user's topic names (normalized lowercase)
        date: Date string (YYYY-MM-DD)
        seen_urls: URLs the user has seen before
        existing_urls: URLs already in the feed

    Returns:
        List of news articles (max 5, max 2 per umbrella)
    """
    # Fetch all umbrella news for the date
    umbrella_docs = (
        store.db.collection("trending_news")
        .document(date)
        .collection("umbrellas")
        .stream()
    )

    # Find umbrellas that match user's topics
    matching_umbrellas: list[dict[str, Any]] = []

    for doc in umbrella_docs:
        data = doc.to_dict() or {}
        umbrella_topic_names = data.get("topic_names", [])

        # Normalize umbrella topic names for matching
        normalized_umbrella_topics = {
            _normalize_topic_name(t) for t in umbrella_topic_names
        }

        # Check if any user topic matches
        if user_topics & normalized_umbrella_topics:
            articles = data.get("articles", [])
            # Filter out seen/existing URLs
            filtered_articles = [
                a for a in articles
                if a.get("url")
                and a["url"] not in seen_urls
                and a["url"] not in existing_urls
            ]
            if filtered_articles:
                matching_umbrellas.append({
                    "umbrella_id": doc.id,
                    "name": data.get("name", doc.id),
                    "articles": filtered_articles,
                })

    if not matching_umbrellas:
        return []

    # Select articles with diversity (max 2 per umbrella, up to 5 total)
    selected: list[dict] = []
    umbrella_counts: dict[str, int] = {}

    random.shuffle(matching_umbrellas)

    while len(selected) < MAX_NEWS_PER_FEED:
        added_this_round = False
        for umbrella in matching_umbrellas:
            if len(selected) >= MAX_NEWS_PER_FEED:
                break
            uid = umbrella["umbrella_id"]
            if umbrella_counts.get(uid, 0) >= MAX_NEWS_PER_UMBRELLA:
                continue
            articles = umbrella["articles"]
            idx = umbrella_counts.get(uid, 0)
            if idx < len(articles):
                article = articles[idx].copy()
                article["_umbrella_id"] = uid
                article["_umbrella_name"] = umbrella["name"]
                selected.append(article)
                umbrella_counts[uid] = idx + 1
                added_this_round = True

        if not added_this_round:
            break

    return selected


def add_trending_news_to_feed(
    user_id: str,
    date: str | None = None,
) -> dict[str, Any]:
    """
    Append trending news items to a user's existing feed.

    Args:
        user_id: User ID to add news for
        date: Date string (YYYY-MM-DD), defaults to today IST

    Returns:
        Summary dict with items_added count
    """
    store = FirestoreStore()
    profile = store.get_user_profile(user_id)
    if not profile:
        raise ValueError(f"User {user_id} not found")

    if not date:
        date = _get_today_ist_date()

    # Get existing feed
    feed_ref = (
        store.db.collection("user_feeds")
        .document(user_id)
        .collection("daily")
        .document(date)
    )
    feed_doc = feed_ref.get()
    feed_data = feed_doc.to_dict() if feed_doc.exists else None

    if not feed_data:
        print(f"  No existing feed for {user_id} on {date}")
        return {"user_id": user_id, "date": date, "items_added": 0}

    existing_items = feed_data.get("items", [])
    existing_urls = {i.get("url") for i in existing_items if i.get("url")}

    # Check if trending news already added
    has_trending = any(
        i.get("metadata", {}).get("feed_category") == "trending_news"
        for i in existing_items
    )
    if has_trending:
        print(f"  Trending news already added for {user_id}")
        return {"user_id": user_id, "date": date, "items_added": 0}

    # Gather user's topics (normalized for matching)
    interests = profile.get("interests", []) or []
    hobbies = profile.get("hobbies", []) or []
    user_topics: set[str] = set()

    for interest in interests:
        if isinstance(interest, str) and interest.strip():
            user_topics.add(_normalize_topic_name(interest))
    for hobby in hobbies:
        if isinstance(hobby, str) and hobby.strip():
            user_topics.add(_normalize_topic_name(hobby))

    if not user_topics:
        print(f"  No topics found for {user_id}")
        return {"user_id": user_id, "date": date, "items_added": 0}

    seen_urls = _get_user_seen_urls(store, user_id)

    # Get trending news from matching umbrellas
    trending_articles = _get_trending_news_for_user(
        store, user_topics, date, seen_urls, existing_urls
    )

    if not trending_articles:
        print(f"  No matching trending news for {user_id}")
        return {"user_id": user_id, "date": date, "items_added": 0}

    # Build news items
    items_to_add = []
    for idx, article in enumerate(trending_articles):
        umbrella_name = article.get("_umbrella_name", "Trending")
        umbrella_id = article.get("_umbrella_id", "trending")
        url = article.get("url", "")

        items_to_add.append({
            "id": f"trending_{umbrella_id}_{idx}_{date}",
            "type": "news",
            "title": article.get("title", ""),
            "description": article.get("content", ""),
            "url": url,
            "tags": [umbrella_id],
            "source": "tavily",
            "metadata": {
                "why_relevant": f"Trending in {umbrella_name}",
                "feed_category": "trending_news",
                "is_hot": True,
                "published_date": article.get("published_date", ""),
            },
        })

    # Append to feed and shuffle
    new_items = existing_items + items_to_add
    random.shuffle(new_items)

    # Update feed
    feed_data["items"] = new_items
    feed_data["generated_at"] = datetime.utcnow().isoformat()
    feed_data.setdefault("metadata", {})
    feed_data["metadata"]["item_count"] = len(new_items)

    # Update source counts
    source_counts = feed_data["metadata"].get("source_counts", {})
    source_counts["news"] = len(items_to_add)
    feed_data["metadata"]["source_counts"] = source_counts

    feed_ref.set(feed_data, merge=True)

    print(f"  Added {len(items_to_add)} trending news items")

    return {
        "user_id": user_id,
        "date": date,
        "items_added": len(items_to_add),
        "umbrellas_matched": list(
            set(a.get("_umbrella_id") for a in trending_articles)
        ),
    }


def main():
    parser = argparse.ArgumentParser(
        description="Add trending news to a user's feed"
    )
    parser.add_argument(
        "--user_id",
        required=True,
        help="User ID to add news for",
    )
    parser.add_argument(
        "--date",
        help="Date string (YYYY-MM-DD), defaults to today IST",
    )

    args = parser.parse_args()

    result = add_trending_news_to_feed(
        user_id=args.user_id,
        date=args.date,
    )
    print(f"Done. Items added: {result['items_added']}")


if __name__ == "__main__":
    main()
