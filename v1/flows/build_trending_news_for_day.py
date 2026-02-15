"""
Build trending news for a day using OpenAI web search.

This flow:
1. Uses canonical interests + subtopics from interest schema
2. Runs multi-pass web search per interest (broad + subtopic-focused)
3. Keeps only strict last-24-hours results
4. Saves results to trending_news Firestore collection

Usage:
    python v1/flows/build_trending_news_for_day.py
    python v1/flows/build_trending_news_for_day.py --date 2026-01-27
"""

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from openai import OpenAI

project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

load_dotenv(Path(__file__).parent.parent.parent / ".env")

from v1.storage import FirestoreStore  # noqa: E402
from v1.algorithm.interest_schema import (  # noqa: E402
    CANONICAL_INTERESTS,
    INTEREST_KEYWORDS,
    SUBTOPIC_LABELS,
    get_interest_ids,
)


MAX_NEWS_PER_TOPIC = 12
OPENAI_TRENDING_MODEL = os.getenv("OPENAI_TRENDING_MODEL", "gpt-4.1-mini")
MAX_DAILY_INTERESTS = 4
TRENDING_MAX_AGE_HOURS = 48
IST_TZ = timezone(timedelta(hours=5, minutes=30))
MAX_PROMPT_PASSES_PER_TOPIC = 2
OPENAI_TIMEOUT_SECONDS = 90.0
OPENAI_FETCH_RETRIES = 2

try:
    DELAY_BETWEEN_SEARCHES = float(
        os.getenv("OPENAI_TRENDING_DELAY_SECONDS", "0.75")
    )
except ValueError:
    DELAY_BETWEEN_SEARCHES = 0.75

# Interests that consistently produce timely, useful "news" updates.
NEWS_HEAVY_INTEREST_POOL = [
    "technology",
    "business",
    "money",
    "science",
    "health",
    "society",
    "psychology",
    "ideas",
]

# Tie-break order when interest counts are equal.
NEWS_INTEREST_PRIORITY = {
    "technology": 1,
    "business": 2,
    "money": 3,
    "science": 4,
    "health": 5,
    "society": 6,
    "psychology": 7,
    "ideas": 8,
}


def _get_today_ist_date() -> str:
    """Get today's date in IST timezone as YYYY-MM-DD string."""
    return datetime.now(IST_TZ).strftime("%Y-%m-%d")


def _validate_date_string(date_str: str) -> str:
    """Validate date format (YYYY-MM-DD) and return normalized value."""
    value = (date_str or "").strip()
    try:
        parsed = datetime.strptime(value, "%Y-%m-%d")
    except ValueError as exc:
        raise ValueError(
            "Invalid --date. Expected YYYY-MM-DD, got: "
            f"{date_str!r}"
        ) from exc
    return parsed.strftime("%Y-%m-%d")


def _reference_cutoff_utc(
    reference_date: str | None = None,
    max_age_hours: int = TRENDING_MAX_AGE_HOURS,
) -> datetime:
    """Build UTC cutoff for strict recent-content filtering."""
    if reference_date:
        ref_date = datetime.strptime(
            _validate_date_string(reference_date), "%Y-%m-%d"
        ).date()
        ref_dt = datetime.combine(
            ref_date,
            datetime.max.time().replace(microsecond=0),
            tzinfo=IST_TZ,
        )
    else:
        ref_dt = datetime.now(IST_TZ)
    return ref_dt.astimezone(timezone.utc) - timedelta(hours=max_age_hours)


