#!/usr/bin/env python3
"""
Build "For You" feed — role-first, interest-matched articles.

Selection priority:
  1. Role's primary interest domain (majority of feed)
  2. User's explicitly chosen interests
  3. Career-goal keyword boosts within eligible items
  4. LLM reject-gate drops low-signal content at summary time

Phase 1 (pool): Fetch articles from for_you_sources.json → v3_for_you_pool
Phase 2 (feed): Per-user selection + scoring + summarise → write feed

Usage:
  python3 -m v3.build_for_you                          # both phases
  python3 -m v3.build_for_you --skip-pool               # feed only
  python3 -m v3.build_for_you --pool-only               # pool only
  python3 -m v3.build_for_you --user-id <uid>           # single user
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
load_dotenv(REPO_ROOT / ".env")

from v1.storage import is_user_subscribed  # noqa: E402
from v2.utils.fetch_article_links import fetch_article_links  # noqa: E402
from v3.lib.store import V3Store, FOR_YOU_POOL, FREE_TIER_LIMITS, _today_ist  # noqa: E402
from v3.lib.content import fetch_content, fetch_og_image  # noqa: E402
from v3.lib.summarizer import get_or_generate_summary, batch_presummarize, compute_technical_depth  # noqa: E402
from v3.lib.scorer import rank_articles  # noqa: E402
from v3.lib.diversity import dedupe_and_cap  # noqa: E402

CONFIG_PATH = "v3/config/for_you_sources.json"
DEFAULT_ITEMS = 0
DEFAULT_LIMIT_PER_SOURCE = 5
DEFAULT_MAX_AGE = 14
HEALTH_INTEREST_IDS = {"health", "biotech", "medicine", "health-tech"}
MEDICAL_TOPIC_KEYWORDS = {
    "cancer",
    "immune system",
    "immunity",
    "tumor",
    "tumour",
    "vaccine",
    "antibody",
    "clinical trial",
    "drug discovery",
    "molecule",
    "genome",
    "protein",
    "diagnosis",
    "diagnostic",
    "disease",
    "hospital",
}

ROLE_PRIMARY_INTERESTS: dict[str, list[str]] = {
    "designer":  ["experience"],
    "developer": ["engineering", "technology"],
    "pm":        ["business-market", "startups"],
    "marketer":  ["marketing", "business-market"],
    "founder":   ["startups", "business-market", "leadership"],
}

ROLE_QUOTA = 0.5


def _log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] [v3-for-you] {msg}")


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Build For You feed")
    p.add_argument("--skip-pool", action="store_true")
    p.add_argument("--pool-only", action="store_true")
    p.add_argument("--user-id", default="")
    p.add_argument("--limit-users", type=int, default=0)
    p.add_argument(
        "--items-per-user", type=int, default=DEFAULT_ITEMS,
        help="Items per user (0 = use config value)",
    )
    p.add_argument(
        "--limit-per-source", type=int,
        default=DEFAULT_LIMIT_PER_SOURCE,
    )
    p.add_argument(
        "--max-age-days", type=int, default=DEFAULT_MAX_AGE,
    )
    p.add_argument("--date", default="")
    p.add_argument(
        "--users-file",
        default="",
        help="Optional JSON file with pre-fetched user profiles",
    )
    p.add_argument(
        "--audience",
        choices=["subscribed", "unsubscribed", "all"],
        default="subscribed",
        help="Which users to build for",
    )
    return p.parse_args()


def _load_config() -> dict[str, Any]:
    with open(REPO_ROOT / CONFIG_PATH) as f:
        return json.load(f)


def _load_users(
    store: V3Store, args: argparse.Namespace,
) -> list[dict[str, Any]]:
    if args.users_file:
        try:
            with open(args.users_file, "r", encoding="utf-8") as f:
                rows = json.load(f)
            if isinstance(rows, list):
                _log(f"Loaded {len(rows)} users from snapshot {args.users_file}")
                return rows
        except Exception as exc:
            _log(f"WARNING users snapshot load failed ({exc}); falling back to Firestore")
    return store.get_onboarded_users(args.audience)


def _title_matches_keywords(
    title: str, keywords: list[str],
) -> bool:
    if not keywords:
        return True
    lower = title.lower()
    return any(kw.lower() in lower for kw in keywords)


def _title_has_excluded_keywords(
    title: str, keywords: list[str],
) -> bool:
    if not keywords:
        return False
    lower = title.lower()
    return any(kw.lower() in lower for kw in keywords)


def _build_source_weight_map(
    config: dict[str, Any],
) -> dict[str, float]:
    """Map source_name → source_weight from config."""
    out: dict[str, float] = {}
    for src in config.get("sources", []):
        name = src.get("name", "").strip()
        if name:
            out[name] = src.get("source_weight", 1.0)
    return out


def _is_medical_topic(item: dict[str, Any]) -> bool:
    """Detect medical-heavy stories for health/biotech lanes only."""
    title = str(item.get("title", "")).lower()
    content = str(item.get("content", "")).lower()[:2500]
    text = f"{title} {content}"
    return any(kw in text for kw in MEDICAL_TOPIC_KEYWORDS)


def _apply_role_quota(
    ranked: list[dict[str, Any]],
    role_primary: set[str],
    target: int,
) -> list[dict[str, Any]]:
    """Enforce role-first quota: at least ROLE_QUOTA of items
    from role's primary interests, then fill from the rest."""
    if not role_primary:
        return ranked[:target]

    primary = [a for a in ranked if a.get("interest_id") in role_primary]
    other = [a for a in ranked if a.get("interest_id") not in role_primary]

    min_primary = max(1, int(target * ROLE_QUOTA))
    picked_primary = primary[:min_primary]
    remaining = target - len(picked_primary)
    leftover_primary = primary[min_primary:]
    fill_pool = leftover_primary + other
    picked = picked_primary + fill_pool[:remaining]
    return picked


