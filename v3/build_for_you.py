#!/usr/bin/env python3
"""
Build "For You" feed — interest-matched articles with career-goal boosting.

Phase 1 (pool): Fetch articles from for_you_sources.json → v3_for_you_pool
Phase 2 (feed): Per-user selection + scoring + summarise → write feed section

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
from v3.lib.store import V3Store, FOR_YOU_POOL, _today_ist  # noqa: E402
from v3.lib.content import fetch_content, fetch_og_image  # noqa: E402
from v3.lib.summarizer import get_or_generate_summary  # noqa: E402
from v3.lib.scorer import rank_articles  # noqa: E402
from v3.lib.diversity import dedupe_and_cap  # noqa: E402

CONFIG_PATH = "v3/config/for_you_sources.json"
DEFAULT_ITEMS = 8

ROLE_INTEREST_MAP: dict[str, list[str]] = {
    "designer":  ["experience", "marketing"],
    "developer": ["engineering", "technology"],
    "pm":        ["business-market", "leadership", "startups"],
    "marketer":  ["marketing", "business-market"],
    "founder":   ["startups", "leadership", "business-market"],
}
DEFAULT_LIMIT_PER_SOURCE = 5
DEFAULT_MAX_AGE = 14


def _log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] [v3-for-you] {msg}")


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Build For You feed")
    p.add_argument("--skip-pool", action="store_true")
    p.add_argument("--pool-only", action="store_true")
    p.add_argument("--user-id", default="")
    p.add_argument("--limit-users", type=int, default=0)
    p.add_argument("--items-per-user", type=int, default=DEFAULT_ITEMS)
    p.add_argument("--limit-per-source", type=int, default=DEFAULT_LIMIT_PER_SOURCE)
    p.add_argument("--max-age-days", type=int, default=DEFAULT_MAX_AGE)
    p.add_argument("--date", default="")
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


# -----------------------------------------------------------------------
# Phase 1: Pool refresh
# -----------------------------------------------------------------------

def refresh_pool(store: V3Store, config: dict[str, Any], limit_per_source: int) -> dict[str, int]:
    sources = config.get("sources", [])
    stats = {"sources": len(sources), "links_found": 0, "new_items": 0, "skipped": 0, "errors": 0}

    for src in sources:
        src_name = src["name"]
        _log(f"Fetching {src_name} ({src['url']})")

        try:
            result = fetch_article_links(src["url"], limit=limit_per_source)
            articles = result.articles if hasattr(result, "articles") else []
        except Exception as exc:
            _log(f"  ERROR fetching links: {exc}")
            stats["errors"] += 1
            continue

        stats["links_found"] += len(articles)
        _log(f"  Found {len(articles)} links")

        for art in articles:
            url = art.url if hasattr(art, "url") else art.get("url", "")
            if not url:
                continue

            if store.pool_item_exists(FOR_YOU_POOL, url):
                stats["skipped"] += 1
                continue

            title = art.title if hasattr(art, "title") else art.get("title", "")
            published = art.published_date if hasattr(art, "published_date") else art.get("published_date", "")
            og_image = art.og_image if hasattr(art, "og_image") else art.get("og_image", "")

            result_content = fetch_content(url)
            content = result_content["content"]
            if not content:
                _log(f"  No content for {url}")
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
            stats["new_items"] += 1
            _log(f"  + {title[:60]}")

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
    items_per_user = args.items_per_user or config.get("items_per_user", DEFAULT_ITEMS)
    max_age = args.max_age_days

    users = store.get_onboarded_users(args.audience)
    if args.user_id:
        users = [u for u in users if u.get("uid") == args.user_id]
    if args.limit_users > 0:
        users = users[: args.limit_users]

    _log(f"Building For You feeds for {len(users)} users, date={target_date}")
    stats = {"users": 0, "items_total": 0, "summaries_generated": 0, "summaries_cached": 0}

    for profile in users:
        uid = profile.get("uid", "")
        if not uid:
            continue

        interests = set(profile.get("interests", []))
        role = profile.get("role", "")
        goals = profile.get("careerGoals", []) or []
        style = profile.get("summaryStyle", "practitioner") or "practitioner"
        seniority = profile.get("seniority", "mid") or "mid"
        is_subscribed = is_user_subscribed(profile)

        # Unsubscribed users do not get For You items in v3 mode.
        if not is_subscribed:
            _log(f"  user={uid} unsubscribed, writing empty for_you")
            store.write_feed_section(uid, target_date, "for_you", [])
            stats["users"] += 1
            continue

        if not interests:
            _log(f"  user={uid} no interests, skipping")
            continue

        role_extras = set(ROLE_INTEREST_MAP.get(role, [])) - interests
        expanded = interests | role_extras
        if role_extras:
            _log(f"  user={uid} role={role} → injecting {sorted(role_extras)}")

        seen_urls = store.get_seen_urls(uid)
        _log(f"  user={uid} interests={sorted(interests)} expanded={sorted(expanded)} seen={len(seen_urls)}")

        candidates = store.load_pool(
            FOR_YOU_POOL,
            interest_ids=expanded,
            max_age_days=max_age,
            exclude_urls=seen_urls,
        )
        _log(f"  user={uid} candidates={len(candidates)}")

        if not candidates:
            _log(f"  user={uid} no candidates, writing empty")
            store.write_feed_section(uid, target_date, "for_you", [])
            stats["users"] += 1
            continue

        ranked = rank_articles(candidates, goals)
        diverse = dedupe_and_cap(ranked)
        picked = diverse[: items_per_user]

        feed_items: list[dict[str, Any]] = []
        for i, item in enumerate(picked, 1):
            _log(f"    [{i}/{len(picked)}] summarizing: {item.get('title', '')[:50]}")
            summary, was_cached = get_or_generate_summary(
                store=store,
                url=item.get("url", ""),
                title=item.get("title", ""),
                content=item.get("content", ""),
                style=style,
                seniority=seniority,
            )
            cache_tag = "cached" if was_cached else ("new" if summary else "failed")
            _log(f"    [{i}/{len(picked)}] summary={cache_tag}")
            if was_cached:
                stats["summaries_cached"] += 1
            elif summary:
                stats["summaries_generated"] += 1

            feed_items.append(_build_feed_item(item, summary))

        store.write_feed_section(uid, target_date, "for_you", feed_items)
        stats["users"] += 1
        stats["items_total"] += len(feed_items)
        _log(f"  user={uid} wrote {len(feed_items)} for_you items")

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
