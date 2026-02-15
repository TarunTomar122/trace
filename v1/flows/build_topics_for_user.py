"""
Build topic pools for a single subscribed user using Exa.

- Umbrella pools: topics/{interest_id}
- Query pools: topics/{interest_id}/__q/{query_id}

Usage:
  python v1/flows/build_topics_for_user.py --user_id USER_ID
"""

import argparse
import json
import os
import random
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable

project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from dotenv import load_dotenv  # noqa: E402

load_dotenv(Path(__file__).parent.parent.parent / ".env")

from v1.storage import FirestoreStore  # noqa: E402
from v1.algorithm.interest_schema import (  # noqa: E402
    build_query_id,
    get_interest_ids,
    get_interest_label,
    get_interest_queries,
    normalize_query_text,
)
from v1.tools.youtube_search import youtube_search  # noqa: E402

try:
    from exa_py import Exa
except Exception as exc:  # pragma: no cover - runtime import guard
    raise ImportError(
        "exa_py is required. Install exa_py and set EXA_API_KEY."
    ) from exc


MAX_INTERESTS_DEFAULT = 8
MAX_HOBBIES_DEFAULT = 3
RESULTS_PER_SEARCH = 15
# Fetch extra to compensate for filtered junk URLs (tag pages, homepages, etc.)
EXA_OVERFETCH_BUFFER = 5
LOOKBACK_DAYS_DEFAULT = 28  # 4 weeks for fresher feed content
VIDEO_LOOKBACK_DAYS = 365  # 1 year for videos
MIN_REFRESH_DAYS_DEFAULT = 4
MIN_QUERY_POOL_ITEMS = 4
# Parallel processing for topic generation
MAX_CONCURRENT_TOPICS = 5

ARTICLE_DOMAINS = [
    "medium.com",
    "substack.com",
    "wordpress.com",
    "blogspot.com",
    "ghost.io",
    "tumblr.com",
    "beehiiv.com",
    "longreads.com",
    "write.as",
    # Removed: wixsite.com, weebly.com, notion.site, mirror.xyz — consistently low quality
]

DISCUSSION_DOMAINS = [
    "reddit.com",
    "news.ycombinator.com",
    "lobste.rs",
    # Removed: dev.to (mostly self-promo spam), quora.com (trivial questions),
    # twitter.com/x.com/threads.net (short-form, no substance)
    "stackexchange.com",
]

SKILL_QUERY_MODIFIERS = {
    "design": [
        "design systems",
        "visual design",
        "ux research",
        "product design",
        "typography",
    ],
    "writing": [
        "storytelling",
        "editing",
        "publishing",
        "copywriting",
        "narrative",
    ],
    "marketing": [
        "positioning",
        "growth",
        "seo",
        "distribution",
        "brand",
    ],
    "business": [
        "strategy",
        "operations",
        "pricing",
        "customer",
        "management",
    ],
    "software-tech": [
        "architecture",
        "performance",
        "developer tooling",
        "automation",
        "production",
    ],
    "data-analytics": [
        "analytics",
        "data visualization",
        "dashboards",
        "metrics",
        "data tools",
    ],
    "finance": [
        "budgeting",
        "investing",
        "markets",
        "risk management",
        "personal finance",
    ],
    "education": [
        "learning",
        "teaching",
        "curriculum",
        "study",
        "training",
    ],
    "health-wellness": [
        "wellness",
        "fitness",
        "mental health",
        "nutrition",
        "habits",
    ],
    "creative-arts": [
        "creativity",
        "art",
        "music",
        "photography",
        "illustration",
    ],
    "general": [
        "practical",
        "workflow",
        "playbook",
    ],
}

SKILL_MATCHERS = {
    "design": ["design", "ux", "ui", "product designer", "ux-designer"],
    "writing": ["writing", "writer", "storytelling", "copywriting", "editor"],
    "marketing": ["marketing", "growth", "seo", "copywriting", "brand"],
    "business": ["business", "strategy", "operations", "management", "founder", "entrepreneur"],
    "software-tech": [
        "software-tech",
        "software engineering",
        "software-engineering",
        "engineer",
        "developer",
        "programmer",
        "frontend",
        "backend",
        "ai-engineer",
        "artificial intelligence",
        "machine learning",
    ],
    "data-analytics": [
        "data",
        "analytics",
        "data science",
        "quant-researcher",
        "quant researcher",
        "quant",
    ],
    "finance": ["finance", "investing", "trading", "markets"],
    "education": ["education", "teacher", "teaching", "student", "learning"],
    "health-wellness": ["health", "wellness", "fitness", "nutrition", "mental health"],
    "creative-arts": ["creative", "creator", "art", "music", "photography", "illustration"],
}


