"""
Algorithm feed generation: score today's pool and top-up for subscribed users.
"""
import sys
import random
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

load_dotenv(Path(__file__).parent.parent.parent / ".env")

from v1.storage import FirestoreStore  # noqa: E402
from v1.scoring import (  # noqa: E402
    score_item_for_user,
    apply_diversity_filter,
    generate_why_relevant,
)
from v1.tools.youtube_search import youtube_search  # noqa: E402
from v1.algorithm.pool_utils import (  # noqa: E402
    DOCS_BLOCKLIST_PATTERNS,
    generate_pool_id,
    get_today_ist_date,
    is_blocklisted_url,
    within_hours,
)
from v1.algorithm.tavily_search import tavily_search  # noqa: E402


POOL_MAX_AGE_HOURS = 24


def _normalize_interest(interest: str) -> str:
    return (interest.lower().strip()
            .replace(" ", "-")
            .replace("&", "and")
            .replace("/", "-")
            .replace("\\", "-")
            .replace("(", "")
            .replace(")", ""))


def get_user_seen_urls(
    store: FirestoreStore,
    user_id: str,
    days: int = 14,
) -> set[str]:
    seen_urls = set()
    try:
        doc = store.db.collection("user_seen_urls").document(user_id).get()
        if doc.exists:
            data = doc.to_dict()
            urls_dict = data.get("urls", {})
            cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()
            for url, seen_at in urls_dict.items():
                if seen_at and seen_at > cutoff:
                    seen_urls.add(url)
    except Exception:
        pass
    return seen_urls


def get_user_preferences(
    store: FirestoreStore,
    user_id: str,
) -> dict[str, Any]:
    try:
        doc = store.db.collection("user_preferences").document(user_id).get()
        if doc.exists:
            return doc.to_dict() or {}
    except Exception:
        pass
    return {
        "source_distribution": {
            "video": 30,
            "blog": 40,
            "discussion": 15,
            "repo": 5,
            "paper": 0,
            "launch": 5,
            "tweet": 5,
            "model": 0,
        },
        "contentDepth": "deep",
    }


def get_user_patterns(
    store: FirestoreStore,
    user_id: str,
) -> dict[str, Any]:
    try:
        doc = store.db.collection("user_patterns").document(user_id).get()
        if doc.exists:
            return doc.to_dict() or {}
    except Exception:
        pass
    return {"tags": {}, "exclude_tags": [], "personal_signals": []}


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


def _collect_today_pool(store: FirestoreStore) -> list[dict[str, Any]]:
    items = store.get_retrieval_pool()
    return [
        item for item in items
        if within_hours(item, POOL_MAX_AGE_HOURS)
    ]


def _select_scored_items(
    items: list[dict[str, Any]],
    user_profile: dict[str, Any],
    user_patterns: dict[str, Any],
    user_preferences: dict[str, Any],
    max_items: int,
) -> list[dict[str, Any]]:
    scored = []
    for item in items:
        score = score_item_for_user(
            item,
            user_profile,
            user_patterns,
            user_preferences,
        )
        scored.append({**item, "_score": score})

    scored.sort(key=lambda x: x.get("_score", 0), reverse=True)
    filtered = apply_diversity_filter(
        scored,
        max_per_domain=5,
        max_per_type=None,
        max_per_umbrella=2,
        max_total_per_umbrella=2,
        max_items=max_items,
        interleave_topics=True,
    )
    return filtered


def _run_emergency_search(
    store: FirestoreStore,
    interest: str,
    umbrella_id: str,
    is_hobby: bool,
    date_str: str,
) -> list[dict[str, Any]]:
    query_text = f"{interest} latest"
    results = tavily_search(
        query=query_text,
        max_results=2,
        days=60,
        topic="general",
        search_depth="basic",
    )

    items = []
    for r in results:
        url = r.get("url")
        if not url or store.pool_url_exists(url):
            continue
        title = r.get("title", "")
        if is_blocklisted_url(url, title, DOCS_BLOCKLIST_PATTERNS):
            continue
        content_type = random.choice(["blog", "discussion"])
        item = _build_pool_item(
            url=url,
            title=title,
            description=r.get("content", ""),
            content_type=content_type,
            source="tavily",
            umbrella_id=umbrella_id,
            query_id=f"{umbrella_id}-emergency",
            date_str=date_str,
            extra={
                "published_date": r.get("published_date"),
                "score": r.get("score"),
            },
        )
        store.add_to_pool(item["id"], item)
        items.append(item)

    video_chance = 0.8 if is_hobby else 0.5
    if random.random() < video_chance:
        video_results = youtube_search(
            query=query_text,
            max_results=1,
            days=60,
        )
        for r in video_results:
            url = r.get("url")
            if not url or store.pool_url_exists(url):
                continue
            metadata = r.get("metadata", {})
            item = _build_pool_item(
                url=url,
                title=r.get("title", ""),
                description=r.get("content", ""),
                content_type="video",
                source="youtube",
                umbrella_id=umbrella_id,
                query_id=f"{umbrella_id}-emergency",
                date_str=date_str,
                extra={
                    "published_date": r.get("published_date"),
                    "thumbnail": metadata.get("thumbnail"),
                },
            )
            store.add_to_pool(item["id"], item)
            items.append(item)

    return items


