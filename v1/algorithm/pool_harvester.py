"""
Algorithm Pool Harvester - builds a daily pool with umbrella news + subqueries.

Rules:
- Up to 30 umbrellas (by user_count)
- Up to 60 total queries (umbrella news + subqueries)
- Each query: 2 Tavily results (blog/discussion labels random)
- Optional 1 YouTube video per query (50% chance; 80% for hobby umbrellas)
"""
import argparse
import random
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env")

from v1.storage import FirestoreStore
from v1.tools.youtube_search import youtube_search
from v1.tools.umbrella_mapper import map_interests_to_umbrellas
from v1.algorithm.pool_utils import (
    DOCS_BLOCKLIST_PATTERNS,
    generate_pool_id,
    get_today_ist_date,
    is_blocklisted_url,
)
from v1.algorithm.tavily_search import tavily_search


def _get_hobby_umbrella_ids(store: FirestoreStore) -> set[str]:
    profiles = store.get_all_user_profiles()
    subscribed = [p for p in profiles if p.get("subscriptionStatus") in ["trial", "active"]]
    hobbies = []
    for p in subscribed:
        hobbies.extend(p.get("hobbies", []) or [])
    hobbies = list({h for h in hobbies if h})
    if not hobbies:
        return set()

    mapping = map_interests_to_umbrellas(hobbies, store)
    return set(mapping.get("mappings", {}).values())


def _get_active_umbrellas(store: FirestoreStore) -> list[dict[str, Any]]:
    umbrellas = store.get_all_umbrellas()
    umbrellas = [u for u in umbrellas if u.get("user_count", 0) > 0]
    umbrellas.sort(key=lambda u: u.get("user_count", 0), reverse=True)
    return umbrellas


def _pick_subqueries(store: FirestoreStore, umbrella_ids: set[str], max_per_umbrella: int) -> list[dict[str, Any]]:
    active_queries = store.get_active_queries(min_users=1)
    grouped: dict[str, list[dict[str, Any]]] = {}
    for q in active_queries:
        umbrella_id = q.get("umbrella_id")
        if umbrella_id in umbrella_ids:
            grouped.setdefault(umbrella_id, []).append(q)

    selected = []
    for umbrella_id, queries in grouped.items():
        queries.sort(key=lambda q: q.get("user_count", 0), reverse=True)
        selected.extend(queries[:max_per_umbrella])
    return selected


