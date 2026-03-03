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
import os
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlencode
from urllib.parse import urlparse
from urllib.request import Request, urlopen

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
DEFAULT_MAX_FEED_ITEMS = 24
DEFAULT_DISCOVERY_TOPICS = [
    "openai",
    "google ai",
    "nvidia",
    "startup funding",
    "cybersecurity",
]
DEFAULT_HN_LIMIT_PER_TOPIC = 4
DEFAULT_YT_LIMIT_PER_TOPIC = 3
HN_SEARCH_URL = "https://hn.algolia.com/api/v1/search_by_date"
HN_TIMEOUT = 20
YT_TIMEOUT = 120
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
    "cheapest",
    "stacks up",
    "vs ",
    "comparison",
    "app cleaner",
    "uninstaller",
)
PROMO_CONTENT_KEYWORDS = (
    "affiliate",
    "sponsored",
    "we may earn a commission",
    "buy now",
)
TECH_SIGNAL_KEYWORDS = (
    "ai",
    "openai",
    "anthropic",
    "claude",
    "chatgpt",
    "gemini",
    "google",
    "apple",
    "microsoft",
    "meta",
    "amazon",
    "nvidia",
    "chip",
    "model",
    "startup",
    "software",
    "security",
    "cyber",
    "developer",
    "cloud",
    "data center",
    "robot",
)
OFF_TOPIC_NEWS_KEYWORDS = (
    "war",
    "ceasefire",
    "drone strike",
    "strait of hormuz",
    "iran",
    "gaza",
    "ukraine",
    "oil prices",
    "congressional map",
)
STRONG_TECH_TERMS = (
    "ai",
    "model",
    "chip",
    "software",
    "app",
    "cloud",
    "startup",
    "security",
    "cyber",
    "openai",
    "anthropic",
    "chatgpt",
    "gemini",
    "claude",
    "developer",
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


def _is_off_topic_for_trending(title: str, content: str = "") -> bool:
    """Filter macro/world headlines unless they also have clear tech signal."""
    text = f"{title or ''} {content or ''}".lower()
    has_tech = any(k in text for k in TECH_SIGNAL_KEYWORDS)
    has_off_topic = any(k in text for k in OFF_TOPIC_NEWS_KEYWORDS)
    if not has_off_topic:
        return False

    # If geopolitical markers exist, require stronger tech terms to keep item.
    strong = any(k in text for k in STRONG_TECH_TERMS)
    if strong:
        return False

    return True


def _candidate_score(
    item: dict[str, Any],
    source_weights: dict[str, float],
    story_counts: dict[str, int],
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

    story_key = _story_key(title)
    if story_key:
        score += min(1.5, 0.25 * max(0, story_counts.get(story_key, 1) - 1))

    return score


def _rank_candidates(
    items: list[dict[str, Any]],
    source_weights: dict[str, float],
) -> list[dict[str, Any]]:
    """
    Filter low-quality/promotional content, then sort by signal score.

    Signal score combines source quality, recency, topical hints, and
    cross-source story convergence.
    """
    story_counts: dict[str, int] = {}
    for item in items:
        key = _story_key(item.get("title", "") or "")
        if key:
            story_counts[key] = story_counts.get(key, 0) + 1

    filtered = []
    for item in items:
        title = item.get("title", "") or ""
        content = item.get("content", "") or ""
        source_name = item.get("source_name", "") or ""

        # Skip promotional content
        if _looks_promotional(title, content[:600]):
            continue

        # Keep trending focused on tech/AI/startup signal.
        if _is_off_topic_for_trending(title, content[:800]):
            continue

        # Skip very short content (likely not real articles)
        min_len = 220 if source_name == "YouTube" else 500
        if len(content) < min_len:
            continue

        # Compute quality score - skip low quality items
        score = _candidate_score(item, source_weights, story_counts)
        if score < 1.5:  # Minimum quality threshold
            continue

        item["_trend_score"] = round(score, 3)
        item["_story_key"] = _story_key(title)
        filtered.append(item)

    # Sort by score first, recency second.
    filtered.sort(
        key=lambda x: (
            float(x.get("_trend_score", 0.0)),
            x.get("published_date", "") or x.get("fetched_at", ""),
        ),
        reverse=True,
    )
    return filtered


def _apply_source_limits(
    items: list[dict[str, Any]],
    default_limit: int = 3,
    source_overrides: dict[str, int] | None = None,
) -> list[dict[str, Any]]:
    """Apply post-rank source caps to avoid one-source domination."""
    source_overrides = source_overrides or {}
    out: list[dict[str, Any]] = []
    counts: dict[str, int] = {}
    for item in items:
        src = str(item.get("source_name", "")).strip()
        lim = int(source_overrides.get(src, default_limit))
        if counts.get(src, 0) >= lim:
            continue
        out.append(item)
        counts[src] = counts.get(src, 0) + 1
    return out


def _story_key(title: str) -> str:
    """Create a coarse story key from title tokens for convergence boosts."""
    lower = (title or "").lower()
    for ch in ",.:;!?()[]{}|/\\'\"":
        lower = lower.replace(ch, " ")
    stop = {
        "the", "a", "an", "and", "or", "for", "with", "from", "into", "about",
        "this", "that", "these", "those", "new", "latest", "today", "update",
        "after", "over", "under", "what", "why", "how", "will",
    }
    tokens = [t for t in lower.split() if len(t) >= 4 and t not in stop]
    if not tokens:
        return ""
    return " ".join(sorted(set(tokens[:8]))[:4])


def _iso_from_hn_date(value: str) -> str:
    if not value:
        return ""
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return dt.isoformat()
    except (ValueError, TypeError):
        return ""


def _safe_json_get(url: str, timeout: int = 20) -> dict[str, Any]:
    req = Request(
        url,
        headers={
            "User-Agent": "TraceTrendingFetcher/1.0",
            "Accept": "application/json",
        },
    )
    with urlopen(req, timeout=timeout) as resp:
        body = resp.read().decode("utf-8")
        return json.loads(body) if body else {}


def _ingest_hn_discovery(
    store: V3Store,
    topics: list[str],
    limit_per_topic: int,
    stats: dict[str, int],
) -> None:
    _log(f"HN discovery: topics={topics}, limit/topic={limit_per_topic}")
    total_ingested = 0
    for topic in topics:
        params = urlencode(
            {
                "query": topic,
                "tags": "story",
                "hitsPerPage": str(limit_per_topic),
            }
        )
        url = f"{HN_SEARCH_URL}?{params}"
        try:
            payload = _safe_json_get(url, timeout=HN_TIMEOUT)
        except Exception as exc:
            _log(f"  HN topic '{topic}' failed: {exc}")
            stats["errors"] += 1
            continue

        hits = payload.get("hits", []) or []
        urls = [str(h.get("url", "")).strip() for h in hits if h.get("url")]
        existing_urls = store.pool_items_exist(TRENDING_POOL, urls)
        for hit in hits:
            article_url = str(hit.get("url", "")).strip()
            if not article_url:
                continue
            if article_url in existing_urls:
                continue

            title = str(hit.get("title", "")).strip()
            if not title:
                continue

            published = _iso_from_hn_date(str(hit.get("created_at", "")))
            result_content = fetch_content(article_url)
            content = result_content.get("content", "")
            if not content:
                continue

            og_image = result_content.get("image", "") or fetch_og_image(article_url)
            store.upsert_pool_item(
                TRENDING_POOL,
                article_url,
                {
                    "title": title,
                    "published_date": published,
                    "og_image": og_image,
                    "content": content[:10000],
                    "content_length": len(content),
                    "interest_id": "technology",
                    "source_name": "Hacker News",
                    "source_url": "https://news.ycombinator.com/",
                    "content_source": result_content.get("source", "http"),
                    "fetched_at": datetime.now(timezone.utc).isoformat(),
                    "is_active": True,
                    "metadata": {
                        "discovery_topic": topic,
                        "hn_points": hit.get("points") or 0,
                        "hn_comments": hit.get("num_comments") or 0,
                    },
                },
            )
            total_ingested += 1
            stats["new_items"] += 1
            existing_urls.add(article_url)

    stats["hn_items"] = total_ingested
    _log(f"HN discovery ingested {total_ingested} items")


def _iso_from_upload_date(value: str) -> str:
    if not value or len(value) != 8:
        return ""
    return f"{value[:4]}-{value[4:6]}-{value[6:8]}T00:00:00+00:00"


def _search_youtube(topic: str, limit: int) -> list[dict[str, Any]]:
    if not shutil.which("yt-dlp"):
        return []
    cmd = [
        "yt-dlp",
        f"ytsearch{limit}:{topic}",
        "--dump-json",
        "--no-warnings",
        "--no-download",
    ]
    proc = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=YT_TIMEOUT,
    )
    if proc.returncode != 0 or not (proc.stdout or "").strip():
        return []

    rows: list[dict[str, Any]] = []
    for line in proc.stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return rows


def _ingest_youtube_discovery(
    store: V3Store,
    topics: list[str],
    limit_per_topic: int,
    stats: dict[str, int],
) -> None:
    if not shutil.which("yt-dlp"):
        _log("YouTube discovery skipped (yt-dlp not installed)")
        stats["youtube_items"] = 0
        return

    _log(f"YouTube discovery: topics={topics}, limit/topic={limit_per_topic}")
    total_ingested = 0
    for topic in topics:
        try:
            videos = _search_youtube(topic, limit_per_topic)
        except Exception as exc:
            _log(f"  YouTube topic '{topic}' failed: {exc}")
            stats["errors"] += 1
            continue

        urls = []
        for v in videos:
            vid = str(v.get("id", "")).strip()
            if vid:
                urls.append(f"https://www.youtube.com/watch?v={vid}")
        existing_urls = store.pool_items_exist(TRENDING_POOL, urls)

        for v in videos:
            vid = str(v.get("id", "")).strip()
            if not vid:
                continue
            article_url = f"https://www.youtube.com/watch?v={vid}"
            if article_url in existing_urls:
                continue

            title = str(v.get("title", "")).strip()
            if not title:
                continue

            published = _iso_from_upload_date(str(v.get("upload_date", "")))
            description = str(v.get("description", "")).strip()
            content = f"{title}\n\n{description}".strip()
            if len(content) < 220:
                # Keep only reasonably informative video entries.
                continue

            thumbnail = str(v.get("thumbnail", "")).strip()
            store.upsert_pool_item(
                TRENDING_POOL,
                article_url,
                {
                    "title": title,
                    "published_date": published,
                    "og_image": thumbnail,
                    "content": content[:5000],
                    "content_length": len(content),
                    "interest_id": "technology",
                    "source_name": "YouTube",
                    "source_url": "https://www.youtube.com/",
                    "content_source": "youtube_meta",
                    "fetched_at": datetime.now(timezone.utc).isoformat(),
                    "is_active": True,
                    "metadata": {
                        "discovery_topic": topic,
                        "channel": v.get("channel") or v.get("uploader") or "",
                        "view_count": v.get("view_count") or 0,
                        "video_id": vid,
                    },
                },
            )
            total_ingested += 1
            stats["new_items"] += 1
            existing_urls.add(article_url)

    stats["youtube_items"] = total_ingested
    _log(f"YouTube discovery ingested {total_ingested} items")


# -----------------------------------------------------------------------
# Phase 1: Pool refresh
# -----------------------------------------------------------------------

def refresh_pool(store: V3Store, config: dict[str, Any], limit_per_source: int) -> dict[str, int]:
    from concurrent.futures import ThreadPoolExecutor, as_completed
    import threading

    sources = config.get("sources", [])
    max_age_hours = config.get("max_age_hours", DEFAULT_MAX_AGE_HOURS)
    stats = {
        "sources": len(sources),
        "links_found": 0,
        "new_items": 0,
        "skipped": 0,
        "filtered": 0,
        "errors": 0,
        "hn_items": 0,
        "youtube_items": 0,
    }
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

    discovery_cfg = config.get("discovery", {}) if isinstance(config, dict) else {}
    if bool(discovery_cfg.get("enabled", True)):
        topics = discovery_cfg.get("topics", DEFAULT_DISCOVERY_TOPICS)
        topics = [str(t).strip() for t in topics if str(t).strip()]
        if topics:
            hn_limit = int(discovery_cfg.get("hn_limit_per_topic", DEFAULT_HN_LIMIT_PER_TOPIC))
            yt_limit = int(discovery_cfg.get("youtube_limit_per_topic", DEFAULT_YT_LIMIT_PER_TOPIC))
            if bool(discovery_cfg.get("include_hn", False)):
                _ingest_hn_discovery(store, topics, hn_limit, stats)
            else:
                stats["hn_items"] = 0
                _log("HN discovery disabled for trending")

            if bool(discovery_cfg.get("include_youtube", True)):
                _ingest_youtube_discovery(store, topics, yt_limit, stats)
            else:
                stats["youtube_items"] = 0
                _log("YouTube discovery disabled for trending")

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
            "trend_score": pool_item.get("_trend_score", 0.0),
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
    # Product decision: keep HN for learning feeds, not trending news.
    all_candidates = [
        item for item in all_candidates
        if str(item.get("source_name", "")).strip().lower() not in {"hacker news", "hacker news best"}
    ]
    _log(f"Loaded {len(all_candidates)} trending pool candidates")

    source_weights = {
        str(src.get("name", "")): float(src.get("source_weight", 1.0))
        for src in config.get("sources", [])
    }
    source_weights.setdefault("Hacker News", 1.25)
    source_weights.setdefault("YouTube", 1.1)

    # Filter low-quality/promos and sort by recency (latest first)
    ranked = _rank_candidates(all_candidates, source_weights)
    # Story-level dedupe (latest wins) + per-source cap.
    ranked, dedupe_stats = dedupe_trending_latest_story(
        ranked,
        max_per_source=4,
    )
    ranked = _apply_source_limits(
        ranked,
        default_limit=3,
        source_overrides={
            "Hacker News": 2,
            "CNBC Top News": 2,
        },
    )
    ranked = ranked[:DEFAULT_MAX_FEED_ITEMS]
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
