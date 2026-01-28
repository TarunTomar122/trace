"""
Build trending news for a day using umbrella categories.

This flow:
1. Fetches umbrella categories from Firestore
2. Searches Tavily for news articles for each umbrella's search_query
3. Saves results to trending_news Firestore collection

Instead of searching 100+ topics, we search ~18 umbrellas.

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


MAX_NEWS_PER_UMBRELLA = 5
DELAY_BETWEEN_SEARCHES = 0.3


def _get_today_ist_date() -> str:
    """Get today's date in IST timezone as YYYY-MM-DD string."""
    ist_tz = timezone(timedelta(hours=5, minutes=30))
    return datetime.now(ist_tz).strftime("%Y-%m-%d")


def get_umbrellas(store: FirestoreStore) -> list[dict[str, Any]]:
    """
    Fetch umbrella categories from Firestore.

    Returns:
        List of umbrella dicts with id, name, search_query, topic_names
    """
    docs = store.db.collection("umbrellas").stream()
    umbrellas = []
    for doc in docs:
        data = doc.to_dict() or {}
        umbrellas.append({
            "id": doc.id,
            "name": data.get("name", doc.id),
            "search_query": data.get("search_query", doc.id),
            "topic_names": data.get("topic_names", []),
        })
    return umbrellas


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


def fetch_news_for_umbrellas(
    umbrellas: list[dict[str, Any]],
    days: int = 1,
    max_results: int = 8,
) -> dict[str, dict[str, Any]]:
    """
    Fetch news articles for each umbrella using Tavily API.

    Args:
        umbrellas: List of umbrella dicts with id, name, search_query
        days: Number of days to look back for news (default: 1)
        max_results: Max results to request from Tavily (default: 8)

    Returns:
        Dict mapping umbrella_id to {name, search_query, articles}
    """
    news_by_umbrella: dict[str, dict[str, Any]] = {}

    print(f"Fetching news for {len(umbrellas)} umbrellas...")
    start_time = time.time()

    for idx, umbrella in enumerate(umbrellas):
        umbrella_id = umbrella["id"]
        search_query = umbrella["search_query"]

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
            articles = _dedupe_articles_by_url(articles)[:MAX_NEWS_PER_UMBRELLA]

            news_by_umbrella[umbrella_id] = {
                "name": umbrella["name"],
                "search_query": search_query,
                "topic_names": umbrella.get("topic_names", []),
                "articles": articles,
            }

            if articles:
                print(f"  [{idx + 1}/{len(umbrellas)}] {umbrella['name']}: {len(articles)} articles")
            else:
                print(f"  [{idx + 1}/{len(umbrellas)}] {umbrella['name']}: no news found")

        except Exception as e:
            print(f"  [{idx + 1}/{len(umbrellas)}] {umbrella['name']}: error - {e}")
            news_by_umbrella[umbrella_id] = {
                "name": umbrella["name"],
                "search_query": search_query,
                "topic_names": umbrella.get("topic_names", []),
                "articles": [],
            }

        # Small delay to avoid rate limits
        if idx < len(umbrellas) - 1:
            time.sleep(DELAY_BETWEEN_SEARCHES)

    elapsed = time.time() - start_time
    total_articles = sum(len(u["articles"]) for u in news_by_umbrella.values())
    umbrellas_with_news = sum(1 for u in news_by_umbrella.values() if u["articles"])

    print(f"News fetch complete: {total_articles} articles from {umbrellas_with_news} umbrellas in {elapsed:.1f}s")

    return news_by_umbrella


def save_trending_news(
    store: FirestoreStore,
    date: str,
    news_by_umbrella: dict[str, dict[str, Any]],
) -> None:
    """
    Save trending news to Firestore.

    Structure: trending_news/{date}/umbrellas/{umbrella_id}
    """
    generated_at = datetime.now(timezone.utc).isoformat()

    # Save metadata doc
    total_articles = sum(len(u["articles"]) for u in news_by_umbrella.values())
    metadata = {
        "date": date,
        "generated_at": generated_at,
        "umbrella_count": len(news_by_umbrella),
        "total_articles": total_articles,
    }
    store.db.collection("trending_news").document(date).set(metadata)

    # Save each umbrella's news
    for umbrella_id, data in news_by_umbrella.items():
        store.db.collection("trending_news").document(date).collection("umbrellas").document(umbrella_id).set({
            "umbrella_id": umbrella_id,
            "name": data["name"],
            "search_query": data["search_query"],
            "topic_names": data["topic_names"],
            "articles": data["articles"],
            "article_count": len(data["articles"]),
            "generated_at": generated_at,
        })

    print(f"Saved {len(news_by_umbrella)} umbrella news docs to trending_news/{date}")


def build_trending_news_for_day(date: str | None = None) -> dict[str, Any]:
    """
    Main orchestration function that builds trending news for a day.

    1. Fetches umbrellas from Firestore
    2. Fetches news for each umbrella
    3. Saves to Firestore

    Args:
        date: Date string in YYYY-MM-DD format (defaults to today IST)

    Returns:
        Summary dict with date, umbrellas_searched, total_articles, etc.
    """
    if not date:
        date = _get_today_ist_date()

    print("=" * 60)
    print(f"TRENDING NEWS BUILD FOR {date}")
    print("=" * 60)

    start_time = time.time()
    store = FirestoreStore()

    # Step 1: Fetch umbrellas
    print("\n[1/3] Fetching umbrellas from Firestore...")
    umbrellas = get_umbrellas(store)
    print(f"Found {len(umbrellas)} umbrellas")

    if not umbrellas:
        print("No umbrellas found. Run build_umbrellas.py first.")
        return {
            "date": date,
            "umbrellas_searched": 0,
            "total_articles": 0,
            "status": "no_umbrellas",
        }

    # Step 2: Fetch news
    print("\n[2/3] Fetching news for umbrellas...")
    news_by_umbrella = fetch_news_for_umbrellas(umbrellas, days=1)

    # Step 3: Save to Firestore
    print("\n[3/3] Saving to Firestore...")
    save_trending_news(store, date, news_by_umbrella)

    elapsed = time.time() - start_time
    total_articles = sum(len(u["articles"]) for u in news_by_umbrella.values())
    umbrellas_with_news = sum(1 for u in news_by_umbrella.values() if u["articles"])

    print("\n" + "=" * 60)
    print("TRENDING NEWS BUILD COMPLETE")
    print("=" * 60)
    print(f"  Date: {date}")
    print(f"  Umbrellas searched: {len(umbrellas)}")
    print(f"  Umbrellas with news: {umbrellas_with_news}")
    print(f"  Total articles: {total_articles}")
    print(f"  Elapsed time: {elapsed:.1f}s")

    return {
        "date": date,
        "umbrellas_searched": len(umbrellas),
        "total_articles": total_articles,
        "umbrellas_with_news": umbrellas_with_news,
        "elapsed_seconds": round(elapsed, 1),
        "status": "success",
    }


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Build trending news for a day using umbrella categories"
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