# -----------------------------------------------------------------------
# Phase 1: Pool refresh
# -----------------------------------------------------------------------

def refresh_pool(store: V3Store, config: dict[str, Any], limit_per_source: int) -> dict[str, int]:
    from concurrent.futures import ThreadPoolExecutor, as_completed
    import threading

    sources = config.get("sources", [])
    stats = {"sources": len(sources), "links_found": 0, "new_items": 0, "skipped": 0, "filtered": 0, "errors": 0}
    stats_lock = threading.Lock()

    def _process_source(src: dict[str, Any]) -> None:
        src_name = src["name"]
        title_keywords = src.get("title_keywords", [])
        exclude_title_keywords = src.get("exclude_title_keywords", [])
        _log(f"Fetching {src_name} ({src['url']})")

        try:
            result = fetch_article_links(src["url"], limit=limit_per_source)
            articles = result.articles if hasattr(result, "articles") else []
        except Exception as exc:
            _log(f"  ERROR fetching {src_name}: {exc}")
            with stats_lock:
                stats["errors"] += 1
            return

        with stats_lock:
            stats["links_found"] += len(articles)
        _log(f"  {src_name}: {len(articles)} links")

        article_urls = [
            art.url if hasattr(art, "url") else art.get("url", "")
            for art in articles
        ]
        existing_urls = store.pool_items_exist(FOR_YOU_POOL, article_urls)

        for art in articles:
            url = art.url if hasattr(art, "url") else art.get("url", "")
            if not url:
                continue

            if url in existing_urls:
                with stats_lock:
                    stats["skipped"] += 1
                continue

            title = art.title if hasattr(art, "title") else art.get("title", "")
            if title_keywords and not _title_matches_keywords(title, title_keywords):
                with stats_lock:
                    stats["filtered"] += 1
                continue
            if exclude_title_keywords and _title_has_excluded_keywords(
                title, exclude_title_keywords
            ):
                with stats_lock:
                    stats["filtered"] += 1
                continue
            published = art.published_date if hasattr(art, "published_date") else art.get("published_date", "")
            og_image = art.og_image if hasattr(art, "og_image") else art.get("og_image", "")

            result_content = fetch_content(url)
            content = result_content["content"]
            if not content:
                _log(f"  No content for {url}")
                with stats_lock:
                    stats["errors"] += 1
                continue
            if not og_image:
                og_image = result_content.get("image", "") or fetch_og_image(url)

            store.upsert_pool_item(FOR_YOU_POOL, url, {
                "title": title,
                "published_date": str(published) if published else "",
                "og_image": og_image,
                "content": content[:15000],
                "content_length": len(content),
                "interest_id": src.get("interest_id", ""),
                "subinterest_id": src.get("subinterest_id", ""),
                "source_name": src_name,
                "source_url": src["url"],
                "content_source": result_content["source"],
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "is_active": True,
            })
            with stats_lock:
                stats["new_items"] += 1
            _log(f"  + {title[:60]}")
            existing_urls.add(url)

    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(_process_source, src) for src in sources]
        for f in as_completed(futures):
            exc = f.exception()
            if exc:
                _log(f"  Source worker error: {exc}")

    stale = store.deactivate_stale(FOR_YOU_POOL, max_age_days=DEFAULT_MAX_AGE + 7)
    stats["deactivated"] = stale
    _log(f"Pool refresh done: {stats}")
    return stats