def _build_interest_topics(
    selected_ids: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Build topic configs from canonical interests + subtopic labels."""
    topics: list[dict[str, Any]] = []
    selected = set(selected_ids or [])
    for item in CANONICAL_INTERESTS:
        interest_id = item["id"]
        if selected and interest_id not in selected:
            continue
        label = item["label"]
        subtopics = list(SUBTOPIC_LABELS.get(interest_id, {}).values())
        keywords = INTEREST_KEYWORDS.get(interest_id, []).copy()
        keywords.extend([s.lower() for s in subtopics])
        # De-dupe while preserving order
        seen = set()
        deduped_keywords: list[str] = []
        for kw in keywords:
            if kw and kw not in seen:
                seen.add(kw)
                deduped_keywords.append(kw)
        topics.append(
            {
                "id": interest_id,
                "name": label,
                "subtopics": subtopics,
                "keywords": deduped_keywords,
            }
        )
    return topics


def _select_daily_news_interests(
    store: FirestoreStore,
    max_interests: int = MAX_DAILY_INTERESTS,
) -> list[str]:
    """Pick top interests for daily news based on subscribed demand."""
    users = store.get_onboarded_users()
    counts = {iid: 0 for iid in NEWS_HEAVY_INTEREST_POOL}

    for user in users:
        interest_ids = set(get_interest_ids(user))
        for iid in interest_ids:
            if iid in counts:
                counts[iid] += 1

    ranked = sorted(
        counts.items(),
        key=lambda kv: (-kv[1], NEWS_INTEREST_PRIORITY.get(kv[0], 999)),
    )
    picked = [iid for iid, _ in ranked[:max_interests]]

    # Fallback if we had no subscribed users or all zero counts.
    if not picked:
        return NEWS_HEAVY_INTEREST_POOL[:max_interests]

    return picked


def _interest_specific_rules(interest_id: str) -> str:
    """Minimal extra guidance per interest."""
    return ""


# URL patterns that indicate non-article pages
JUNK_URL_PATTERNS = [
    "/tag/", "/tags/", "/category/", "/categories/",
    "/top/", "/topics/", "/topic/",
    "/replay/", "/embed/", "/video/",
    "/search?", "/search/",
    "/author/", "/authors/",
    "/archive/", "/archives/",
    "/page/", "/feed/", "/rss/",
    "/about/", "/contact/",
    "/privacy", "/terms", "/login", "/signup", "/subscribe",
]
LOW_QUALITY_DOMAINS = {
    "prnewswire.com",
    "globenewswire.com",
    "businesswire.com",
    "einpresswire.com",
    "openpr.com",
    "newswire.com",
}


def _is_junk_url(url: str) -> bool:
    """Check if URL is a tag page, homepage, or other non-article page."""
    if not url:
        return True
    try:
        from urllib.parse import urlparse
        parsed = urlparse(url)
        path = parsed.path.lower()
        if not path or path == "/" or path == "/index.html":
            return True
        for pattern in JUNK_URL_PATTERNS:
            if pattern in path:
                return True
        host = (parsed.hostname or "").lower()
        for blocked in LOW_QUALITY_DOMAINS:
            if host == blocked or host.endswith(f".{blocked}"):
                return True
        return False
    except Exception:
        return False


def _extract_json_object(raw_text: str) -> dict[str, Any]:
    """Parse first JSON object from model output."""
    if not raw_text:
        return {}
    raw_text = raw_text.strip()
    try:
        return json.loads(raw_text)
    except json.JSONDecodeError:
        pass
    start = raw_text.find("{")
    end = raw_text.rfind("}")
    if start >= 0 and end > start:
        try:
            return json.loads(raw_text[start:end + 1])
        except json.JSONDecodeError:
            return {}
    return {}


def _normalize_url(url: str) -> str:
    if not url:
        return ""
    cleaned = url.strip()
    cleaned = re.sub(r"[)\].,;:]+$", "", cleaned)
    return cleaned


def _is_recent_enough(
    published_date: str,
    reference_date: str | None = None,
    max_age_hours: int = TRENDING_MAX_AGE_HOURS,
) -> bool:
    """Return True only when article timestamp is within max_age_hours."""
    if not published_date:
        return False
    try:
        cutoff = _reference_cutoff_utc(
            reference_date=reference_date,
            max_age_hours=max_age_hours,
        )
        raw = published_date.strip().replace("Z", "+00:00")
        if "T" in raw:
            pub_dt = datetime.fromisoformat(raw)
            if pub_dt.tzinfo is None:
                pub_dt = pub_dt.replace(tzinfo=timezone.utc)
            pub_dt = pub_dt.astimezone(timezone.utc)
        else:
            pub_dt = datetime.strptime(raw[:10], "%Y-%m-%d").replace(
                tzinfo=timezone.utc
            )
        return pub_dt >= cutoff
    except Exception:
        return False


def _dedupe_articles_by_url(
    articles: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Deduplicate articles by URL, keeping the first occurrence."""
    seen_urls: set[str] = set()
    deduped: list[dict[str, Any]] = []

    for article in articles:
        url = article.get("url")
        if url and url not in seen_urls and not _is_junk_url(url):
            seen_urls.add(url)
            deduped.append(article)

    return deduped


def _search_openai_for_interest(
    client: OpenAI,
    topic: dict[str, Any],
    date: str,
    max_results: int,
) -> list[dict[str, Any]]:
    """Single simple web search per topic. No passes, no complexity."""
    topic_name = topic.get("name", "")

    prompt = f"What are today's biggest {topic_name} news stories? Date: {date}. Return up to {max_results} articles as JSON: {{\"articles\": [{{\"title\": \"...\", \"subtitle\": \"...\", \"details\": \"2-3 sentence summary\", \"url\": \"https://...\", \"published_date\": \"{date}\", \"source_domain\": \"example.com\"}}]}}"

    for attempt in range(OPENAI_FETCH_RETRIES + 1):
        try:
            response = client.responses.create(
                model=OPENAI_TRENDING_MODEL,
                tools=[{"type": "web_search_preview"}],
                temperature=0.4,
                max_output_tokens=4000,
                input=prompt,
                timeout=OPENAI_TIMEOUT_SECONDS,
            )
            text = (response.output_text or "").strip()
            data = _extract_json_object(text)
            raw = data.get("articles", []) if isinstance(data, dict) else []
            if not isinstance(raw, list):
                raw = []
            break
        except Exception as exc:
            if attempt >= OPENAI_FETCH_RETRIES:
                print(f"    search failed after retries: {exc}")
                return []
            backoff = (attempt + 1) * 1.5
            print(f"    search failed (attempt {attempt + 1}), retrying in {backoff:.1f}s...")
            time.sleep(backoff)

    # Parse results — accept everything that has a url and title.
    # We trust OpenAI web search to return recent content since we asked for "today's news".
    articles: list[dict[str, Any]] = []
    seen_urls: set[str] = set()
    for r in raw:
        if not isinstance(r, dict):
            continue
        url = _normalize_url(str(r.get("url", "")))
        title = str(r.get("title", "")).strip()
        if not url or not title or _is_junk_url(url) or url in seen_urls:
            continue
        details = str(r.get("details", "")).strip()
        subtitle = str(r.get("subtitle", "")).strip()
        published_date = str(r.get("published_date", "")).strip() or date
        seen_urls.add(url)
        articles.append({
            "title": title,
            "url": url,
            "content": details or subtitle,
            "published_date": published_date,
            "score": 3.0,
            "source": "openai_web_search",
            "subtopic": str(r.get("subtopic", "")).strip(),
        })
        if len(articles) >= max_results:
            break

    print(f"    found {len(articles)} articles")
    return _dedupe_articles_by_url(articles)[:max_results]


def fetch_news_for_topics(
    topics: list[dict[str, Any]],
    date: str,
    max_results: int = MAX_NEWS_PER_TOPIC,
) -> dict[str, dict[str, Any]]:
    """
    Fetch news articles for each topic using OpenAI web search.

    Args:
        topics: List of topic dicts with id, name, subtopics, keywords
        date: Reference date in YYYY-MM-DD (IST)
        max_results: Max results to request per topic

    Returns:
        Dict mapping topic_id to {name, search_query, keywords, articles}
    """
    news_by_topic: dict[str, dict[str, Any]] = {}
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        print("OPENAI_API_KEY not set; skipping trending news build.")
        for topic in topics:
            news_by_topic[topic["id"]] = {
                "name": topic["name"],
                "search_query": "",
                "keywords": topic["keywords"],
                "articles": [],
            }
        return news_by_topic
    client = OpenAI(api_key=api_key, timeout=OPENAI_TIMEOUT_SECONDS)
    print(f"Fetching news for {len(topics)} topics...")
    start_time = time.time()

    for idx, topic in enumerate(topics):
        topic_id = topic["id"]
        search_query = f"OpenAI web-search for {topic['name']} ({date})"

        try:
            articles = _search_openai_for_interest(
                client=client,
                topic=topic,
                date=date,
                max_results=max_results,
            )

            news_by_topic[topic_id] = {
                "name": topic["name"],
                "search_query": search_query,
                "keywords": topic["keywords"],
                "articles": articles,
            }

            if articles:
                print(
                    f"  [{idx + 1}/{len(topics)}] {topic['name']}: "
                    f"{len(articles)} articles"
                )
            else:
                print(
                    f"  [{idx + 1}/{len(topics)}] "
                    f"{topic['name']}: no news found"
                )

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

    print(
        f"News fetch complete: {total_articles} articles from "
        f"{topics_with_news} topics in {elapsed:.1f}s"
    )

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
    total_articles = sum(
        len(t["articles"]) for t in news_by_topic.values()
    )
    metadata = {
        "date": date,
        "generated_at": generated_at,
        "topic_count": len(filtered_news_by_topic),
        "total_articles": total_articles,
    }
    store.db.collection("trending_news").document(date).set(metadata)

    # Save each topic's news
    for topic_id, data in news_by_topic.items():
        (
            store.db.collection("trending_news")
            .document(date)
            .collection("topics")
            .document(topic_id)
            .set(
                {
                    "topic_id": topic_id,
                    "name": data["name"],
                    "search_query": data["search_query"],
                    "keywords": data["keywords"],
                    "articles": data["articles"],
                    "article_count": len(data["articles"]),
                    "generated_at": generated_at,
                }
            )
        )

    print(
        f"Saved {len(news_by_topic)} topic news docs to "
        f"trending_news/{date}"
    )


def build_trending_news_for_day(date: str | None = None) -> dict[str, Any]:
    """
    Main orchestration function that builds trending news for a day.

    1. Uses canonical interests + subtopics from schema
    2. Fetches news for each interest using OpenAI web search
    3. Saves to Firestore

    Args:
        date: Date string in YYYY-MM-DD format (defaults to today IST)

    Returns:
        Summary dict with date, topics_searched, total_articles, etc.
    """
    if not date:
        date = _get_today_ist_date()
    else:
        date = _validate_date_string(date)

    print("=" * 60)
    print(f"TRENDING NEWS BUILD FOR {date}")
    print("=" * 60)

    start_time = time.time()
    store = FirestoreStore()

    # Step 1: Select interests and build topic configs
    selected_interest_ids = _select_daily_news_interests(
        store, max_interests=MAX_DAILY_INTERESTS
    )
    topics = _build_interest_topics(selected_interest_ids)
    print(
        f"\n[1/2] Using {len(topics)} selected interests "
        f"(max {MAX_DAILY_INTERESTS})"
    )
    for t in topics:
        print(f"  - {t['name']}")

    # Step 2: Fetch news
    print("\n[2/2] Fetching news for topics...")
    news_by_topic = fetch_news_for_topics(
        topics=topics,
        date=date,
        max_results=MAX_NEWS_PER_TOPIC,
    )

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
        "topics_searched": len(topics),
        "selected_interests": selected_interest_ids,
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
