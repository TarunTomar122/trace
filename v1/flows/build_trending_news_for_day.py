"""
Build trending news for a day using hardcoded topics.

This flow:
1. Uses 10 hardcoded trending topics (no Firestore dependency)
2. Searches Tavily for news articles for each topic
3. Saves results to trending_news Firestore collection

Usage:
    python v1/flows/build_trending_news_for_day.py
    python v1/flows/build_trending_news_for_day.py --date 2026-01-27
"""

import argparse
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent.parent / ".env")

from v1.storage import FirestoreStore
from v1.algorithm.tavily_search import tavily_search


MAX_NEWS_PER_TOPIC = 5
DELAY_BETWEEN_SEARCHES = 0.3

# 10 hardcoded trending topics with keywords for user matching
TRENDING_TOPICS = [
    {
        "id": "mental-wellness",
        "name": "Mental Wellness",
        "search_query": "mental wellness habits stress anxiety mindfulness news",
        "keywords": ["mental wellness", "mindfulness", "stress", "anxiety", "wellbeing", "self care"],
    },
    {
        "id": "health-fitness",
        "name": "Health & Fitness",
        "search_query": "health fitness habits nutrition exercise news",
        "keywords": ["health", "fitness", "exercise", "nutrition", "workout", "wellness"],
    },
    {
        "id": "relationships",
        "name": "Relationships",
        "search_query": "relationships communication habits psychology news",
        "keywords": ["relationships", "communication", "family", "friendship", "dating", "marriage"],
    },
    {
        "id": "money",
        "name": "Money & Personal Finance",
        "search_query": "personal finance budgeting saving investing news",
        "keywords": ["money", "personal finance", "budgeting", "saving", "investing", "debt"],
    },
    {
        "id": "career",
        "name": "Career & Work",
        "search_query": "career growth workplace jobs hiring news",
        "keywords": ["career", "work", "jobs", "hiring", "salary", "workplace"],
    },
    {
        "id": "learning",
        "name": "Learning & Skills",
        "search_query": "learning skills education study tips news",
        "keywords": ["learning", "skills", "education", "study", "courses", "training"],
    },
    {
        "id": "productivity",
        "name": "Productivity",
        "search_query": "productivity habits focus time management news",
        "keywords": ["productivity", "focus", "time management", "habits", "planning"],
    },
    {
        "id": "creativity",
        "name": "Creativity",
        "search_query": "creativity inspiration writing art music news",
        "keywords": ["creativity", "writing", "art", "music", "design", "inspiration"],
    },
    {
        "id": "travel",
        "name": "Travel & Adventure",
        "search_query": "travel tips destinations adventure news",
        "keywords": ["travel", "destinations", "adventure", "trips", "tourism"],
    },
    {
        "id": "culture",
        "name": "Culture & Entertainment",
        "search_query": "culture entertainment books movies tv music news",
        "keywords": ["culture", "entertainment", "books", "movies", "tv", "music"],
    },
]


def _get_today_ist_date() -> str:
    """Get today's date in IST timezone as YYYY-MM-DD string."""
    ist_tz = timezone(timedelta(hours=5, minutes=30))
    return datetime.now(ist_tz).strftime("%Y-%m-%d")