def _build_pool_item(
    url: str,
    title: str,
    description: str,
    content_type: str,
    source: str,
    umbrella_id: str,
    query_id: str,
    date_str: str,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    item = {
        "id": generate_pool_id(url, date_str),
        "url": url,
        "title": title or "",
        "description": (description or "")[:500],
        "type": content_type,
        "source": source,
        "umbrella_id": umbrella_id,
        "query_id": query_id,
        "tags": [umbrella_id],
        "fetched_at": datetime.utcnow().isoformat(),
        "expires_at": (datetime.utcnow() + timedelta(days=3)).isoformat(),
        "quality_signals": {},
        "trending_score": 50,
        "freshness_score": 95,
    }
    if extra:
        item.update(extra)
    return item


def harvest_pool(
    max_umbrellas: int = 30,
    max_queries: int = 60,
    subqueries_per_umbrella: int = 3,
) -> dict[str, Any]:
    store = FirestoreStore()
    date_str = get_today_ist_date()

    hobby_umbrella_ids = _get_hobby_umbrella_ids(store)

    active_umbrellas = _get_active_umbrellas(store)
    top_umbrellas = active_umbrellas[:max_umbrellas]
    top_umbrella_ids = {u.get("id") for u in top_umbrellas if u.get("id")}
    extra_umbrellas = [
        u for u in active_umbrellas
        if u.get("id") and u.get("id") not in top_umbrella_ids
    ]
    umbrella_queries = []
    for umbrella in top_umbrellas:
        umbrella_id = umbrella.get("id")
        if not umbrella_id:
            continue
        display_name = umbrella.get("display_name", umbrella_id)
        query_text = f"{display_name} news latest"
        umbrella_queries.append({
            "query_id": f"{umbrella_id}-news",
            "query_text": query_text,
            "umbrella_id": umbrella_id,
            "topic": "news",
            "days": 7,
        })

    subquery_candidates = _pick_subqueries(
        store,
        top_umbrella_ids,
        max_per_umbrella=subqueries_per_umbrella,
    )
    subquery_candidates.sort(key=lambda q: q.get("user_count", 0), reverse=True)

    remaining_slots = max(0, max_queries - len(umbrella_queries))
    selected_subqueries = subquery_candidates[:remaining_slots]

    all_queries = umbrella_queries + [
        {
            "query_id": q.get("query_id"),
            "query_text": q.get("query_text"),
            "umbrella_id": q.get("umbrella_id"),
            "topic": "general",
            "days": 60,
        }
        for q in selected_subqueries
    ]

    # Extra umbrella coverage: one news query for remaining umbrellas
    extra_news_queries = []
    for umbrella in extra_umbrellas:
        umbrella_id = umbrella.get("id")
        if not umbrella_id:
            continue
        display_name = umbrella.get("display_name", umbrella_id)
        query_text = f"{display_name} news latest"
        extra_news_queries.append({
            "query_id": f"{umbrella_id}-news",
            "query_text": query_text,
            "umbrella_id": umbrella_id,
            "topic": "news",
            "days": 7,
        })

    if extra_news_queries:
        all_queries.extend(extra_news_queries)

    print(
        f"Harvesting {len(all_queries)} queries from "
        f"{len(active_umbrellas)} active umbrellas..."
    )

    urls_seen = set()
    items_stored = 0
    source_breakdown: dict[str, int] = {"video": 0, "blog": 0, "discussion": 0}

    for q in all_queries:
        query_text = q.get("query_text") or ""
        umbrella_id = q.get("umbrella_id") or ""
        query_id = q.get("query_id") or ""
        if not query_text or not umbrella_id:
            continue

        print(f"  Searching: {query_text[:60]}...")

        results = tavily_search(
            query=query_text,
            max_results=2,
            days=int(q.get("days", 60)),
            topic=q.get("topic", "general"),
            search_depth="basic",
        )

        if results:
            for r in results:
                url = r.get("url")
                if not url or url in urls_seen or store.pool_url_exists(url):
                    continue
                title = r.get("title", "")
                if is_blocklisted_url(url, title, DOCS_BLOCKLIST_PATTERNS):
                    continue

                if q.get("topic") == "news":
                    content_type = "blog"
                else:
                    content_type = random.choice(["blog", "discussion"])
                item = _build_pool_item(
                    url=url,
                    title=title,
                    description=r.get("content", ""),
                    content_type=content_type,
                    source="tavily",
                    umbrella_id=umbrella_id,
                    query_id=query_id,
                    date_str=date_str,
                    extra={
                        "published_date": r.get("published_date"),
                        "score": r.get("score"),
                    },
                )
                store.add_to_pool(item["id"], item)
                urls_seen.add(url)
                items_stored += 1
                source_breakdown[content_type] = source_breakdown.get(content_type, 0) + 1

        video_chance = 0.8 if umbrella_id in hobby_umbrella_ids else 0.5
        if random.random() < video_chance:
            video_results = youtube_search(
                query=query_text,
                max_results=1,
                days=int(q.get("days", 60)),
            )
            for r in video_results:
                url = r.get("url")
                if not url or url in urls_seen or store.pool_url_exists(url):
                    continue
                metadata = r.get("metadata", {})
                item = _build_pool_item(
                    url=url,
                    title=r.get("title", ""),
                    description=r.get("content", ""),
                    content_type="video",
                    source="youtube",
                    umbrella_id=umbrella_id,
                    query_id=query_id,
                    date_str=date_str,
                    extra={
                        "published_date": r.get("published_date"),
                        "thumbnail": metadata.get("thumbnail"),
                    },
                )
                store.add_to_pool(item["id"], item)
                urls_seen.add(url)
                items_stored += 1
                source_breakdown["video"] = source_breakdown.get("video", 0) + 1

        if query_id and store.get_query_users(query_id):
            store.update_query_last_searched(query_id)

    print("\nCleaning old pool items...")
    items_deleted = store.clean_old_pool_items(max_age_days=3)

    breakdown_str = ", ".join(f"{k}: {v}" for k, v in source_breakdown.items() if v > 0)
    print(f"Harvested {items_stored} items: {breakdown_str}")

    return {
        "queries_searched": len(all_queries),
        "items_stored": items_stored,
        "items_deleted": items_deleted,
        "source_breakdown": source_breakdown,
    }


def main():
    parser = argparse.ArgumentParser(description="Algorithm pool harvester")
    parser.add_argument("--max-umbrellas", type=int, default=30, help="Max umbrellas to process")
    parser.add_argument("--max-queries", type=int, default=60, help="Max queries total")
    parser.add_argument("--subqueries-per-umbrella", type=int, default=3, help="Max subqueries per umbrella")
    args = parser.parse_args()

    harvest_pool(
        max_umbrellas=args.max_umbrellas,
        max_queries=args.max_queries,
        subqueries_per_umbrella=args.subqueries_per_umbrella,
    )


if __name__ == "__main__":
    main()