# ---------------------------------------------------------------------------
# Quality query templates (loaded from JSON)
# ---------------------------------------------------------------------------
_QUALITY_QUERIES_PATH = Path(__file__).parent.parent / "algorithm" / "quality_queries.json"
_QUALITY_QUERIES: dict | None = None


def _load_quality_queries() -> dict:
    global _QUALITY_QUERIES
    if _QUALITY_QUERIES is None:
        try:
            with open(_QUALITY_QUERIES_PATH, "r") as f:
                _QUALITY_QUERIES = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError) as e:
            print(f"Warning: Could not load quality queries: {e}")
            _QUALITY_QUERIES = {}
    return _QUALITY_QUERIES


def _subtopic_label_to_id(interest_id: str, label: str) -> str | None:
    """Reverse-map a subtopic label (e.g. 'AI') back to its key (e.g. 'ai')."""
    from v1.algorithm.interest_schema import SUBTOPIC_LABELS

    subtopics = SUBTOPIC_LABELS.get(interest_id, {})
    # Check if label matches a subtopic value
    for sid, slabel in subtopics.items():
        if slabel.lower() == label.lower():
            return sid
    # Check if the label itself is already a subtopic key
    label_lower = label.lower().strip()
    if label_lower in subtopics:
        return label_lower
    return None


def _get_quality_query(
    interest_id: str,
    subtopic_id: str | None = None,
    fallback_topic: str | None = None,
) -> str:
    """Pick a random quality query from the curated JSON.

    Falls back to a descriptive template if the interest/subtopic isn't found.
    """
    queries = _load_quality_queries()
    interest_queries = queries.get(interest_id, {})

    pool: list[str] | None = None
    if subtopic_id and subtopic_id in interest_queries:
        pool = interest_queries[subtopic_id]
    elif "_umbrella" in interest_queries:
        pool = interest_queries["_umbrella"]

    if pool:
        return random.choice(pool)

    # Fallback for hobbies or interests not in the JSON
    topic = fallback_topic or interest_id.replace("-", " ").title()
    return f"Here is a great article about {topic} worth reading:"


def _get_discussion_query(topic: str) -> str:
    """Build an Exa-friendly discussion query."""
    templates = [
        f"Here is an interesting discussion about {topic}:",
        f"Here is a thoughtful thread about {topic} with great insights:",
        f"Here is a popular discussion about {topic} worth reading:",
    ]
    return random.choice(templates)


def _normalize_interest(interest: str) -> str:
    return (
        interest.lower()
        .strip()
        .replace(" ", "-")
        .replace("&", "and")
        .replace("/", "-")
        .replace("\\", "-")
        .replace("(", "")
        .replace(")", "")
    )


def _dedupe_preserve_order(items: Iterable[str]) -> list[str]:
    seen = set()
    deduped = []
    for item in items:
        if item and item not in seen:
            seen.add(item)
            deduped.append(item)
    return deduped


