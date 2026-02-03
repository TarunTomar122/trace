"""
Append trending news items to a user's existing feed.

This script reads from the cached trending_news collection (topic-based)
and adds relevant news items to the user's feed by matching keywords.

Two-step process:
1. Run build_trending_news_for_day.py first (caches news by topic)
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
MAX_NEWS_PER_TOPIC = 2

ROLE_KEYWORDS = {
    "founder": ["founder", "startup", "startups", "entrepreneur", "bootstrapping", "launch"],
    "ux designer": ["ux", "ui", "design", "product design", "user research"],
    "software engineer": ["software", "engineering", "developer", "programming", "code"],
    "marketing": ["marketing", "growth", "seo", "copywriting", "distribution"],
    "student": ["learning", "beginner", "study", "career"],
}

ROLE_MATCHERS = {
    "founder": ["founder", "entrepreneur", "indie", "startup"],
    "ux designer": ["ux", "ui", "product designer", "designer"],
    "software engineer": ["software engineer", "engineer", "developer", "programmer"],
    "marketing": ["marketing", "growth", "brand", "demand gen"],
    "student": ["student", "learner"],
}


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


def _normalize(text: str) -> str:
    """Normalize text for matching (lowercase, stripped)."""
    return text.lower().strip()


def _get_role_keywords(role: str | None) -> list[str]:
    role_value = (role or "").strip().lower()
    if not role_value:
        return []
    for key, matchers in ROLE_MATCHERS.items():
        if any(m in role_value for m in matchers):
            return ROLE_KEYWORDS.get(key, [])
    return []


def _user_matches_topic(user_interests: set[str], topic_keywords: list[str]) -> bool:
    """
    Check if any user interest matches any topic keyword.
    
    Uses substring matching - if a keyword appears in any interest or vice versa.
    """
    normalized_keywords = {_normalize(k) for k in topic_keywords}
    
    for interest in user_interests:
        interest_lower = _normalize(interest)
        # Direct match
        if interest_lower in normalized_keywords:
            return True
        # Substring match (keyword in interest or interest in keyword)
        for keyword in normalized_keywords:
            if keyword in interest_lower or interest_lower in keyword:
                return True
    return False


def _get_trending_news_for_user(
    store: FirestoreStore,
    user_interests: set[str],
    date: str,
    seen_urls: set[str],
    existing_urls: set[str],
) -> list[dict[str, Any]]:
    """
    Get trending news articles from topics matching user's interests.

    Args:
        store: FirestoreStore instance
        user_interests: Set of user's interests + hobbies (normalized lowercase)
        date: Date string (YYYY-MM-DD)
        seen_urls: URLs the user has seen before
        existing_urls: URLs already in the feed

    Returns:
        List of news articles (max 5, max 2 per topic)
    """
    # Fetch all topic news for the date
    topic_docs = (
        store.db.collection("trending_news")
        .document(date)
        .collection("topics")
        .stream()
    )

    # Find topics that match user's interests via keywords
    matching_topics: list[dict[str, Any]] = []

    for doc in topic_docs:
        data = doc.to_dict() or {}
        keywords = data.get("keywords", [])

        # Check if user interests match this topic's keywords
        if _user_matches_topic(user_interests, keywords):
            articles = data.get("articles", [])
            # Filter out seen/existing URLs
            filtered_articles = [
                a for a in articles
                if a.get("url")
                and a["url"] not in seen_urls
                and a["url"] not in existing_urls
            ]
            if filtered_articles:
                matching_topics.append({
                    "topic_id": doc.id,
                    "name": data.get("name", doc.id),
                    "articles": filtered_articles,
                })

    if not matching_topics:
        return []

    # Select articles with diversity (max 2 per topic, up to 5 total)
    selected: list[dict] = []
    topic_counts: dict[str, int] = {}

    random.shuffle(matching_topics)

    while len(selected) < MAX_NEWS_PER_FEED:
        added_this_round = False
        for topic in matching_topics:
            if len(selected) >= MAX_NEWS_PER_FEED:
                break
            tid = topic["topic_id"]
            if topic_counts.get(tid, 0) >= MAX_NEWS_PER_TOPIC:
                continue
            articles = topic["articles"]
            idx = topic_counts.get(tid, 0)
            if idx < len(articles):
                article = articles[idx].copy()
                article["_topic_id"] = tid
                article["_topic_name"] = topic["name"]
                selected.append(article)
                topic_counts[tid] = idx + 1
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

    # Gather user's interests + hobbies (normalized for matching)
    interests = profile.get("interests", []) or []
    hobbies = profile.get("hobbies", []) or []
    user_interests: set[str] = set()

    for interest in interests:
        if isinstance(interest, str) and interest.strip():
            user_interests.add(_normalize(interest))
    for hobby in hobbies:
        if isinstance(hobby, str) and hobby.strip():
            user_interests.add(_normalize(hobby))

    role_keywords = _get_role_keywords(profile.get("role"))
    for keyword in role_keywords:
        user_interests.add(_normalize(keyword))

    if not user_interests:
        print(f"  No interests found for {user_id}")
        return {"user_id": user_id, "date": date, "items_added": 0}

    seen_urls = _get_user_seen_urls(store, user_id)

    # Get trending news from matching topics
    trending_articles = _get_trending_news_for_user(
        store, user_interests, date, seen_urls, existing_urls
    )

    if not trending_articles:
        print(f"  No matching trending news for {user_id}")
        return {"user_id": user_id, "date": date, "items_added": 0}

    # Build news items
    items_to_add = []
    for idx, article in enumerate(trending_articles):
        topic_name = article.get("_topic_name", "Trending")
        topic_id = article.get("_topic_id", "trending")
        url = article.get("url", "")

        items_to_add.append({
            "id": f"trending_{topic_id}_{idx}_{date}",
            "type": "news",
            "title": article.get("title", ""),
            "description": article.get("content", ""),
            "url": url,
            "tags": [topic_id],
            "source": "tavily",
            "metadata": {
                "why_relevant": f"Trending in {topic_name}",
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
        "topics_matched": list(
            set(a.get("_topic_id") for a in trending_articles)
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