# -----------------------------------------------------------------------
# Phase 2: Per-user feed generation
# -----------------------------------------------------------------------

def _build_feed_item(pool_item: dict[str, Any], summary: dict[str, Any] | None) -> dict[str, Any]:
    url = pool_item.get("url", "")
    domain = urlparse(url).netloc.lower() if url else ""
    item_id = hashlib.sha256(url.encode("utf-8")).hexdigest()[:32]
    return {
        "id": f"fy_{item_id}",
        "url": url,
        "title": pool_item.get("title", ""),
        "type": "blog",
        "source": domain,
        "source_name": pool_item.get("source_name", domain),
        "interest_id": pool_item.get("interest_id", ""),
        "subinterest_id": pool_item.get("subinterest_id", ""),
        "feed_type": "for_you",
        "published_date": pool_item.get("published_date", ""),
        "thumbnail": pool_item.get("og_image", ""),
        "summary": summary or {},
        "metadata": {
            "feed_type": "for_you",
            "content_length": pool_item.get("content_length", 0),
        },
    }


def build_user_feeds(
    store: V3Store,
    config: dict[str, Any],
    args: argparse.Namespace,
) -> dict[str, int]:
    target_date = args.date.strip() or _today_ist()
    cfg_items = config.get("items_per_user", 8)
    items_per_user = args.items_per_user or cfg_items
    max_age = args.max_age_days

    users = _load_users(store, args)
    if args.user_id:
        users = [
            u for u in users if u.get("uid") == args.user_id
        ]
    if args.limit_users > 0:
        users = users[: args.limit_users]

    _log(
        f"Building For You for {len(users)} users, "
        f"date={target_date}"
    )

    # ------------------------------------------------------------------
    # PHASE 2a: Pick articles per user (role-first, strict interests)
    # ------------------------------------------------------------------
    _log("-" * 40)
    _log("PHASE 2a: Select articles per user")
    _log("-" * 40)

    user_picks: list[tuple[dict, list[dict]]] = []
    allowed_sources = {
        str(src.get("name", "")).strip()
        for src in config.get("sources", [])
        if str(src.get("name", "")).strip()
    }
    source_weights = _build_source_weight_map(config)
    eligible_union: set[str] = set()
    user_inputs: list[tuple[dict, set[str], set[str], list[str], int, str, bool]] = []

    for profile in users:
        uid = profile.get("uid", "")
        if not uid:
            continue

        interests = set(profile.get("interests", []))
        role = profile.get("role", "")
        goals = profile.get("careerGoals", []) or []
        is_sub = is_user_subscribed(profile)
        target = (
            items_per_user
            if is_sub
            else FREE_TIER_LIMITS.get("for_you", 2)
        )

        role_primary = set(
            ROLE_PRIMARY_INTERESTS.get(role, [])
        )

        if not interests and not role_primary:
            _log(f"  user={uid} no interests, skip")
            store.write_feed_section(
                uid, target_date, "for_you", [],
            )
            continue

        eligible = set(interests)
        if not eligible:
            eligible = role_primary.copy()
        elif role_primary - eligible:
            eligible |= role_primary

        eligible_union |= eligible
        user_inputs.append(
            (
                profile,
                eligible,
                role_primary,
                goals,
                target,
                role,
                is_sub,
            )
        )

    all_candidates: list[dict[str, Any]] = []
    if user_inputs and eligible_union:
        all_candidates = store.load_pool(
            FOR_YOU_POOL,
            interest_ids=eligible_union,
            source_names=allowed_sources,
            max_age_days=max_age,
        )
    _log(f"Loaded {len(all_candidates)} shared for_you pool candidates")

    for (
        profile,
        eligible,
        role_primary,
        goals,
        target,
        role,
        is_sub,
    ) in user_inputs:
        uid = profile.get("uid", "")
        if not uid:
            continue
        seen_urls = store.get_seen_urls(uid)
        candidates = [
            c for c in all_candidates
            if c.get("interest_id", "") in eligible
            and c.get("url", "") not in seen_urls
        ]
        allow_medical = bool(eligible & HEALTH_INTEREST_IDS)
        if not allow_medical:
            candidates = [
                c for c in candidates
                if not _is_medical_topic(c)
            ]

        for c in candidates:
            sn = c.get("source_name", "")
            c["_source_weight"] = source_weights.get(sn, 1.0)

        if not candidates:
            store.write_feed_section(
                uid, target_date, "for_you", [],
            )
            continue

        ranked = rank_articles(
            candidates, goals,
            role_primary_interests=role_primary,
        )
        diverse = dedupe_and_cap(ranked)
        picked = _apply_role_quota(
            diverse, role_primary, target,
        )

        tier = "free" if not is_sub else "pro"
        _log(
            f"  user={uid} {tier} role={role} "
            f"eligible={sorted(eligible)} → {len(picked)}"
        )
        user_picks.append((profile, picked))

    # ------------------------------------------------------------------
    # PHASE 2b: Batch pre-summarize by technical_depth
    # ------------------------------------------------------------------
    _log("-" * 40)
    _log("PHASE 2b: Pre-summarize needed articles (parallel, by depth)")
    _log("-" * 40)

    # Group articles by technical_depth
    items_by_depth: dict[str, dict[str, dict]] = {"deep": {}, "accessible": {}}
    user_depths: dict[str, str] = {}

    for profile, picked in user_picks:
        uid = profile.get("uid", "")
        depth = compute_technical_depth(profile)
        user_depths[uid] = depth
        _log(f"  user={uid} → technical_depth={depth}")

        for item in picked:
            url = item.get("url", "")
            if url and url not in items_by_depth[depth]:
                items_by_depth[depth][url] = item

    # Run batch per depth — using learning cards format for mobile
    summary_maps: dict[str, dict[str, dict[str, Any] | None]] = {}
    for depth in ["deep", "accessible"]:
        items = list(items_by_depth[depth].values())
        if not items:
            summary_maps[depth] = {}
            continue
        _log(f"Batch summarize {len(items)} articles for depth={depth} (cards format)")
        presummary = batch_presummarize(
            store, items,
            feed_type="default", max_workers=8,
            technical_depth=depth,
            output_format="cards",  # Generate learning cards for swipeable mobile UX
        )
        summary_maps[depth] = presummary.get("summary_map", {}) or {}

    # ------------------------------------------------------------------
    # PHASE 2c: Assemble feeds (all summaries now cached — fast)
    # ------------------------------------------------------------------
    _log("-" * 40)
    _log("PHASE 2c: Assemble feeds from cache")
    _log("-" * 40)

    stats = {
        "users": 0,
        "items_total": 0,
        "summaries_generated": 0,
        "summaries_cached": 0,
        "rejected_items": 0,
        "users_deep": 0,
        "users_accessible": 0,
    }

    for profile, picked in user_picks:
        uid = profile.get("uid", "")
        depth = user_depths.get(uid, "accessible")
        depth_map = summary_maps.get(depth, {})

        feed_items: list[dict[str, Any]] = []
        for item in picked:
            url = item.get("url", "")
            if url in depth_map:
                summary = depth_map[url]
                was_cached = True
            else:
                summary, was_cached = get_or_generate_summary(
                    store=store,
                    url=url,
                    title=item.get("title", ""),
                    content=item.get("content", ""),
                    feed_type="default",
                    technical_depth=depth,
                    output_format="cards",  # Learning cards for swipeable mobile UX
                )
            if not summary:
                stats["rejected_items"] += 1
                continue
            if was_cached:
                stats["summaries_cached"] += 1
            else:
                stats["summaries_generated"] += 1

            feed_items.append(_build_feed_item(item, summary))

        store.write_feed_section(uid, target_date, "for_you", feed_items)
        stats["users"] += 1
        stats["items_total"] += len(feed_items)
        if depth == "deep":
            stats["users_deep"] += 1
        else:
            stats["users_accessible"] += 1
        _log(f"  user={uid} depth={depth} wrote {len(feed_items)} for_you items")

    store.record_run("for_you", {"date": target_date, **stats})
    _log(f"For You feeds done: {stats}")
    return stats


# -----------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------

def main() -> None:
    args = _parse_args()
    _log("=" * 50)
    _log("FOR YOU — Starting")
    _log(
        f"  user-id={args.user_id or 'ALL'} audience={args.audience} "
        f"skip-pool={args.skip_pool} pool-only={args.pool_only}"
    )
    _log("=" * 50)

    store = V3Store()
    config = _load_config()
    sources = config.get("sources", [])
    _log(f"Config loaded: {len(sources)} sources")

    if not args.skip_pool:
        _log("-" * 40)
        _log("PHASE 1: Pool refresh")
        _log("-" * 40)
        pool_stats = refresh_pool(store, config, args.limit_per_source)
        if args.pool_only:
            print(json.dumps(pool_stats, indent=2))
            return

    _log("-" * 40)
    _log("PHASE 2: Per-user feed generation")
    _log("-" * 40)
    feed_stats = build_user_feeds(store, config, args)
    _log("=" * 50)
    _log(f"FOR YOU — Complete: {feed_stats}")
    _log("=" * 50)
    print(json.dumps(feed_stats, indent=2))


if __name__ == "__main__":
    main()