def _iso_z(dt: datetime) -> str:
    return (
        dt.astimezone(timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


def _parse_iso_z(value: str) -> datetime | None:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None


def _should_refresh_topic(topic_doc: dict, min_days: int) -> bool:
    if not topic_doc:
        return True
    latest = topic_doc.get("latest") if isinstance(topic_doc, dict) else None
    updated_at = None
    if isinstance(latest, dict):
        updated_at = latest.get("generated_at") or latest.get("updated_at")
    updated_at = updated_at or topic_doc.get("updated_at")
    parsed = _parse_iso_z(updated_at) if isinstance(updated_at, str) else None
    if not parsed:
        return True
    return datetime.now(timezone.utc) - parsed >= timedelta(days=min_days)


# URL patterns that indicate non-article pages (tag pages, homepages, etc.)
JUNK_URL_PATTERNS = [
    "/tag/",
    "/tags/",
    "/category/",
    "/categories/",
    "/top/",
    "/topics/",
    "/topic/",
    "/replay/",
    "/embed/",
    "/search?",
    "/search/",
    "/author/",
    "/authors/",
    "/archive/",
    "/archives/",
    "/page/",
    "/feed/",
    "/rss/",
    "/about/",
    "/contact/",
    "/privacy",
    "/terms",
    "/login",
    "/signup",
    "/subscribe",
    "/pricing",
]

# Paths that are index/listing pages, not articles
_INDEX_PATH_ENDINGS = {
    "/blog", "/blogs", "/blog/", "/blogs/",
    "/articles", "/articles/",
    "/posts", "/posts/",
    "/news", "/news/",
    "/stories", "/stories/",
    "/newsletter", "/newsletter/",
    "/latest", "/latest/",
}

import re as _re

# Blogspot date-only archive: /YYYY/ or /YYYY/MM/ without a slug after
_BLOGSPOT_DATE_ARCHIVE = _re.compile(
    r"^/\d{4}(/\d{2})?/?(\?.*)?$"
)

# Medium publication page (medium.com/<publication>) — no article hash at end
_MEDIUM_PUB_PAGE = _re.compile(
    r"^/[a-z0-9][\w-]*/?$"  # single path segment, no article slug
)


def _is_junk_url(url: str) -> bool:
    """Check if URL is a tag page, homepage, or other non-article page."""
    if not url:
        return True
    try:
        from urllib.parse import urlparse
        parsed = urlparse(url)
        host = parsed.hostname or ""
        path = parsed.path.lower().rstrip("/")
        query = parsed.query.lower()

        # Homepage check: empty path or just "/"
        if not path or path == "/" or path == "/index.html":
            return True

        # Check for junk URL path patterns
        for pattern in JUNK_URL_PATTERNS:
            if pattern in path:
                return True

        # Blogspot date-only archives (e.g. /2025/ or /2024/03/ with optional ?m=0)
        if "blogspot" in host and _BLOGSPOT_DATE_ARCHIVE.match(path or "/"):
            return True

        # Medium publication pages (medium.com/<publication>) — not articles
        if "medium.com" in host and _MEDIUM_PUB_PAGE.match(path):
            return True

        # Index/listing paths (e.g. /blog, /articles, /posts)
        if path in _INDEX_PATH_ENDINGS:
            return True

        # Beehiiv newsletter archives (bare domain or /subscribe)
        if "beehiiv.com" in host and (not path or path == "/"):
            return True

        # Ghost.io / WordPress / Substack bare homepages
        # (already caught by empty-path check above, but catch trailing-slash edge cases)
        if any(d in host for d in ("ghost.io", "wordpress.com", "wixsite.com", "weebly.com")):
            segments = [s for s in path.split("/") if s]
            if len(segments) == 0:
                return True

        # Very short paths that are likely index pages
        # e.g. /some-blog-name with no further slug
        segments = [s for s in path.split("/") if s]
        if len(segments) == 1:
            seg = segments[0]
            # Substack root /p/ needs at least one more segment to be an article
            if seg == "p":
                return True
            # Blogspot /search is already caught, but catch /search?q=...
            if seg == "search":
                return True

        return False
    except Exception:
        return False


def _extract_items(results) -> list[dict]:
    items = []
    for r in results or []:
        if hasattr(r, "url"):
            url = getattr(r, "url", None)
            title = getattr(r, "title", None)
        elif isinstance(r, dict):
            url = r.get("url")
            title = r.get("title")
        else:
            url = None
            title = None
        if url and not _is_junk_url(url):
            items.append(
                {
                    "url": url,
                    "title": title or "",
                }
            )
    deduped_urls = set()
    deduped = []
    for item in items:
        url = item.get("url")
        if url and url not in deduped_urls:
            deduped_urls.add(url)
            deduped.append(item)
    return deduped


def _search_exa(
    exa: Exa,
    query: str,
    start_date: str,
    end_date: str,
    max_retries: int = 3,
    include_domains: list[str] | None = None,
    min_results: int = 4,
) -> list[dict]:
    """Search Exa with retry logic for transient failures (502, 503, etc.)"""
    last_error = None
    include_domains = include_domains or None
    # Over-fetch to compensate for junk URLs that get filtered out
    fetch_count = RESULTS_PER_SEARCH + EXA_OVERFETCH_BUFFER
    for attempt in range(max_retries):
        try:
            try:
                response = exa.search(
                    query,
                    num_results=fetch_count,
                    start_published_date=start_date,
                    end_published_date=end_date,
                    type="auto",
                    exclude_text=["docs"],
                    include_domains=include_domains,
                )
            except TypeError:
                response = exa.search(
                    query,
                    num_results=fetch_count,
                    start_published_date=start_date,
                    end_published_date=end_date,
                    type="auto",
                    exclude_text=["docs"],
                )
            results = _extract_items(getattr(response, "results", response))
            # Filter out junk URLs right at ingestion time
            results = [r for r in results if not _is_junk_url(r.get("url", ""))]
            if include_domains and len(results) < min_results:
                # Fallback to broader search to avoid empty feeds
                fallback = exa.search(
                    query,
                    num_results=fetch_count,
                    start_published_date=start_date,
                    end_published_date=end_date,
                    type="auto",
                    exclude_text=["docs"],
                )
                fallback_results = _extract_items(getattr(fallback, "results", fallback))
                fallback_results = [r for r in fallback_results if not _is_junk_url(r.get("url", ""))]
                merged = _extract_items(results + fallback_results)
                return merged[:RESULTS_PER_SEARCH]
            return results[:RESULTS_PER_SEARCH]
        except (ValueError, Exception) as e:
            last_error = e
            error_str = str(e)
            # Retry on transient errors (502, 503, 504, timeout, etc.)
            if any(code in error_str for code in ["502", "503", "504", "timeout", "timed out"]):
                wait_time = (2 ** attempt) + random.uniform(0, 1)  # Exponential backoff with jitter
                print(f"    ⚠️  Exa API error (attempt {attempt + 1}/{max_retries}), retrying in {wait_time:.1f}s...")
                time.sleep(wait_time)
            else:
                # Non-transient error, don't retry
                raise
    
    # All retries exhausted, log and return empty to continue processing
    print(f"    ❌ Exa API failed after {max_retries} attempts, skipping this search")
    return []


def _get_skill_modifiers(skills: list[str] | None) -> list[str]:
    if not skills:
        return SKILL_QUERY_MODIFIERS["general"]
    modifiers: list[str] = []
    for skill in skills:
        skill_value = (skill or "").strip().lower()
        if not skill_value:
            continue
        for key, matchers in SKILL_MATCHERS.items():
            if any(m in skill_value for m in matchers):
                modifiers.extend(SKILL_QUERY_MODIFIERS.get(key, []))
                break
    if not modifiers:
        modifiers = SKILL_QUERY_MODIFIERS["general"]
    seen = set()
    deduped = []
    for mod in modifiers:
        if mod in seen:
            continue
        seen.add(mod)
        deduped.append(mod)
    return deduped[:8]


def _is_skill_inflected(query: str, skill_modifiers: list[str]) -> bool:
    query_lower = query.lower()
    return any(mod in query_lower for mod in skill_modifiers)


def _build_umbrella_queries(interest_id: str, skills: list[str] | None) -> list[str]:
    label = get_interest_label(interest_id)
    modifiers = _get_skill_modifiers(skills)
    queries = [label]
    for mod in modifiers[:3]:
        queries.append(f"{label} {mod}")
    return _dedupe_preserve_order(queries)


def _get_subscribed_user_profile(store: FirestoreStore, user_id: str) -> dict:
    from v1.storage import is_user_subscribed
    profile = store.get_user_profile(user_id)
    if not profile:
        raise ValueError(f"User {user_id} not found")
    if not is_user_subscribed(profile):
        raise ValueError(
            f"User {user_id} is not subscribed (web: {profile.get('subscriptionStatus', 'none')}, app: {profile.get('appSubscriptionStatus', 'none')})"
        )
    return profile


def build_topics_for_user(
    user_id: str,
    max_interests: int = MAX_INTERESTS_DEFAULT,
    lookback_days: int = LOOKBACK_DAYS_DEFAULT,
    min_refresh_days: int = MIN_REFRESH_DAYS_DEFAULT,
) -> dict:
    from concurrent.futures import ThreadPoolExecutor

    store = FirestoreStore()
    profile = _get_subscribed_user_profile(store, user_id)

    interest_ids = get_interest_ids(profile)[:max_interests]
    interest_queries = get_interest_queries(profile)

    hobbies = profile.get("hobbies", []) or []
    hobbies = [
        h.strip()
        for h in hobbies
        if isinstance(h, str) and h.strip()
    ]
    hobbies = list(dict.fromkeys(hobbies))[:MAX_HOBBIES_DEFAULT]

    if not interest_ids and not hobbies:
        print("No interests or hobbies found for this user.")
        return {
            "user_id": user_id,
            "topics_written": 0,
            "interests": [],
            "hobbies": [],
        }

    api_key = (
        os.getenv("EXA_API_KEY") or os.getenv("EXA_KEY") or ""
    ).strip()
    if not api_key:
        raise ValueError("Set EXA_API_KEY (or EXA_KEY) in the environment.")

    exa = Exa(api_key=api_key)

    now = datetime.now(timezone.utc)
    start_date = _iso_z(now - timedelta(days=lookback_days))
    end_date = _iso_z(now)
    date_key = now.date().isoformat()
    generated_at = _iso_z(now)

    def _process_topic(
        topic_id: str,
        display_name: str,
        topic_kind: str,
        query_used: str,
        queries: list[str],
    ) -> tuple[str, bool, str]:
        """Process a single topic. Returns (topic_id, written, status)."""
        doc_ref = store.db.collection("topics").document(topic_id)
        existing = doc_ref.get()
        data = existing.to_dict() if existing.exists else {}
        if not _should_refresh_topic(data, min_refresh_days):
            return (topic_id, False, "skipped_fresh")

        print(f"Processing topic: {topic_id} [{topic_kind}]")

        # Use curated quality queries (falls back to generic template for hobbies)
        blogs_query = _get_quality_query(topic_id, fallback_topic=display_name)
        print(f"  Exa blog search: {blogs_query}")
        blogs = _search_exa(
            exa,
            blogs_query,
            start_date,
            end_date,
            include_domains=ARTICLE_DOMAINS,
        )

        discussions = []
        videos = []
        if topic_kind == "interest":
            discussions_query = _get_discussion_query(display_name)
            print(f"  Exa discussion search: {discussions_query}")
            discussions = _search_exa(
                exa,
                discussions_query,
                start_date,
                end_date,
                include_domains=DISCUSSION_DOMAINS,
            )
        else:
            videos_query = f"videos about {query_used}"
            print(f"  YouTube search: {videos_query}")
            youtube_results = youtube_search(
                query_used,
                max_results=RESULTS_PER_SEARCH,
                days=VIDEO_LOOKBACK_DAYS,
                min_subscribers=50_000,
            )
            for v in youtube_results:
                videos.append({
                    "url": v.get("url"),
                    "title": v.get("title", ""),
                    "thumbnail": (v.get("metadata") or {}).get("thumbnail"),
                    "published_date": v.get("published_date"),
                    "duration_seconds": (
                        v.get("metadata") or {}
                    ).get("duration_seconds"),
                })

        generation = {
            "generated_at": generated_at,
            "window_start": start_date,
            "window_end": end_date,
            "blogs": blogs,
            "discussions": discussions,
            "videos": videos,
            "source": "exa",
            "video_source": "youtube",
            "generated_by_user_id": user_id,
            "queries": queries,
            "query_used": query_used,
            "topic_kind": topic_kind,
        }

        generations = (
            data.get("generations", {}) if isinstance(data, dict) else {}
        )
        generations[date_key] = generation

        payload = {
            "topic_id": topic_id,
            "display_name": display_name,
            "topic_kind": topic_kind,
            "updated_at": generated_at,
            "latest": generation,
            "queries": queries,
            "generations": generations,
        }
        if topic_kind == "interest":
            payload["interest_id"] = topic_id

        doc_ref.set(payload, merge=True)
        return (topic_id, True, "written")

    def _process_query_pool(
        interest_id: str,
        query_text: str,
        query_used: str,
    ) -> tuple[str, bool, str]:
        """Process a query pool. Returns (query_id, written, status)."""
        query_id = build_query_id(query_text)
        doc_ref = (
            store.db.collection("topics")
            .document(interest_id)
            .collection("__q")
            .document(query_id)
        )
        existing = doc_ref.get()
        data = existing.to_dict() if existing.exists else {}
        if not _should_refresh_topic(data, min_refresh_days):
            return (query_id, False, "skipped_fresh")

        print(f"Processing query pool: {interest_id}::{query_text}")

        # Map subtopic label → subtopic id for quality query lookup
        subtopic_id = _subtopic_label_to_id(interest_id, query_text)
        blogs_query = _get_quality_query(
            interest_id, subtopic_id=subtopic_id, fallback_topic=query_used,
        )
        print(f"  Exa blog search: {blogs_query}")
        blogs = _search_exa(
            exa,
            blogs_query,
            start_date,
            end_date,
            include_domains=ARTICLE_DOMAINS,
        )

        discussions_query = _get_discussion_query(query_used)
        print(f"  Exa discussion search: {discussions_query}")
        discussions = _search_exa(
            exa,
            discussions_query,
            start_date,
            end_date,
            include_domains=DISCUSSION_DOMAINS,
        )

        generation = {
            "generated_at": generated_at,
            "window_start": start_date,
            "window_end": end_date,
            "blogs": blogs,
            "discussions": discussions,
            "videos": [],
            "source": "exa",
            "generated_by_user_id": user_id,
            "queries": [query_text],
            "query_text": query_text,
            "query_used": query_used,
            "topic_kind": "interest_query",
            "pool_kind": "query",
        }

        generations = (
            data.get("generations", {}) if isinstance(data, dict) else {}
        )
        generations[date_key] = generation

        doc_ref.set(
            {
                "interest_id": interest_id,
                "query_id": query_id,
                "query_text": query_text,
                "updated_at": generated_at,
                "latest": generation,
                "generations": generations,
                "pool_kind": "query",
            },
            merge=True,
        )
        return (query_id, True, "written")

    # Build all tasks
    topic_tasks = []
    query_pool_tasks = []

    for interest_id in interest_ids:
        queries = _build_umbrella_queries(interest_id, profile.get("skills"))
        query_used = random.choice(queries)
        topic_tasks.append((
            interest_id,
            get_interest_label(interest_id),
            "interest",
            query_used,
            queries,
        ))

        raw_queries = interest_queries.get(interest_id, [])[:2]
        query_texts = [
            normalize_query_text(interest_id, q)
            for q in raw_queries
            if isinstance(q, str) and q.strip()
        ]
        for query_text in query_texts:
            q_used = f"{get_interest_label(interest_id)} {query_text}".strip()
            query_pool_tasks.append((interest_id, query_text, q_used))

    for hobby in hobbies:
        hobby_id = _normalize_interest(hobby)
        hobby_queries = _dedupe_preserve_order([hobby])
        topic_tasks.append((
            hobby_id,
            hobby.strip(),
            "hobby",
            hobby,
            hobby_queries,
        ))

    total_tasks = len(topic_tasks) + len(query_pool_tasks)
    print(f"Processing {total_tasks} tasks concurrently "
          f"({len(topic_tasks)} topics, {len(query_pool_tasks)} query pools)...")

    topics_written = 0
    query_pools_written = 0
    topics_skipped = 0

    # Process topics and query pools concurrently
    with ThreadPoolExecutor(max_workers=MAX_CONCURRENT_TOPICS) as executor:
        futures = []

        # Submit topic tasks
        for args in topic_tasks:
            futures.append(("topic", executor.submit(_process_topic, *args)))

        # Submit query pool tasks
        for args in query_pool_tasks:
            futures.append(("pool", executor.submit(_process_query_pool, *args)))

        # Collect results
        for task_type, future in futures:
            try:
                _, written, status = future.result()
                if task_type == "topic":
                    if written:
                        topics_written += 1
                    elif status == "skipped_fresh":
                        topics_skipped += 1
                else:
                    if written:
                        query_pools_written += 1
                    elif status == "skipped_fresh":
                        topics_skipped += 1
            except Exception as e:
                print(f"  Error in {task_type} task: {e}")

    return {
        "user_id": user_id,
        "topics_written": topics_written,
        "query_pools_written": query_pools_written,
        "topics_skipped": topics_skipped,
        "interests": interest_ids,
        "hobbies": hobbies,
        "date_key": date_key,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Build Exa topics for a user"
    )
    parser.add_argument(
        "--user_id",
        required=True,
        help="User ID to build topics for",
    )
    parser.add_argument(
        "--max-interests",
        type=int,
        default=MAX_INTERESTS_DEFAULT,
        help="Max interests to process",
    )
    parser.add_argument(
        "--lookback-days",
        type=int,
        default=LOOKBACK_DAYS_DEFAULT,
        help="Days to look back for content",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force refresh all topics, ignoring min-refresh-days",
    )
    args = parser.parse_args()

    result = build_topics_for_user(
        user_id=args.user_id,
        max_interests=args.max_interests,
        lookback_days=args.lookback_days,
        min_refresh_days=0 if args.force else MIN_REFRESH_DAYS_DEFAULT,
    )
    print(f"Done. Topics written: {result['topics_written']}")


if __name__ == "__main__":
    main()
