#!/usr/bin/env python3
"""
Build "Deep Dives" feed — expert content from user-selected sources.

Users choose specific sources during onboarding (step 3).
Only articles from those sources appear in their Deep Dives.

Phase 1 (pool): Fetch articles from deep_dive_sources.json → v3_deep_dive_pool
Phase 2 (feed): Per-user selection by selectedLearningSources → summarise → write

Usage:
  python3 -m v3.build_deep_dives
  python3 -m v3.build_deep_dives --skip-pool
  python3 -m v3.build_deep_dives --pool-only
  python3 -m v3.build_deep_dives --user-id <uid>
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
from v3.lib.store import V3Store, DEEP_DIVE_POOL, FREE_TIER_LIMITS, _today_ist  # noqa: E402
from v3.lib.content import fetch_content, fetch_og_image  # noqa: E402
from v3.lib.summarizer import get_or_generate_summary  # noqa: E402
from v3.lib.diversity import dedupe_and_cap  # noqa: E402

CONFIG_PATH = "v3/config/deep_dive_sources.json"
DEFAULT_ITEMS = 4
DEFAULT_LIMIT_PER_SOURCE = 5
DEFAULT_MAX_AGE = 60


def _log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] [v3-deep-dives] {msg}")


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Build Deep Dives feed")
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

            if store.pool_item_exists(DEEP_DIVE_POOL, url):
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

            store.upsert_pool_item(DEEP_DIVE_POOL, url, {
                "title": title,
                "published_date": str(published) if published else "",
                "og_image": og_image,
                "content": content[:15000],
                "content_length": len(content),
                "category_id": src.get("category_id", ""),
                "source_name": src_name,
                "source_url": src["url"],
                "source_description": src.get("description", ""),
                "content_source": result_content["source"],
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "is_active": True,
            })
            stats["new_items"] += 1
            _log(f"  + {title[:60]}")

    stale = store.deactivate_stale(DEEP_DIVE_POOL, max_age_days=DEFAULT_MAX_AGE + 30)
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
    src_name = pool_item.get("source_name", domain)
    return {
        "id": f"dd_{item_id}",
        "url": url,
        "title": pool_item.get("title", ""),
        "type": "blog",
        "source": domain,
        "source_name": src_name,
        "category_id": pool_item.get("category_id", ""),
        "feed_type": "deep_dives",
        "published_date": pool_item.get("published_date", ""),
        "thumbnail": pool_item.get("og_image", ""),
        "summary": summary or {},
        "metadata": {
            "feed_type": "deep_dives",
            "source_description": pool_item.get("source_description", ""),
            "why_relevant": f"Deep dive \u2022 {src_name}",
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

    _log(f"Building Deep Dive feeds for {len(users)} users, date={target_date}")
    stats = {"users": 0, "items_total": 0, "summaries_generated": 0, "summaries_cached": 0}

    for profile in users:
        uid = profile.get("uid", "")
        if not uid:
            continue

        selected_sources = set(profile.get("selectedLearningSources", []) or [])
        style = profile.get("summaryStyle", "practitioner") or "practitioner"
        seniority = profile.get("seniority", "mid") or "mid"
        is_subscribed = is_user_subscribed(profile)
        user_items_target = items_per_user if is_subscribed else FREE_TIER_LIMITS.get("deep_dives", 1)
        if not is_subscribed:
            _log(f"  user={uid} free tier → capped to {user_items_target} deep dives")

        if not selected_sources:
            _log(f"  user={uid} no selected sources, skipping")
            store.write_feed_section(uid, target_date, "deep_dives", [])
            stats["users"] += 1
            continue

        seen_urls = store.get_seen_urls(uid)
        _log(f"  user={uid} sources={sorted(selected_sources)} seen={len(seen_urls)}")

        candidates = store.load_pool(
            DEEP_DIVE_POOL,
            source_names=selected_sources,
            max_age_days=max_age,
            exclude_urls=seen_urls,
        )
        _log(f"  user={uid} candidates={len(candidates)}")

        if not candidates:
            _log(f"  user={uid} no candidates, writing empty")
            store.write_feed_section(uid, target_date, "deep_dives", [])
            stats["users"] += 1
            continue

        candidates = dedupe_and_cap(candidates, max_per_source=3)

        by_source: dict[str, list[dict[str, Any]]] = {}
        for item in candidates:
            sn = item.get("source_name", "")
            by_source.setdefault(sn, []).append(item)

        picked: list[dict[str, Any]] = []
        source_keys = sorted(by_source.keys())
        while len(picked) < user_items_target and source_keys:
            exhausted = []
            for key in source_keys:
                if len(picked) >= user_items_target:
                    break
                bucket = by_source[key]
                if bucket:
                    picked.append(bucket.pop(0))
                else:
                    exhausted.append(key)
            for k in exhausted:
                source_keys.remove(k)

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
                feed_type="deep_dives",
            )
            cache_tag = "cached" if was_cached else ("new" if summary else "failed")
            _log(f"    [{i}/{len(picked)}] summary={cache_tag}")
            if was_cached:
                stats["summaries_cached"] += 1
            elif summary:
                stats["summaries_generated"] += 1

            feed_items.append(_build_feed_item(item, summary))

        store.write_feed_section(uid, target_date, "deep_dives", feed_items)
        stats["users"] += 1
        stats["items_total"] += len(feed_items)
        _log(f"  user={uid} wrote {len(feed_items)} deep_dive items")

    store.record_run("deep_dives", {"date": target_date, **stats})
    _log(f"Deep Dive feeds done: {stats}")
    return stats


# -----------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------

def main() -> None:
    args = _parse_args()
    _log("=" * 50)
    _log("DEEP DIVES — Starting")
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
    _log(f"DEEP DIVES — Complete: {feed_stats}")
    _log("=" * 50)
    print(json.dumps(feed_stats, indent=2))


if __name__ == "__main__":
    main()
