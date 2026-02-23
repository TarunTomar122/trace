#!/usr/bin/env python3
"""
Build "Trending" feed — unfiltered explore-style latest news across ALL topics.

Phase 1 (pool): Fetch from trending_sources.json → v3_trending_pool
Phase 2 (feed): Per-user selection (no interest filter) → dedup → summarise → write

Trending has a shorter freshness window (48h) and refreshes more often.

Usage:
  python3 -m v3.build_trending
  python3 -m v3.build_trending --skip-pool
  python3 -m v3.build_trending --pool-only
  python3 -m v3.build_trending --user-id <uid>
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timedelta, timezone
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
from v3.lib.store import V3Store, TRENDING_POOL, FREE_TIER_LIMITS, _today_ist  # noqa: E402
from v3.lib.content import fetch_content, fetch_og_image  # noqa: E402
from v3.lib.summarizer import get_or_generate_summary, batch_presummarize  # noqa: E402
from v3.lib.diversity import dedupe_and_cap  # noqa: E402

CONFIG_PATH = "v3/config/trending_sources.json"
DEFAULT_ITEMS = 5
DEFAULT_LIMIT_PER_SOURCE = 8
DEFAULT_MAX_AGE_HOURS = 48


def _log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] [v3-trending] {msg}")


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Build Trending feed")
    p.add_argument("--skip-pool", action="store_true")
    p.add_argument("--pool-only", action="store_true")
    p.add_argument("--user-id", default="")
    p.add_argument("--limit-users", type=int, default=0)
    p.add_argument("--items-per-user", type=int, default=DEFAULT_ITEMS)
    p.add_argument("--limit-per-source", type=int, default=DEFAULT_LIMIT_PER_SOURCE)
    p.add_argument("--max-age-hours", type=int, default=DEFAULT_MAX_AGE_HOURS)
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


def _title_matches_keywords(title: str, keywords: list[str]) -> bool:
    if not keywords:
        return True
    lower = title.lower()
    return any(kw.lower() in lower for kw in keywords)


# -----------------------------------------------------------------------
# Phase 1: Pool refresh
# -----------------------------------------------------------------------

def refresh_pool(store: V3Store, config: dict[str, Any], limit_per_source: int) -> dict[str, int]:
    sources = config.get("sources", [])
    max_age_hours = config.get("max_age_hours", DEFAULT_MAX_AGE_HOURS)
    stats = {"sources": len(sources), "links_found": 0, "new_items": 0, "skipped": 0, "filtered": 0, "errors": 0}

    for src in sources:
        src_name = src["name"]
        title_keywords = src.get("title_keywords", [])
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

            title = art.title if hasattr(art, "title") else art.get("title", "")

            if title_keywords and not _title_matches_keywords(title, title_keywords):
                stats["filtered"] += 1
                continue

            if store.pool_item_exists(TRENDING_POOL, url):
                stats["skipped"] += 1
                continue

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

            store.upsert_pool_item(TRENDING_POOL, url, {
                "title": title,
                "published_date": str(published) if published else "",
                "og_image": og_image,
                "content": content[:10000],
                "content_length": len(content),
                "interest_id": src.get("interest_id", ""),
                "source_name": src_name,
                "source_url": src["url"],
                "content_source": result_content["source"],
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "is_active": True,
            })
            stats["new_items"] += 1
            _log(f"  + {title[:60]}")

    # Trending items expire faster
    max_age_days = max(1, max_age_hours // 24 + 1)
    stale = store.deactivate_stale(TRENDING_POOL, max_age_days=max_age_days + 1)
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
        "id": f"tr_{item_id}",
        "url": url,
        "title": pool_item.get("title", ""),
        "type": "news",
        "source": domain,
        "source_name": pool_item.get("source_name", domain),
        "interest_id": pool_item.get("interest_id", ""),
        "feed_type": "trending",
        "published_date": pool_item.get("published_date", ""),
        "thumbnail": pool_item.get("og_image", ""),
        "summary": summary or {},
        "metadata": {
            "feed_type": "trending",
            "is_hot": True,
            "why_relevant": f"Trending \u2022 {pool_item.get('source_name', '')}",
        },
    }


def build_user_feeds(
    store: V3Store,
    config: dict[str, Any],
    args: argparse.Namespace,
) -> dict[str, int]:
    target_date = args.date.strip() or _today_ist()
    items_per_user = args.items_per_user or config.get("items_per_user", DEFAULT_ITEMS)
    max_age_hours = args.max_age_hours
    max_age_days = max(1, max_age_hours // 24 + 1)

    users = store.get_onboarded_users(args.audience)
    if args.user_id:
        users = [u for u in users if u.get("uid") == args.user_id]
    if args.limit_users > 0:
        users = users[: args.limit_users]

    _log(f"Building Trending feeds for {len(users)} users, date={target_date}")

    # ------------------------------------------------------------------
    # PHASE 2a: Pick articles for every user (fast — no OpenAI calls)
    # ------------------------------------------------------------------
    _log("-" * 40)
    _log("PHASE 2a: Select articles per user")
    _log("-" * 40)

    user_picks: list[tuple[dict, list[dict], str, str]] = []

    for profile in users:
        uid = profile.get("uid", "")
        if not uid:
            continue

        style = profile.get("summaryStyle", "practitioner") or "practitioner"
        seniority = profile.get("seniority", "mid") or "mid"
        is_subscribed = is_user_subscribed(profile)
        user_items_target = items_per_user if is_subscribed else FREE_TIER_LIMITS.get("trending", 5)

        seen_urls = store.get_seen_urls(uid)

        candidates = store.load_pool(
            TRENDING_POOL,
            max_age_days=max_age_days,
            exclude_urls=seen_urls,
        )

        if not candidates:
            store.write_feed_section(uid, target_date, "trending", [])
            continue

        candidates = dedupe_and_cap(candidates)

        by_interest: dict[str, list[dict[str, Any]]] = {}
        for item in candidates:
            iid = item.get("interest_id", "other")
            by_interest.setdefault(iid, []).append(item)

        picked: list[dict[str, Any]] = []
        interest_keys = sorted(by_interest.keys())
        while len(picked) < user_items_target and interest_keys:
            exhausted = []
            for key in interest_keys:
                if len(picked) >= user_items_target:
                    break
                bucket = by_interest[key]
                if bucket:
                    picked.append(bucket.pop(0))
                else:
                    exhausted.append(key)
            for k in exhausted:
                interest_keys.remove(k)

        _log(f"  user={uid} → {len(picked)} items")
        user_picks.append((profile, picked, style, seniority))

    # ------------------------------------------------------------------
    # PHASE 2b: Batch pre-summarize only the articles users actually need
    # ------------------------------------------------------------------
    _log("-" * 40)
    _log("PHASE 2b: Pre-summarize needed articles (parallel)")
    _log("-" * 40)

    needed_items: dict[str, dict] = {}
    needed_combos: set[tuple[str, str]] = set()
    for _, picked, style, seniority in user_picks:
        needed_combos.add((style, seniority))
        for item in picked:
            url = item.get("url", "")
            if url and url not in needed_items:
                needed_items[url] = item

    _log(f"Unique articles needed: {len(needed_items)}, combos: {len(needed_combos)}")

    if needed_items and needed_combos:
        batch_presummarize(
            store, list(needed_items.values()), list(needed_combos),
            feed_type="default", max_workers=8,
        )

    # ------------------------------------------------------------------
    # PHASE 2c: Assemble feeds (all summaries now cached — fast)
    # ------------------------------------------------------------------
    _log("-" * 40)
    _log("PHASE 2c: Assemble feeds from cache")
    _log("-" * 40)

    stats = {"users": 0, "items_total": 0, "summaries_generated": 0, "summaries_cached": 0}

    for profile, picked, style, seniority in user_picks:
        uid = profile.get("uid", "")

        feed_items: list[dict[str, Any]] = []
        for item in picked:
            summary, was_cached = get_or_generate_summary(
                store=store,
                url=item.get("url", ""),
                title=item.get("title", ""),
                content=item.get("content", ""),
                style=style,
                seniority=seniority,
            )
            if was_cached:
                stats["summaries_cached"] += 1
            elif summary:
                stats["summaries_generated"] += 1

            feed_items.append(_build_feed_item(item, summary))

        store.write_feed_section(uid, target_date, "trending", feed_items)
        stats["users"] += 1
        stats["items_total"] += len(feed_items)
        _log(f"  user={uid} wrote {len(feed_items)} trending items")

    store.record_run("trending", {"date": target_date, **stats})
    _log(f"Trending feeds done: {stats}")
    return stats


# -----------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------

def main() -> None:
    args = _parse_args()
    _log("=" * 50)
    _log("TRENDING — Starting")
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
    _log(f"TRENDING — Complete: {feed_stats}")
    _log("=" * 50)
    print(json.dumps(feed_stats, indent=2))


if __name__ == "__main__":
    main()