def _dedupe_articles_by_url(articles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Deduplicate articles by URL, keeping the first occurrence."""
    seen_urls: set[str] = set()
    deduped: list[dict[str, Any]] = []

    for article in articles:
        url = article.get("url")
        if url and url not in seen_urls:
            seen_urls.add(url)
            deduped.append(article)

    return deduped


def fetch_news_for_topics(
    topics: list[dict[str, Any]],
    days: int = 1,
    max_results: int = 8,
) -> dict[str, dict[str, Any]]:
    """
    Fetch news articles for each topic using Tavily API.

    Args:
        topics: List of topic dicts with id, name, search_query, keywords
        days: Number of days to look back for news (default: 1)
        max_results: Max results to request from Tavily (default: 8)

    Returns:
        Dict mapping topic_id to {name, search_query, keywords, articles}
    """
    news_by_topic: dict[str, dict[str, Any]] = {}

    topics = topics[:10]
    print(f"Fetching news for {len(topics)} topics...")
    start_time = time.time()

    for idx, topic in enumerate(topics):
        topic_id = topic["id"]
        search_query = topic["search_query"]

        try:
            results = tavily_search(
                query=search_query,
                max_results=max_results,
                days=days,
                topic="news",
                search_depth="basic",
            )

            articles = []
            for r in results:
                article = {
                    "title": r.get("title", ""),
                    "url": r.get("url", ""),
                    "content": r.get("content", ""),
                    "published_date": r.get("published_date", ""),
                    "score": r.get("score"),
                    "source": "tavily",
                }
                articles.append(article)

            # Dedupe by URL and limit
            articles = _dedupe_articles_by_url(articles)[:MAX_NEWS_PER_TOPIC]

            news_by_topic[topic_id] = {
                "name": topic["name"],
                "search_query": search_query,
                "keywords": topic["keywords"],
                "articles": articles,
            }

            if articles:
                print(f"  [{idx + 1}/{len(topics)}] {topic['name']}: {len(articles)} articles")
            else:
                print(f"  [{idx + 1}/{len(topics)}] {topic['name']}: no news found")

        except Exception as e:
            print(f"  [{idx + 1}/{len(topics)}] {topic['name']}: error - {e}")
            news_by_topic[topic_id] = {
                "name": topic["name"],
                "search_query": search_query,
                "keywords": topic["keywords"],
                "articles": [],
            }

        # Small delay to avoid rate limits
        if idx < len(topics) - 1:
            time.sleep(DELAY_BETWEEN_SEARCHES)

    elapsed = time.time() - start_time
    total_articles = sum(len(t["articles"]) for t in news_by_topic.values())
    topics_with_news = sum(1 for t in news_by_topic.values() if t["articles"])

    print(f"News fetch complete: {total_articles} articles from {topics_with_news} topics in {elapsed:.1f}s")

    return news_by_topic


def save_trending_news(
    store: FirestoreStore,
    date: str,
    news_by_topic: dict[str, dict[str, Any]],
) -> None:
    """
    Save trending news to Firestore.

    Structure: trending_news/{date}/topics/{topic_id}
    """
    generated_at = datetime.now(timezone.utc).isoformat()

    # Save metadata doc
    total_articles = sum(len(t["articles"]) for t in news_by_topic.values())
    metadata = {
        "date": date,
        "generated_at": generated_at,
        "topic_count": len(news_by_topic),
        "total_articles": total_articles,
    }
    store.db.collection("trending_news").document(date).set(metadata)

    # Save each topic's news
    for topic_id, data in news_by_topic.items():
        store.db.collection("trending_news").document(date).collection("topics").document(topic_id).set({
            "topic_id": topic_id,
            "name": data["name"],
            "search_query": data["search_query"],
            "keywords": data["keywords"],
            "articles": data["articles"],
            "article_count": len(data["articles"]),
            "generated_at": generated_at,
        })

    print(f"Saved {len(news_by_topic)} topic news docs to trending_news/{date}")


def build_trending_news_for_day(date: str | None = None) -> dict[str, Any]:
    """
    Main orchestration function that builds trending news for a day.

    1. Uses hardcoded topics (no Firestore lookup needed)
    2. Fetches news for each topic
    3. Saves to Firestore

    Args:
        date: Date string in YYYY-MM-DD format (defaults to today IST)

    Returns:
        Summary dict with date, topics_searched, total_articles, etc.
    """
    if not date:
        date = _get_today_ist_date()

    print("=" * 60)
    print(f"TRENDING NEWS BUILD FOR {date}")
    print("=" * 60)

    start_time = time.time()
    store = FirestoreStore()

    # Step 1: Use hardcoded topics
    topics = TRENDING_TOPICS[:10]
    print(f"\n[1/2] Using {len(topics)} hardcoded topics")
    for t in topics:
        print(f"  - {t['name']}")

    # Step 2: Fetch news
    print("\n[2/2] Fetching news for topics...")
    news_by_topic = fetch_news_for_topics(topics, days=1)

    # Step 3: Save to Firestore
    print("\nSaving to Firestore...")
    save_trending_news(store, date, news_by_topic)

    elapsed = time.time() - start_time
    total_articles = sum(len(t["articles"]) for t in news_by_topic.values())
    topics_with_news = sum(1 for t in news_by_topic.values() if t["articles"])

    print("\n" + "=" * 60)
    print("TRENDING NEWS BUILD COMPLETE")
    print("=" * 60)
    print(f"  Date: {date}")
    print(f"  Topics searched: {len(topics)}")
    print(f"  Topics with news: {topics_with_news}")
    print(f"  Total articles: {total_articles}")
    print(f"  Elapsed time: {elapsed:.1f}s")

    return {
        "date": date,
        "topics_searched": len(TRENDING_TOPICS),
        "total_articles": total_articles,
        "topics_with_news": topics_with_news,
        "elapsed_seconds": round(elapsed, 1),
        "status": "success",
    }


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Build trending news for a day using hardcoded topics"
    )
    parser.add_argument(
        "--date",
        help="Date to build news for (YYYY-MM-DD), defaults to today IST",
    )

    args = parser.parse_args()

    try:
        result = build_trending_news_for_day(date=args.date)
        if result.get("status") == "success":
            print(f"\nSuccess! {result['total_articles']} articles saved.")
            sys.exit(0)
        else:
            print(f"\nCompleted with status: {result.get('status')}")
            sys.exit(0)
    except Exception as e:
        print(f"\nError: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
