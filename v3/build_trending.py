#!/usr/bin/env python3
"""
Build "Trending" feed — global news feed shared by all users.

Phase 1 (pool): Fetch from trending_sources.json → v3_trending_pool
Phase 2 (feed): Build ONE global feed → v3_user_feeds/_global/daily/{date}

Clients read from global feed and filter out seen URLs.
Designed to run every 2 hours for fresh news.

Usage:
  python3 -m v3.build_trending                    # full refresh
  python3 -m v3.build_trending --skip-pool        # feed only (use cached pool)
  python3 -m v3.build_trending --pool-only        # pool only
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

from v2.utils.fetch_article_links import fetch_article_links  # noqa: E402
from v3.lib.store import V3Store, TRENDING_POOL, _today_ist  # noqa: E402
from v3.lib.content import fetch_content, fetch_og_image  # noqa: E402
from v3.lib.summarizer import batch_presummarize  # noqa: E402
from v3.lib.diversity import dedupe_trending_latest_story  # noqa: E402

CONFIG_PATH = "v3/config/trending_sources.json"
DEFAULT_LIMIT_PER_SOURCE = 10
DEFAULT_MAX_AGE_HOURS = 24  # Show news from last 24 hours only
PROMO_TITLE_KEYWORDS = (
    "deal",
    "deals",
    "sale",
    "discount",
    "coupon",
    "under $",
    "how to watch",
    "watch live",
    "best ",
    "review",
    "app cleaner",
    "uninstaller",
)
PROMO_CONTENT_KEYWORDS = (
    "affiliate",
    "sponsored",
    "we may earn a commission",
    "buy now",
)


def _log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] [v3-trending] {msg}")


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Build Trending feed (global)")
    p.add_argument("--skip-pool", action="store_true", help="Skip pool refresh, use cached articles")
    p.add_argument("--pool-only", action="store_true", help="Only refresh pool, don't build feed")
    p.add_argument("--limit-per-source", type=int, default=DEFAULT_LIMIT_PER_SOURCE)
    p.add_argument("--max-age-hours", type=int, default=DEFAULT_MAX_AGE_HOURS)
    p.add_argument("--date", default="", help="Target date (default: today IST)")
    return p.parse_args()


def _load_config() -> dict[str, Any]:
    with open(REPO_ROOT / CONFIG_PATH) as f:
        return json.load(f)


def _title_matches_keywords(title: str, keywords: list[str]) -> bool:
    if not keywords:
        return True
    lower = title.lower()
    return any(kw.lower() in lower for kw in keywords)


def _title_has_excluded_keywords(title: str, keywords: list[str]) -> bool:
    if not keywords:
        return False
    lower = title.lower()
    return any(kw.lower() in lower for kw in keywords)


def _parse_dt(value: str) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (ValueError, TypeError):
        return None


def _looks_promotional(title: str, content: str = "") -> bool:
    tl = (title or "").lower()
    cl = (content or "").lower()
    if any(k in tl for k in PROMO_TITLE_KEYWORDS):
        return True
    if any(k in cl for k in PROMO_CONTENT_KEYWORDS):
        return True
    return False


def _candidate_score(
    item: dict[str, Any], source_weights: dict[str, float]
) -> float:
    title = item.get("title", "") or ""
    content = item.get("content", "") or ""
    source_name = item.get("source_name", "")
    pub = item.get("published_date", "") or item.get("fetched_at", "")
    dt = _parse_dt(str(pub))

    # Recency score (0..2) for last 48h window.
    recency = 0.0
    if dt:
        age_hours = max(
            0.0, (datetime.now(timezone.utc) - dt).total_seconds() / 3600
        )
        recency = max(0.0, (48.0 - age_hours) / 48.0) * 2.0

    score = source_weights.get(source_name, 1.0) + recency

    # Lightweight quality signals.
    tl = title.lower()
    if any(
        tok in tl
        for tok in (
            "openai",
            "ai",
            "launch",
            "releases",
            "research",
            "chip",
            "model",
            "funding",
            "acquire",
            "regulation",
            "policy",
            "security",
        )
    ):
        score += 0.5

    if _looks_promotional(title, content[:600]):
        score -= 3.0

    return score


def _rank_candidates(
    items: list[dict[str, Any]],
    source_weights: dict[str, float],
) -> list[dict[str, Any]]:
    """Filter low-quality/promotional content, then sort by recency (latest first)."""
    filtered = []
    for item in items:
        title = item.get("title", "") or ""
        content = item.get("content", "") or ""

        # Skip promotional content
        if _looks_promotional(title, content[:600]):
            continue

        # Skip very short content (likely not real articles)
        if len(content) < 500:
            continue

        # Compute quality score - skip low quality items
        score = _candidate_score(item, source_weights)
        if score < 1.5:  # Minimum quality threshold
            continue

        filtered.append(item)

    # Sort by published_date descending (latest first)
    filtered.sort(
        key=lambda x: x.get("published_date", "") or x.get("fetched_at", ""),
        reverse=True,
    )
    return filtered


# -----------------------------------------------------------------------
# Phase 1: Pool refresh
# -----------------------------------------------------------------------

def refresh_pool(store: V3Store, config: dict[str, Any], limit_per_source: int) -> dict[str, int]:
    from concurrent.futures import ThreadPoolExecutor, as_completed
    import threading

    sources = config.get("sources", [])
    max_age_hours = config.get("max_age_hours", DEFAULT_MAX_AGE_HOURS)
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
        existing_urls = store.pool_items_exist(TRENDING_POOL, article_urls)

        for art in articles:
            url = art.url if hasattr(art, "url") else art.get("url", "")
            if not url:
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

            if url in existing_urls:
                with stats_lock:
                    stats["skipped"] += 1
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
            with stats_lock:
                stats["new_items"] += 1
            _log(f"  + {title[:60]}")
            existing_urls.add(url)

    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = [executor.submit(_process_source, src) for src in sources]
        for f in as_completed(futures):
            exc = f.exception()
            if exc:
                _log(f"  Source worker error: {exc}")

    max_age_days = max(1, max_age_hours // 24 + 1)
    stale = store.deactivate_stale(TRENDING_POOL, max_age_days=max_age_days + 1)
    stats["deactivated"] = stale
    _log(f"Pool refresh done: {stats}")
    return stats


# -----------------------------------------------------------------------
# Phase 2: Global feed generation (shared by all users)
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
            "why_relevant": f"Trending • {pool_item.get('source_name', '')}",
        },
    }


def build_global_feed(
    store: V3Store,
    config: dict[str, Any],
    args: argparse.Namespace,
) -> dict[str, int]:
    """
    Build ONE global trending feed that all users share.

    Clients filter out seen URLs and apply tier limits when reading.
    This is much more efficient than per-user generation.
    """
    target_date = args.date.strip() or _today_ist()
    max_age_hours = args.max_age_hours
    max_age_days = max(1, max_age_hours // 24 + 1)

    _log(f"Building GLOBAL trending feed for date={target_date}")

    # ------------------------------------------------------------------
    # PHASE 2a: Load and rank all candidates
    # ------------------------------------------------------------------
    _log("-" * 40)
    _log("PHASE 2a: Load and rank candidates")
    _log("-" * 40)

    all_candidates = store.load_pool(TRENDING_POOL, max_age_days=max_age_days)
    _log(f"Loaded {len(all_candidates)} trending pool candidates")

    source_weights = {
        str(src.get("name", "")): float(src.get("source_weight", 1.0))
        for src in config.get("sources", [])
    }

    # Filter low-quality/promos and sort by recency (latest first)
    ranked = _rank_candidates(all_candidates, source_weights)
    # Story-level dedupe (latest wins) + per-source cap.
    ranked, dedupe_stats = dedupe_trending_latest_story(
        ranked,
        max_per_source=4,
    )
    _log(
        "After filtering and story-dedup: "
        f"{len(ranked)} articles "
        f"(merged={dedupe_stats.get('dropped_similar_story', 0)} "
        f"source_cap={dedupe_stats.get('dropped_source_cap', 0)})"
    )

    if not ranked:
        _log("No articles to process")
        store.write_global_feed_section(target_date, "trending", [])
        return {"items": 0, "summaries_generated": 0, "summaries_cached": 0, "rejected": 0}

    # ------------------------------------------------------------------
    # PHASE 2b: Batch summarize all articles (parallel)
    # ------------------------------------------------------------------
    _log("-" * 40)
    _log("PHASE 2b: Summarize articles (parallel)")
    _log("-" * 40)

    presummary = batch_presummarize(
        store, ranked,
        feed_type="trending", max_workers=8,
    )
    summary_map = presummary.get("summary_map", {}) or {}

    # ------------------------------------------------------------------
    # PHASE 2c: Build feed items
    # ------------------------------------------------------------------
    _log("-" * 40)
    _log("PHASE 2c: Build global feed")
    _log("-" * 40)

    stats = {
        "items": 0,
        "summaries_generated": presummary.get("generated", 0),
        "summaries_cached": presummary.get("already_cached", 0),
        "rejected": presummary.get("rejected", 0) + presummary.get("failed", 0),
    }

    feed_items: list[dict[str, Any]] = []
    for item in ranked:
        url = item.get("url", "")
        summary = summary_map.get(url)
        if not summary:
            continue
        feed_items.append(_build_feed_item(item, summary))

    _log(f"Built {len(feed_items)} feed items")

    # Write to global feed location
    store.write_global_feed_section(target_date, "trending", feed_items)
    stats["items"] = len(feed_items)

    store.record_run("trending", {"date": target_date, "global": True, **stats})
    _log(f"Global trending feed done: {stats}")
    return stats


# -----------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------

def main() -> None:
    args = _parse_args()
    _log("=" * 50)
    _log("TRENDING — Starting (GLOBAL mode)")
    _log(f"  skip-pool={args.skip_pool} pool-only={args.pool_only}")
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
    _log("PHASE 2: Global feed generation")
    _log("-" * 40)
    feed_stats = build_global_feed(store, config, args)
    _log("=" * 50)
    _log(f"TRENDING — Complete: {feed_stats}")
    _log("=" * 50)
    print(json.dumps(feed_stats, indent=2))


if __name__ == "__main__":
    main()
