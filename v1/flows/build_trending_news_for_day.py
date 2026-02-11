"""
Build trending news for a day using OpenAI web search.

This flow:
1. Uses canonical interests + subtopics from interest schema
2. Runs one global web-search query per interest for last 24h
3. Saves results to trending_news Firestore collection

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


MAX_NEWS_PER_TOPIC = 8
DELAY_BETWEEN_SEARCHES = 0.2
OPENAI_TRENDING_MODEL = os.getenv("OPENAI_TRENDING_MODEL", "gpt-4.1-mini")
MAX_DAILY_INTERESTS = 5

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
    ist_tz = timezone(timedelta(hours=5, minutes=30))
    return datetime.now(ist_tz).strftime("%Y-%m-%d")


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
    """Extra retrieval guidance per interest for higher-quality results."""
    rules = {
        "technology": (
            "- Prioritize release artifacts: launch posts, release notes, "
            "API/docs updates, major feature rollouts.\n"
            "- De-prioritize stock/market commentary unless tied to concrete "
            "product release.\n"
            "- Ensure breadth across tech practice areas when possible: "
            "software engineering, developer tools, infrastructure/cloud, "
            "AI/agents, and design/productivity tooling."
        ),
        "business": (
            "- Prioritize concrete business moves: funding, M&A, major "
            "product/strategy launches, leadership changes with impact.\n"
            "- Avoid generic opinion pieces on startup culture."
        ),
        "money": (
            "- Prioritize direct-impact updates: policy/rate/tax "
            "changes, market events, consumer finance rule updates.\n"
            "- Avoid evergreen personal finance explainers."
        ),
        "science": (
            "- Prioritize new findings, mission milestones, and credible "
            "institutional announcements.\n"
            "- Avoid low-evidence pop-science summaries."
        ),
        "health": (
            "- Prioritize medically relevant updates: guidelines, health "
            "advisories, approvals, and large-study findings.\n"
            "- Avoid wellness clickbait and anecdotal hacks."
        ),
        "society": (
            "- Prioritize policy, regulation, governance, and civic "
            "developments.\n"
            "- Avoid hot-take opinion content without factual reporting."
        ),
        "psychology": (
            "- Prioritize evidence-based psychology updates from credible "
            "institutions or major publications.\n"
            "- Avoid low-rigor self-help listicles."
        ),
        "ideas": (
            "- Prioritize high-signal essays or analysis tied to real-world "
            "developments in the last 24h.\n"
            "- Avoid generic inspirational content."
        ),
    }
    return rules.get(
        interest_id,
        "- Prioritize concrete, factual updates with clear source backing.",
    )


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
    reference_date: str,
    max_age_days: int = 2,
) -> bool:
    """Return True if published_date is within max_age_days of reference_date.
    If parsing fails or date is missing, return True (do not hard-fail).
    """
    if not published_date:
        return True
    try:
        ref = datetime.strptime(reference_date, "%Y-%m-%d").date()
        raw = published_date.strip().replace("Z", "+00:00")
        if "T" in raw:
            pub = datetime.fromisoformat(raw).date()
        else:
            pub = datetime.strptime(raw[:10], "%Y-%m-%d").date()
        age = (ref - pub).days
        return age <= max_age_days
    except Exception:
        return True


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
    """Run one OpenAI web-search query and parse structured output."""
    interest_id = topic.get("id", "")
    subtopics = topic.get("subtopics", []) or []
    subtopic_text = ", ".join(subtopics) if subtopics else "None"
    focus_lines = "\n".join(
        [f"- {topic['name']} + {subtopic}" for subtopic in subtopics]
    ) if subtopics else f"- {topic['name']}"
    extra_rules = _interest_specific_rules(interest_id)

    prompt = f"""
Find the most credible and important updates from the last 24 hours for:
Interest: {topic['name']}
Subtopics: {subtopic_text}
Search focuses (each item should clearly map to one focus):
{focus_lines}

Rules:
- Return only genuinely important updates, not generic explainers.
- Prefer official announcements, primary reporting, or well-sourced analysis.
- Exclude listicles, SEO content, and opinion fluff.
- Prefer reputable/official sources; avoid press-release wire syndication.
- Only include links to specific articles/posts (not homepages).
- Every result MUST map to one listed subtopic.
- If no subtopics exist, map it to the broad interest.
- If fewer than {max_results} high-quality updates exist, return fewer.
{extra_rules}

Return STRICT JSON only in this exact shape:
{{
  "articles": [
    {{
      "title": "string",
      "subtitle": "string",
      "details": "2-4 sentence factual summary",
      "url": "https://...",
      "published_date": "YYYY-MM-DD or ISO datetime if available",
      "source_domain": "example.com",
      "subtopic": "one of the listed subtopics, else empty string",
      "importance": 1
    }}
  ]
}}
""".strip()

    def _fetch_raw_articles(prompt_text: str) -> list[dict[str, Any]]:
        response = client.responses.create(
            model=OPENAI_TRENDING_MODEL,
            tools=[{"type": "web_search_preview"}],
            temperature=0.2,
            max_output_tokens=2200,
            input=prompt_text,
        )
        text = (response.output_text or "").strip()
        data = _extract_json_object(text)
        raw = data.get("articles", []) if isinstance(data, dict) else []
        return raw if isinstance(raw, list) else []

    raw_articles = _fetch_raw_articles(prompt)

    fresh_articles: list[dict[str, Any]] = []
    fallback_articles: list[dict[str, Any]] = []
    for r in raw_articles:
        if not isinstance(r, dict):
            continue
        url = _normalize_url(str(r.get("url", "")))
        title = str(r.get("title", "")).strip()
        details = str(r.get("details", "")).strip()
        subtitle = str(r.get("subtitle", "")).strip()
        if not url or not title or _is_junk_url(url):
            continue
        published_date = str(r.get("published_date", "")).strip()
        desc = details or subtitle
        importance = r.get("importance")
        try:
            score = float(importance) if importance is not None else None
        except Exception:
            score = None
        payload = {
            "title": title,
            "url": url,
            "content": desc,
            "published_date": published_date,
            "score": score,
            "source": "openai_web_search",
            "subtopic": str(r.get("subtopic", "")).strip(),
        }
        if _is_recent_enough(published_date, date):
            fresh_articles.append(payload)
        else:
            fallback_articles.append(payload)

    # Prefer genuinely recent items; if model returns only older items,
    # degrade gracefully instead of returning an empty topic.
    fresh_articles = _dedupe_articles_by_url(fresh_articles)
    if fresh_articles:
        return fresh_articles[:max_results]

    fallback_articles = _dedupe_articles_by_url(fallback_articles)
    return fallback_articles[:max_results]


def fetch_news_for_topics(
    topics: list[dict[str, Any]],
    max_results: int = 8,
) -> dict[str, dict[str, Any]]:
    """
    Fetch news articles for each topic using OpenAI web search.

    Args:
        topics: List of topic dicts with id, name, subtopics, keywords
        max_results: Max results to request from Tavily (default: 8)

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
    client = OpenAI(api_key=api_key)
    date = _get_today_ist_date()

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
                max_results=MAX_NEWS_PER_TOPIC,
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

    print("=" * 60)
    print(f"TRENDING NEWS BUILD FOR {date}")
    print("=" * 60)

    start_time = time.time()
    store = FirestoreStore()

    # Step 1: Select top daily interests, then build topic configs
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
    news_by_topic = fetch_news_for_topics(topics)

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