def deliver_feed(
    user_id: str,
    max_items: int = 30,
    skip_seen_urls: bool = False,
) -> list[dict[str, Any]]:
    store = FirestoreStore()
    user_profile = store.get_user_profile(user_id)
    if not user_profile:
        print(f"  Error: User {user_id} not found")
        return []

    subscription_status = user_profile.get("subscriptionStatus", "none")
    is_subscribed = subscription_status in ["trial", "active"]

    user_preferences = get_user_preferences(store, user_id)
    user_patterns = get_user_patterns(store, user_id)
    seen_urls = set()
    if not skip_seen_urls:
        seen_urls = get_user_seen_urls(store, user_id, days=14)

    interests = user_profile.get("interests", []) or []
    hobbies = user_profile.get("hobbies", []) or []
    hobbies_lower = {h.lower() for h in hobbies if isinstance(h, str)}
    combined = list({i for i in interests + hobbies if i})

    interest_map = user_profile.get("interest_umbrella_map", {}) or {}
    hobby_map = user_profile.get("hobby_umbrella_map", {}) or {}
    if not interest_map and not hobby_map:
        interest_map = {i: _normalize_interest(i) for i in interests if i}
        hobby_map = {h: _normalize_interest(h) for h in hobbies if h}

    interest_to_umbrella = {**interest_map, **hobby_map}
    umbrella_ids = set(interest_to_umbrella.values())
    hobby_umbrella_ids = set(hobby_map.values())
    hobby_umbrella_ids.discard(None)

    today_pool = _collect_today_pool(store)
    pool_items = [
        item for item in today_pool
        if item.get("umbrella_id") in umbrella_ids
        and item.get("url") not in seen_urls
        and not is_blocklisted_url(
            item.get("url", ""),
            item.get("title", ""),
            DOCS_BLOCKLIST_PATTERNS,
        )
    ]

    scored_items = _select_scored_items(
        pool_items,
        user_profile,
        user_patterns,
        user_preferences,
        max_items=max_items,
    )

    if is_subscribed and len(scored_items) < max_items:
        date_str = get_today_ist_date()
        pool_by_umbrella = {u: [] for u in umbrella_ids}
        for item in pool_items:
            pool_by_umbrella.setdefault(
                item.get("umbrella_id"),
                [],
            ).append(item)

        missing_interests = [
            interest for interest, umbrella_id in interest_to_umbrella.items()
            if not pool_by_umbrella.get(umbrella_id)
        ]

        for interest in missing_interests:
            if len(scored_items) >= max_items:
                break
            umbrella_id = interest_to_umbrella.get(interest)
            if not umbrella_id:
                continue
            is_hobby = (
                isinstance(interest, str)
                and interest.lower() in hobbies_lower
            )
            emergency_items = _run_emergency_search(
                store=store,
                interest=interest,
                umbrella_id=umbrella_id,
                is_hobby=is_hobby,
                date_str=date_str,
            )
            if emergency_items:
                pool_items.extend(emergency_items)
                rescored = _select_scored_items(
                    pool_items,
                    user_profile,
                    user_patterns,
                    user_preferences,
                    max_items=max_items,
                )
                scored_items = rescored

    if len(scored_items) < max_items:
        existing_urls = {item.get("url") for item in pool_items if item.get("url")}
        fallback_items = [
            item for item in today_pool
            if item.get("url") not in existing_urls
            and item.get("url") not in seen_urls
            and not is_blocklisted_url(
                item.get("url", ""),
                item.get("title", ""),
                DOCS_BLOCKLIST_PATTERNS,
            )
        ]
        if fallback_items:
            pool_items.extend(fallback_items)
            scored_items = _select_scored_items(
                pool_items,
                user_profile,
                user_patterns,
                user_preferences,
                max_items=max_items,
            )

    feed_items = []
    for item in scored_items[:max_items]:
        why_relevant = generate_why_relevant(
            item,
            user_profile,
            item.get("_score", 0),
        )
        feed_items.append(
            {
                "id": item.get("id", ""),
                "type": item.get("type", "blog"),
                "title": item.get("title", ""),
                "description": item.get("description", ""),
                "url": item.get("url", ""),
                "tags": item.get("tags", []),
                "source": item.get("source", ""),
                "thumbnail": item.get("thumbnail"),
                "umbrella_id": item.get("umbrella_id", ""),
                "query_id": item.get("query_id", ""),
                "score": item.get("_score", 0),
                "why_relevant": why_relevant,
                "quality_signals": item.get("quality_signals", {}),
                "metadata": {
                    "from_personal_signal": False,
                    "is_hobby_content": (
                        item.get("umbrella_id") in hobby_umbrella_ids
                    ),
                },
            }
        )

    return feed_items[:max_items]
