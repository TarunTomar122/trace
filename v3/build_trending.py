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
from collections import Counter, defaultdict
import hashlib
import json
import os
import re
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
from v3.lib.summarizer import batch_presummarize, generate_summary  # noqa: E402
from v3.lib.interest_notifications import send_interest_notifications  # noqa: E402
from v3.lib.diversity import (  # noqa: E402
    STOPWORDS as DIVERSITY_STOPWORDS,
    dedupe_trending_latest_story,
)

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
YT_TIMEOUT = 15
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
    "oscar",
    "oscars",
    "grammy",
    "grammys",
    "emmy",
    "emmys",
    "award show",
    "awards season",
    "red carpet",
    "box office",
    "kpop",
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

# Entity tokens used only for topic diversity/capping.
# This prevents one company (e.g., Apple) from taking too many topic slots.
ENTITY_TOPIC_TOKENS = {
    "apple",
    "openai",
    "google",
    "meta",
    "microsoft",
    "amazon",
    "nvidia",
    "tesla",
    "xai",
    "anthropic",
    "alibaba",
    "bytedance",
    "tiktok",
    "uber",
    "netflix",
    "spacex",
    "samsung",
}

TOPIC_STOPWORDS = set(DIVERSITY_STOPWORDS) | {
    # Generic news language
    "news", "update", "updates", "latest", "today", "report", "reports",
    "says", "say", "said", "amid", "after", "before", "over", "under",
    "from", "about", "through", "here", "set", "hit", "top", "big",
    "first", "new", "one", "two", "three", "four", "five", "six",
    "could", "would", "will", "can", "may", "has", "have", "had",
    "year", "month", "week", "day", "quarter",
    # Generic domain words that appear in almost every article
    "technology", "tech", "business", "company", "companies", "firm",
    "market", "markets", "stock", "stocks", "share", "shares", "price",
    "prices", "growth", "revenue", "earnings", "profit", "loss", "deal",
    "app", "platform", "product", "products", "service", "services",
    "data", "tool", "tools", "feature", "features", "system", "systems",
    "global", "world", "industry", "sector", "billion", "million",
    "startup", "startups", "venture", "fund", "funding", "investor",
    "launch", "launches", "launched", "release", "released", "announce",
    "announced", "announcement", "unveil", "unveiled", "introduces",
    "introduced", "plan", "plans", "according", "percent",
    # Broad event / logistics / politics words that create false topic merges
    "travel", "traveler", "travelers", "airport", "airports", "flight",
    "flights", "airline", "airlines", "route", "routes", "shipping",
    "delays", "delay", "shortage", "shortages", "staff", "workers",
    "strike", "strikes", "war", "talks", "tariffs", "trade", "prices",
    "policy", "policies", "official", "officials", "government",
    "governments", "minister", "ministers",
}

# Only canonicalize TRUE synonyms — keep brand names specific so they cluster tightly
TOPIC_TOKEN_CANONICAL = {
    "ceasefire": "war",
    "warfare": "war",
    "gpt4": "openai",
    "gpt3": "openai",
    "chatgpt": "openai",
}

# Narrow inflection normalization for event tokens that should cluster together.
# Keep this intentionally small to avoid broad, sloppy stemming.
TOPIC_EVENT_TOKEN_CANONICAL = {
    "leaks": "leak",
    "leaked": "leak",
    "leaking": "leak",
    "codes": "code",
    "coded": "code",
    "coding": "code",
    "clones": "clone",
    "cloned": "clone",
    "cloning": "clone",
    "unveils": "unveil",
    "unveiled": "unveil",
    "unveiling": "unveil",
}

TOKEN_DISPLAY = {
    "ai": "AI",
    "us": "US",
    "uk": "UK",
    "eu": "EU",
    "china": "China",
    "war": "War",
}

CANONICAL_TRENDING_INTEREST_MAP = {
    "technology": "tech",
    "business-market": "markets",
    "business": "markets",
    # legacy → new
    "product-design": "ux-design",
    "experience": "ux-design",
    "design": "ux-design",
    "marketing": "startups",
    "fintech": "markets",
    "web3": "markets",
    "leadership": "markets",
    "productivity": "tech",
    "health": "the-world",
    "climate": "the-world",
}


def _normalize_trending_interest_id(raw: str) -> str:
    value = str(raw or "").strip().lower()
    if not value:
        return ""
    return CANONICAL_TRENDING_INTEREST_MAP.get(value, value)


def _log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] [v3-trending] {msg}")


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Build Trending feed (global)")
    p.add_argument("--skip-pool", action="store_true", help="Skip pool refresh, use cached articles")
    p.add_argument("--pool-only", action="store_true", help="Only refresh pool, don't build feed")
    p.add_argument("--skip-notifications", action="store_true", help="Skip interest-matched push notifications")
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


def _topic_tokens(text: str) -> set[str]:
    cleaned = re.sub(r"[^a-z0-9\s]", " ", (text or "").lower())
    out: set[str] = set()
    for raw in cleaned.split():
        tok = raw.strip()
        if len(tok) < 3:
            continue
        if tok in TOPIC_STOPWORDS:
            continue
        if tok.isdigit():
            continue
        tok = TOPIC_TOKEN_CANONICAL.get(tok, tok)
        tok = TOPIC_EVENT_TOKEN_CANONICAL.get(tok, tok)
        out.add(tok)
    return out


def _topic_tokens_for_item(item: dict[str, Any]) -> set[str]:
    # Only use the title — NOT interest_id (which is "technology"/"business" for
    # nearly every article and causes everything to cluster together).
    # discovery_topic is kept only if it's specific (not a generic domain word).
    md = item.get("metadata", {}) or {}
    title_tokens = _topic_tokens(str(item.get("title", "") or ""))
    disc = str(md.get("discovery_topic", "") or "").strip().lower()
    if disc and disc not in TOPIC_STOPWORDS and len(disc) >= 4:
        title_tokens.add(TOPIC_EVENT_TOKEN_CANONICAL.get(TOPIC_TOKEN_CANONICAL.get(disc, disc), disc))
    return title_tokens


def _cluster_topic_candidates(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Cluster ranked candidates into tighter topics via token overlap.

    Key design decisions:
    - Only match on tokens the CURRENT article and cluster actually share
      (don't blindly add all new tokens to cluster — prevents snowballing).
    - Require overlap >= 2 tokens AND those tokens must be meaningful
      (not just high-frequency generic words).
    - Each item's tokens are tracked separately so consensus can be
      recalculated rather than just accumulating.
    """
    # Words that are too common across articles to be useful cluster signals
    # even after the main TOPIC_STOPWORDS pass (shorter words, common verbs, etc.)
    SOFT_STOP = {
        "using", "used", "make", "made", "made", "take", "taken", "comes",
        "coming", "going", "gets", "get", "got", "back", "just", "more",
        "less", "like", "also", "even", "still", "already", "now", "soon",
        "next", "last", "both", "each", "into", "with", "that", "this",
        "they", "their", "there", "been", "being", "work", "works", "call",
        "called", "called", "show", "shows", "showing", "become", "becomes",
    }

    clusters: list[dict[str, Any]] = []

    for item in items:
        tokens = _topic_tokens_for_item(item)
        if not tokens:
            continue

        best_idx = -1
        best_score = 0.0

        for idx, cluster in enumerate(clusters):
            # Score against the consensus tokens (tokens seen in 2+ items)
            consensus: set[str] = cluster.get("consensus_tokens", set())
            if not consensus:
                # Fall back to all tokens for single-item clusters
                consensus = cluster.get("tokens", set())

            shared = tokens & consensus - SOFT_STOP
            if len(shared) < 1:
                continue

            # Brand / entity overlap is the strongest signal that two titles are
            # about the same story. Without it, require a much tighter token match
            # so broad themes like travel, markets, or policy do not snowball.
            entity_overlap = shared & ENTITY_TOPIC_TOKENS

            # Require at least 2 overlapping specific tokens.
            specific_shared = {t for t in shared if len(t) >= 4}
            if len(specific_shared) < 2 and len(shared) < 2:
                continue

            # If there is no named entity/brand overlap, force a tighter match.
            # This keeps unrelated "airport delays", "trade policy", etc. from
            # ending up in one topic just because they share generic nouns.
            if not entity_overlap and len(specific_shared) < 3:
                continue

            score = float(len(shared)) + len(shared) / max(1, len(tokens | consensus))
            if score > best_score:
                best_score = score
                best_idx = idx

        if best_idx < 0:
            clusters.append({
                "items": [item],
                "tokens": set(tokens),
                "token_counts": Counter(tokens),
                "consensus_tokens": set(),
            })
            continue

        cluster = clusters[best_idx]
        cluster["items"].append(item)
        cluster["tokens"].update(tokens)
        # Track per-token frequency and update consensus (tokens in >= 2 items)
        tc: Counter = cluster["token_counts"]
        for t in tokens:
            tc[t] = tc.get(t, 0) + 1
        cluster["consensus_tokens"] = {t for t, cnt in tc.items() if cnt >= 2}

    return clusters


def _cluster_popularity_score(cluster: dict[str, Any]) -> float:
    """Score a topic cluster. Source diversity is the strongest signal —
    a story covered by 4 different outlets is more important than
    6 articles from the same source."""
    items: list[dict[str, Any]] = cluster.get("items", []) or []
    if not items:
        return 0.0
    article_count = len(items)
    source_count = len(
        {
            str(i.get("source_name", "")).strip()
            for i in items
            if str(i.get("source_name", "")).strip()
        }
    )
    avg_signal = sum(float(i.get("_trend_score", 0.0)) for i in items) / max(1, article_count)
    latest_dt = None
    for i in items:
        dt = _parse_dt(str(i.get("published_date", "") or i.get("fetched_at", "")))
        if dt and (latest_dt is None or dt > latest_dt):
            latest_dt = dt
    recency = 0.0
    if latest_dt:
        age_hours = max(0.0, (datetime.now(timezone.utc) - latest_dt).total_seconds() / 3600)
        recency = max(0.0, (24.0 - age_hours) / 24.0) * 2.0
    # Source diversity is king — a story from 4 outlets beats 6 articles from 1
    return round(source_count * 3.5 + article_count * 0.8 + avg_signal * 0.4 + recency, 3)


def _pretty_topic_token(token: str) -> str:
    return TOKEN_DISPLAY.get(token, token.capitalize())


def _topic_title(cluster: dict[str, Any]) -> str:
    """Generate a specific topic title using consensus tokens.

    Prefers tokens seen in multiple articles (consensus). Longer/more specific
    tokens are ranked higher to avoid generic titles like 'Technology and Business'.
    """
    # Use the pre-computed consensus tokens (in >=2 articles) if available,
    # otherwise fall back to counting from scratch.
    consensus: set[str] = cluster.get("consensus_tokens", set())
    if consensus:
        token_counts: Counter[str] = Counter()
        for item in cluster.get("items", []) or []:
            for tok in _topic_tokens_for_item(item):
                if tok in consensus:
                    token_counts[tok] += 1
        # Prefer longer tokens (more specific) — break ties by frequency
        top = sorted(token_counts.keys(), key=lambda t: (token_counts[t], len(t)), reverse=True)
    else:
        token_counts = Counter()
        for item in cluster.get("items", []) or []:
            token_counts.update(_topic_tokens_for_item(item))
        top = [tok for tok, cnt in token_counts.most_common(6) if cnt >= 2]

    if len(top) >= 2:
        return f"{_pretty_topic_token(top[0])} and {_pretty_topic_token(top[1])}"
    if len(top) == 1:
        return f"{_pretty_topic_token(top[0])} updates"

    # Fall back to the top article's title
    items: list[dict[str, Any]] = cluster.get("items", []) or []
    if not items:
        return "Trending now"
    top_item = sorted(
        items,
        key=lambda x: float(x.get("_trend_score", 0.0)),
        reverse=True,
    )[0]
    return str(top_item.get("title", "Trending now"))[:80]


def _event_summary_for_item(
    item: dict[str, Any],
    summary_map: dict[str, dict[str, Any] | None],
) -> str:
    url = str(item.get("url", "")).strip()
    summary = summary_map.get(url) if url else None
    if isinstance(summary, dict):
        short = summary.get("short_article", {}) or {}
        subtitle = str(short.get("subtitle", "")).strip()
        if subtitle:
            return subtitle
        slides = short.get("slides")
        if isinstance(slides, list) and slides:
            first = str(slides[0]).strip()
            return re.sub(r"^\s*Slide\s*\d+\s*:\s*", "", first, flags=re.IGNORECASE).strip()
        body = str(short.get("body", "")).strip()
        if body:
            para = body.split("\n\n", 1)[0].strip()
            if para:
                return para[:260]
    content = str(item.get("content", "")).strip()
    if content:
        return re.sub(r"\s+", " ", content)[:260]
    return str(item.get("title", "")).strip()


def _build_topic_timeline(
    topic_id: str,
    items: list[dict[str, Any]],
    summary_map: dict[str, dict[str, Any] | None],
    max_events: int = 14,
) -> list[dict[str, Any]]:
    def _sort_key(it: dict[str, Any]) -> datetime:
        dt = _parse_dt(str(it.get("published_date", "") or it.get("fetched_at", "")))
        if dt:
            return dt
        return datetime.fromtimestamp(0, tz=timezone.utc)

    ordered = sorted(items, key=_sort_key)[:max_events]
    events: list[dict[str, Any]] = []
    for idx, item in enumerate(ordered):
        ts = str(item.get("published_date", "") or item.get("fetched_at", "")).strip()
        if not ts:
            ts = datetime.now(timezone.utc).isoformat()
        article_url = str(item.get("url", "")).strip()
        event_id = hashlib.sha256(f"{topic_id}:{article_url}:{idx}".encode("utf-8")).hexdigest()[:16]
        events.append(
            {
                "id": event_id,
                "timestamp": ts,
                "title": str(item.get("title", "")).strip()[:180],
                "summary": _event_summary_for_item(item, summary_map),
                "source_name": str(item.get("source_name", "")).strip(),
                "source_url": str(item.get("source_url", "")).strip(),
                "article_url": article_url,
            }
        )
    return events


def _deterministic_topic_overview(topic_title: str, timeline: list[dict[str, Any]]) -> tuple[str, list[str]]:
    if not timeline:
        return (
            f"{topic_title} is active in the last 24 hours with fresh reporting across sources.",
            [],
        )
    first = timeline[0]
    last = timeline[-1]
    source_count = len(
        {
            str(e.get("source_name", "")).strip()
            for e in timeline
            if str(e.get("source_name", "")).strip()
        }
    )
    overview = (
        f"{topic_title} saw {len(timeline)} notable updates in the last 24 hours "
        f"across {source_count} sources. The story moved from "
        f"{first.get('title', 'an initial report')} to "
        f"{last.get('title', 'the latest development')}."
    )
    points = [str(e.get("title", "")).strip() for e in timeline[:3] if str(e.get("title", "")).strip()]
    return overview, points


def _topic_cache_key(items: list[dict[str, Any]]) -> str:
    signature = "|".join(
        sorted(
            f"{str(i.get('url', '')).strip()}#{str(i.get('published_date', '')).strip()}"
            for i in items
            if str(i.get("url", "")).strip()
        )
    )
    digest = hashlib.sha256(signature.encode("utf-8")).hexdigest()[:40] if signature else "empty"
    return f"trending_topic_v3:{digest}"


TOPIC_OVERVIEW_PROMPT = """You are a news editor writing a concise brief for a trending topic.

The reader wants two layers:
1. A short overview paragraph that reads naturally and tells the story clearly.
2. A few skim bullets for readers who want only the most important extra details.

The overview and the bullets must do different jobs. Do not make the bullets restate the overview.

Given these timeline events, produce:
1. A short natural headline
2. A 2-3 sentence overview paragraph — enough detail that the reader understands the story without opening an article
3. 1-4 bullet points covering only the strongest additional concrete details from the source material

TIMELINE:
{timeline}

Return JSON:
{{
  "title": "Short natural headline (e.g. 'US-Iran Strikes Escalate', 'Apple Launches M5 Lineup')",
  "overview": "2-3 sentences. What happened, who was involved, and the most important concrete detail.",
  "key_points": ["Specific fact with number or name", "Another concrete detail", "..."]
}}

RULES:
- Title reads like a real news headline — NOT "X and Y" style
- Overview is 2-3 sentences, should read like a natural paragraph, and should carry the core substance of the story
- Overview must name the main entities involved when they are present in the timeline: companies, products, people, countries, places, agencies, or other specific nouns central to the story
- Every sentence in the overview must add new information. Do not write a generic opener plus filler.
- Use **bold** for key names, numbers, and prices in bullet points
- Bullet points should be specific and scannable — include the actual names, products, places, dates, prices, counts, or other concrete facts when they appear in the timeline
- When choosing bullets, prefer exact numbers, named entities, deal terms, rollout details, operational effects, or direct consequences from the timeline before any broader framing
- Do not collapse concrete details into vague labels like "key assets", "major companies", "analysts", "markets", or "officials" if the timeline names the exact thing
- Each bullet must add NEW information beyond the overview. Do not restate the overview in different words.
- Do not include filler bullets such as announcement dates, publication dates, or generic statements like "the update is part of ongoing improvements" unless that is itself the story.
- Avoid "broader trend" bullets unless the timeline itself provides a concrete comparison or statistic that makes that trend the story.
- Prefer fewer bullets over weak bullets. If there is only one or two genuinely useful details, return one or two bullets.
- Write each bullet as one complete sentence with real information, not fragments and not mini-paragraphs.
- If there are no good additive bullets, return an empty list instead of repeating the overview.
- No commentary, predictions, or "what this means for the industry" fluff
"""


GENERIC_TOPIC_PHRASES = {
    "key stocks",
    "major companies",
    "leading companies",
    "major stocks",
    "market volatility",
    "latest developments",
    "recent developments",
    "notable updates",
    "key updates",
    "industry players",
    "ongoing improvements",
    "was announced on",
    "reported on",
    "published on",
    "sale date is",
    "part of ongoing improvements",
    "this update is part of",
    "this move follows",
    "shared during",
    "shared in an interview",
    "during a bloomberg interview",
    "as the situation evolves",
    "expect potential",
    "potential partnerships",
    "maintaining competitive pricing",
    "the bigger shift",
    "this highlights a growing trend",
    "signals that",
}


def _extract_capitalized_mentions(text: str) -> list[str]:
    if not text:
        return []
    pattern = re.compile(r"\b(?:[A-Z][A-Za-z0-9&.'-]+(?:\s+[A-Z][A-Za-z0-9&.'-]+){0,3}|[A-Z]{2,6})\b")
    raw = [m.group(0).strip(" .,:;") for m in pattern.finditer(text)]
    out: list[str] = []
    seen: set[str] = set()
    skip = {
        "The", "A", "An", "And", "But", "For", "With", "From", "After", "Before",
        "Latest", "Major", "Market", "Markets", "Stocks", "Stock", "Analysts",
        "Wall Street", "Reuters", "Bloomberg", "Financial Times", "TechCrunch",
        "The Verge", "CNBC", "Yahoo Finance",
    }
    for value in raw:
        if value in skip:
            continue
        if len(value) <= 2 and not value.isupper():
            continue
        key = value.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(value)
    return out


def _timeline_salient_mentions(timeline: list[dict[str, Any]], limit: int = 8) -> list[str]:
    counts: Counter[str] = Counter()
    for event in timeline[:8]:
        for field in ("title", "summary"):
            text = str(event.get(field, "")).strip()
            for mention in _extract_capitalized_mentions(text):
                counts[mention] += 1
    ordered = sorted(counts.keys(), key=lambda m: (counts[m], len(m)), reverse=True)
    return ordered[:limit]


def _line_has_concrete_detail(text: str, salient_mentions: list[str]) -> bool:
    value = str(text or "").strip()
    if not value:
        return False
    lower = value.lower()
    if any(phrase in lower for phrase in GENERIC_TOPIC_PHRASES):
        return False
    if re.search(r"\*\*.+?\*\*", value):
        return True
    if re.search(r"\b\d[\d,.%:$-]*\b", value):
        return True
    return any(mention.lower() in lower for mention in salient_mentions)


def _normalize_text_for_overlap(value: str) -> set[str]:
    words = re.findall(r"[a-z0-9]+", str(value or "").lower())
    stop = {
        "the", "a", "an", "and", "or", "for", "with", "from", "into", "that",
        "this", "these", "those", "after", "before", "amid", "over", "under",
        "into", "its", "their", "they", "has", "have", "had", "was", "were",
        "are", "is", "be", "been", "being", "new", "more", "most", "part",
        "update", "updates", "story", "reported", "announced", "published",
    }
    return {w for w in words if len(w) >= 4 and w not in stop}


def _split_sentences(text: str) -> list[str]:
    value = str(text or "").strip()
    if not value:
        return []
    parts = re.split(r"(?<=[.!?])\s+", value)
    out: list[str] = []
    for part in parts:
        cleaned = part.strip()
        if not cleaned:
            continue
        if cleaned[-1] not in ".!?":
            cleaned += "."
        out.append(cleaned)
    return out


def _is_date_only_or_filler_point(text: str, salient_mentions: list[str]) -> bool:
    value = str(text or "").strip()
    if not value:
        return True
    lower = value.lower()
    if any(phrase in lower for phrase in GENERIC_TOPIC_PHRASES):
        return True

    has_date = bool(re.search(r"\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}\b", lower))
    has_numeric_date = bool(re.search(r"\b\d{4}\b", lower))
    mentions = [m for m in salient_mentions if m.lower() in lower]
    content_words = _normalize_text_for_overlap(value)

    if ("announced on" in lower or "reported on" in lower or "published on" in lower or "date is" in lower) and (has_date or has_numeric_date):
        if len(content_words) <= 6 or len(mentions) <= 1:
            return True

    if len(content_words) < 4 and not mentions:
        return True

    return False


def _is_speculative_point(text: str) -> bool:
    lower = str(text or "").strip().lower()
    if not lower:
        return True
    speculative_patterns = (
        "could ",
        "may ",
        "might ",
        "would ",
        "likely ",
        "is set to",
        "expected to",
        "expect ",
        "potential ",
        "could lead to",
        "may lead to",
        "may need to",
        "could reshape",
        "the future of",
        "as the situation evolves",
    )
    return any(pattern in lower for pattern in speculative_patterns)


def _is_redundant_point(point: str, overview: str) -> bool:
    point_words = _normalize_text_for_overlap(point)
    overview_words = _normalize_text_for_overlap(overview)
    if not point_words:
        return True
    overlap = len(point_words & overview_words) / max(1, len(point_words))
    return overlap >= 0.72


def _compose_timeline_point(event: dict[str, Any]) -> str:
    title = str(event.get("title", "")).strip().rstrip(".")
    summary = str(event.get("summary", "")).strip().rstrip(".")
    if title and summary and _normalize_text_for_overlap(summary) - _normalize_text_for_overlap(title):
        return f"{title}. {summary}."
    if title:
        return f"{title}."
    return summary + ("." if summary and not summary.endswith(".") else "")


def _compose_overview_from_sentences(sentences: list[str], min_sentences: int = 2, max_sentences: int = 3) -> str:
    cleaned: list[str] = []
    seen: set[str] = set()
    for sentence in sentences:
        sig = " ".join(sorted(_normalize_text_for_overlap(sentence)))
        if sig and sig in seen:
            continue
        if sig:
            seen.add(sig)
        cleaned.append(sentence.strip())
        if len(cleaned) >= max_sentences:
            break
    if not cleaned:
        return ""
    if len(cleaned) < min_sentences:
        return " ".join(cleaned)
    return " ".join(cleaned[:max_sentences])


def _timeline_fallback_points(timeline: list[dict[str, Any]], limit: int = 4) -> list[str]:
    points: list[str] = []
    for event in timeline[:limit]:
        point = _compose_timeline_point(event).strip()
        if point:
            points.append(point)
    return points


def _normalize_topic_overview_output(
    overview: str,
    key_points: list[str],
    deterministic_overview: str,
    deterministic_points: list[str],
    timeline: list[dict[str, Any]],
) -> tuple[str, list[str]]:
    salient_mentions = _timeline_salient_mentions(timeline)
    normalized_overview = overview.strip()
    normalized_points = [str(point).strip() for point in key_points if str(point).strip()]

    if not _line_has_concrete_detail(normalized_overview, salient_mentions):
        normalized_overview = deterministic_overview

    concrete_points: list[str] = []
    seen_signatures: set[str] = set()
    for point in normalized_points:
        if not _line_has_concrete_detail(point, salient_mentions):
            continue
        if _is_date_only_or_filler_point(point, salient_mentions):
            continue
        if _is_speculative_point(point):
            continue
        if _is_redundant_point(point, normalized_overview):
            continue
        signature = " ".join(sorted(_normalize_text_for_overlap(point)))
        if signature and signature in seen_signatures:
            continue
        if signature:
            seen_signatures.add(signature)
        concrete_points.append(point.rstrip(".") + ".")

    if not concrete_points:
        fallback_points = [
            point for point in _timeline_fallback_points(timeline)
            if not _is_date_only_or_filler_point(point, salient_mentions)
            and not _is_speculative_point(point)
            and not _is_redundant_point(point, normalized_overview)
        ]
        normalized_points = fallback_points
    else:
        normalized_points = concrete_points

    return normalized_overview, normalized_points[:5]


def _build_singleton_topic_overview(
    item: dict[str, Any],
    fallback_title: str,
    summary_map: dict[str, dict[str, Any] | None],
) -> tuple[str, str, list[str], bool]:
    url = str(item.get("url", "")).strip()
    summary = summary_map.get(url) if url else None
    title = str(item.get("title", "")).strip() or fallback_title

    if not isinstance(summary, dict):
        overview, key_points = _deterministic_topic_overview(title, [])
        return title, overview, key_points, False

    short = summary.get("short_article", {}) or {}
    body = str(short.get("body", "")).strip()
    takeaways = short.get("key_takeaways") if isinstance(short.get("key_takeaways"), list) else []
    if body:
        key_points = [str(point).strip() for point in takeaways if str(point).strip()][:5]
        return title, body, key_points, True

    subtitle = str(short.get("subtitle", "")).strip()
    if subtitle:
        key_points = [str(point).strip() for point in takeaways if str(point).strip()][:5]
        return title, subtitle, key_points, True

    overview, key_points = _deterministic_topic_overview(title, [])
    return title, overview, key_points, False


def _build_topic_prompt_context(
    items: list[dict[str, Any]],
    timeline: list[dict[str, Any]],
    summary_map: dict[str, dict[str, Any] | None],
) -> str:
    timeline_by_url = {
        str(event.get("article_url", "")).strip(): event
        for event in timeline
        if str(event.get("article_url", "")).strip()
    }
    sections: list[str] = []

    for item in items[:12]:
        url = str(item.get("url", "")).strip()
        event = timeline_by_url.get(url)
        summary = summary_map.get(url) if url else None
        short = summary.get("short_article", {}) if isinstance(summary, dict) else {}

        parts = [
            f"timestamp: {event.get('timestamp', '') if event else item.get('published_date', '')}",
            f"source: {event.get('source_name', '') if event else item.get('source_name', 'Source')}",
            f"title: {item.get('title', '')}",
        ]

        subtitle = str(short.get("subtitle", "")).strip()
        if subtitle:
            parts.append(f"subtitle: {subtitle}")

        headline = str(short.get("headline", "")).strip()
        if headline:
            parts.append(f"headline: {headline}")

        takeaways = short.get("key_takeaways") if isinstance(short.get("key_takeaways"), list) else []
        if takeaways:
            parts.append(
                "key_takeaways: " + " || ".join(str(point).strip() for point in takeaways if str(point).strip())
            )

        slides = short.get("slides") if isinstance(short.get("slides"), list) else []
        if slides:
            cleaned_slides = [
                re.sub(r"^\s*Slide\s*\d+\s*:\s*", "", str(slide).strip(), flags=re.IGNORECASE).strip()
                for slide in slides
                if str(slide).strip()
            ]
            if cleaned_slides:
                parts.append("slides: " + " || ".join(cleaned_slides))

        event_summary = str(event.get("summary", "")).strip() if event else ""
        if event_summary:
            parts.append(f"timeline_summary: {event_summary}")

        sections.append("\n".join(parts))

    return "\n\n".join(sections)[:14000]


def _build_topic_overview(
    store: V3Store,
    topic_id: str,
    fallback_title: str,
    items: list[dict[str, Any]],
    timeline: list[dict[str, Any]],
    summary_map: dict[str, dict[str, Any] | None],
) -> tuple[str, str, list[str], bool]:
    """Generate topic overview via LLM. Returns (title, overview, key_points, from_cache)."""
    cache_key = _topic_cache_key(items)
    cached = store.get_cached_synthesis(cache_key)
    if isinstance(cached, dict):
        cached_overview = str(cached.get("overview", "")).strip()
        cached_title = str(cached.get("title", "")).strip()
        cached_points = cached.get("key_points")
        if cached_overview:
            return (
                cached_title or fallback_title,
                cached_overview,
                cached_points if isinstance(cached_points, list) else [],
                True,
            )

    deterministic_overview, deterministic_points = _deterministic_topic_overview(
        fallback_title, timeline
    )
    if not timeline:
        store.cache_synthesis(
            cache_key,
            {
                "topic_id": topic_id,
                "title": fallback_title,
                "overview": deterministic_overview,
                "key_points": deterministic_points,
                "article_count": len(items),
                "generated_at": datetime.now(timezone.utc).isoformat(),
            },
        )
        return fallback_title, deterministic_overview, deterministic_points, False

    timeline_text = _build_topic_prompt_context(items, timeline, summary_map)

    from openai import OpenAI as _OpenAI
    client = _OpenAI(api_key=os.getenv("OPENAI_API_KEY", "").strip())
    import time as _time

    title = fallback_title
    overview = deterministic_overview
    key_points = deterministic_points

    try:
        t0 = _time.time()
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Return valid JSON only."},
                {"role": "user", "content": TOPIC_OVERVIEW_PROMPT.format(timeline=timeline_text)},
            ],
            temperature=0.3,
            response_format={"type": "json_object"},
            timeout=45,
        )
        elapsed = _time.time() - t0
        tokens = getattr(resp.usage, "total_tokens", 0) if resp.usage else 0
        result = json.loads(resp.choices[0].message.content or "{}")
        print(f"      [topic-overview] {elapsed:.1f}s, {tokens} tokens — {result.get('title', '?')[:60]}")

        maybe_title = str(result.get("title", "")).strip()
        if maybe_title:
            title = maybe_title
        maybe_overview = str(result.get("overview", "")).strip()
        if maybe_overview:
            overview = maybe_overview
        maybe_points = result.get("key_points")
        if isinstance(maybe_points, list) and maybe_points:
            key_points = [str(p).strip() for p in maybe_points if str(p).strip()][:5]
    except Exception as exc:
        _log(f"  Topic overview LLM failed for {topic_id}: {exc}")

    overview, key_points = _normalize_topic_overview_output(
        overview=overview,
        key_points=key_points,
        deterministic_overview=deterministic_overview,
        deterministic_points=deterministic_points,
        timeline=timeline,
    )

    store.cache_synthesis(
        cache_key,
        {
            "topic_id": topic_id,
            "title": title,
            "overview": overview,
            "key_points": key_points,
            "article_count": len(items),
            "generated_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    return title, overview, key_points, False


def _build_topic_articles(
    items: list[dict[str, Any]],
    summary_map: dict[str, dict[str, Any] | None],
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for item in items:
        summary = summary_map.get(str(item.get("url", "")).strip(), None)
        out.append(_build_feed_item(item, summary))
    return out


def _cluster_primary_entity(cluster: dict[str, Any]) -> str:
    counts: Counter[str] = Counter()
    for item in cluster.get("items", []) or []:
        title = str(item.get("title", "") or "").lower()
        if not title:
            continue
        words = re.findall(r"[a-z0-9]+", title)
        for w in words:
            if w in ENTITY_TOPIC_TOKENS:
                counts[w] += 1
    if not counts:
        return "other"
    return counts.most_common(1)[0][0]


def _dedupe_items_by_url(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for item in items:
        url = str(item.get("url", "")).strip()
        if not url or url in seen:
            continue
        seen.add(url)
        out.append(item)
    return out


def _build_trending_topics_payload(
    store: V3Store,
    ranked_items: list[dict[str, Any]],
    summary_map: dict[str, dict[str, Any] | None],
    max_topics: int = 20,
) -> tuple[list[dict[str, Any]], dict[str, int]]:
    from concurrent.futures import ThreadPoolExecutor, as_completed

    clusters = _cluster_topic_candidates(ranked_items)
    if not clusters:
        return [], {"topics": 0, "overview_generated": 0, "overview_cached": 0}

    # Score all clusters, including singletons. Single-article stories should
    # stay isolated instead of being folded into a synthetic catch-all topic.
    scored_clusters: list[dict[str, Any]] = []
    for cluster in clusters:
        items = cluster.get("items", []) or []
        if not items:
            continue
        cluster["popularity_score"] = _cluster_popularity_score(cluster)
        scored_clusters.append(cluster)

    scored_clusters.sort(
        key=lambda c: float(c.get("popularity_score", 0.0)),
        reverse=True,
    )

    # Cap per-entity topic dominance (e.g., Apple <= 2 topic slots) while
    # preserving isolated stories as standalone topics when they rank high
    # enough to deserve a slot.
    max_topics_per_entity = 2
    entity_counts: defaultdict[str, int] = defaultdict(int)
    selected: list[dict[str, Any]] = []
    for cluster in scored_clusters:
        entity = _cluster_primary_entity(cluster)
        if entity_counts[entity] >= max_topics_per_entity:
            continue
        selected.append(cluster)
        entity_counts[entity] += 1
        if len(selected) >= max_topics:
            break

    # Pre-compute per-cluster data (timelines, IDs, fallback titles) — all CPU-bound
    cluster_data: list[dict[str, Any]] = []
    for idx, cluster in enumerate(selected):
        items = sorted(
            cluster.get("items", []) or [],
            key=lambda x: float(x.get("_trend_score", 0.0)),
            reverse=True,
        )
        if not items:
            continue

        signature = "|".join(
            sorted(str(i.get("url", "")).strip() for i in items if str(i.get("url", "")).strip())
        )
        digest = hashlib.sha256(signature.encode("utf-8")).hexdigest()[:16] if signature else f"misc{idx}"
        topic_id = f"tt_{digest}"
        fallback_title = "More updates" if cluster.get("is_misc") else _topic_title(cluster)
        timeline = _build_topic_timeline(topic_id, items, summary_map)

        cluster_data.append({
            "idx": idx,
            "cluster": cluster,
            "items": items,
            "topic_id": topic_id,
            "fallback_title": fallback_title,
            "timeline": timeline,
        })

    # Generate all topic overviews IN PARALLEL
    overview_generated = 0
    overview_cached = 0
    overview_results: dict[str, tuple[str, str, list[str]]] = {}  # topic_id → (title, overview, key_points)

    def _gen_overview(cd: dict[str, Any]) -> tuple[str, str, str, list[str], bool]:
        tid = cd["topic_id"]
        if len(cd["items"]) == 1:
            title, overview, key_points, from_cache = _build_singleton_topic_overview(
                item=cd["items"][0],
                fallback_title=cd["fallback_title"],
                summary_map=summary_map,
            )
            return tid, title, overview, key_points, from_cache
        title, overview, key_points, from_cache = _build_topic_overview(
            store=store,
            topic_id=tid,
            fallback_title=cd["fallback_title"],
            items=cd["items"],
            timeline=cd["timeline"],
            summary_map=summary_map,
        )
        return tid, title, overview, key_points, from_cache

    if not cluster_data:
        return [], {"topics": 0, "overview_generated": 0, "overview_cached": 0}

    with ThreadPoolExecutor(max_workers=min(8, len(cluster_data))) as executor:
        futures = {executor.submit(_gen_overview, cd): cd for cd in cluster_data}
        for future in as_completed(futures):
            try:
                tid, title, overview, key_points, from_cache = future.result()
                overview_results[tid] = (title, overview, key_points)
                if from_cache:
                    overview_cached += 1
                else:
                    overview_generated += 1
            except Exception as exc:
                cd = futures[future]
                _log(f"  Overview generation failed for {cd['topic_id']}: {exc}")

    # Assemble final topics list (preserving popularity order)
    topics: list[dict[str, Any]] = []
    for cd in cluster_data:
        items = cd["items"]
        topic_id = cd["topic_id"]
        cluster = cd["cluster"]
        timeline = cd["timeline"]
        idx = cd["idx"]

        if topic_id not in overview_results:
            continue
        topic_title, overview, key_points = overview_results[topic_id]

        token_counts: Counter[str] = Counter()
        for item in items:
            token_counts.update(_topic_tokens_for_item(item))
        tags = [tok for tok, _ in token_counts.most_common(4)]

        source_names = {
            str(i.get("source_name", "")).strip()
            for i in items
            if str(i.get("source_name", "")).strip()
        }
        interest_counts: Counter[str] = Counter(
            _normalize_trending_interest_id(i.get("interest_id", ""))
            for i in items
            if _normalize_trending_interest_id(i.get("interest_id", ""))
        )

        dts = [
            _parse_dt(str(i.get("published_date", "") or i.get("fetched_at", "")))
            for i in items
        ]
        dts = [dt for dt in dts if dt]
        first_seen_at = min(dts).isoformat() if dts else ""
        last_updated_at = max(dts).isoformat() if dts else ""

        hero = items[0]
        topics.append(
            {
                "id": topic_id,
                "topic_key": tags[0] if tags else topic_id,
                "title": topic_title,
                "summary": overview,
                "key_points": key_points,
                "is_featured": idx == 0,
                "popularity_score": float(cluster.get("popularity_score", 0.0)),
                "article_count": len(items),
                "source_count": len(source_names),
                "interest_id": interest_counts.most_common(1)[0][0] if interest_counts else "",
                "thumbnail": hero.get("og_image", "") or "",
                "first_seen_at": first_seen_at,
                "last_updated_at": last_updated_at,
                "tags": tags,
                "timeline": timeline,
                "articles": _build_topic_articles(items, summary_map),
            }
        )

    return topics, {
        "topics": len(topics),
        "overview_generated": overview_generated,
        "overview_cached": overview_cached,
    }


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
                    "interest_id": "tech",
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
                    "interest_id": "tech",
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
    summary_interest = str((summary or {}).get("interest_id", "")).strip()
    item_interest = _normalize_trending_interest_id(
        summary_interest or pool_item.get("interest_id", "")
    )
    return {
        "id": f"tr_{item_id}",
        "url": url,
        "title": pool_item.get("title", ""),
        "type": "news",
        "source": domain,
        "source_name": pool_item.get("source_name", domain),
        "interest_id": item_interest,
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
    previous_global_feed = store.load_global_feed(target_date)
    previous_topics = previous_global_feed.get("trending_topics", [])
    if not isinstance(previous_topics, list):
        previous_topics = []

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

    # For topic clustering, keep the full ranked set (before story-dedup)
    # but strictly filter to 24h so topics only contain today's news.
    cutoff = datetime.now(timezone.utc).timestamp() - (max_age_hours * 3600)
    ranked_for_topics = [
        item for item in ranked
        if (
            _parse_dt(str(item.get("published_date", "") or item.get("fetched_at", "")))
            or datetime.fromtimestamp(0, tz=timezone.utc)
        ).timestamp() >= cutoff
    ]
    _log(f"Topic clustering input: {len(ranked_for_topics)} articles (strict {max_age_hours}h window)")

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
        store.write_global_feed_section(target_date, "trending_topics", [])
        return {
            "items": 0,
            "topics": 0,
            "summaries_generated": 0,
            "summaries_cached": 0,
            "topic_overview_generated": 0,
            "topic_overview_cached": 0,
            "rejected": 0,
            "new_topics": 0,
            "users_matched": 0,
            "notifications_sent": 0,
        }

    # ------------------------------------------------------------------
    # PHASE 2b: Batch summarize all articles (parallel)
    # ------------------------------------------------------------------
    _log("-" * 40)
    _log("PHASE 2b: Summarize articles (parallel)")
    _log("-" * 40)

    # Summarize both deduped feed items and the broader topic-clustering pool.
    # Most URLs overlap so the extra calls will be cache hits.
    all_urls_to_summarize = {str(i.get("url", "")).strip() for i in ranked}
    topic_only = [
        i for i in ranked_for_topics
        if str(i.get("url", "")).strip() not in all_urls_to_summarize
    ]
    presummary = batch_presummarize(
        store, ranked + topic_only,
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
        "topics": 0,
        "summaries_generated": presummary.get("generated", 0),
        "summaries_cached": presummary.get("already_cached", 0),
        "topic_overview_generated": 0,
        "topic_overview_cached": 0,
        "rejected": presummary.get("rejected", 0) + presummary.get("failed", 0),
        "new_topics": 0,
        "users_matched": 0,
        "notifications_sent": 0,
    }

    feed_items: list[dict[str, Any]] = []
    for item in ranked:
        url = item.get("url", "")
        summary = summary_map.get(url)
        if not summary:
            continue
        classified_interest = _normalize_trending_interest_id(
            str(summary.get("interest_id", "")).strip() or str(item.get("interest_id", "")).strip()
        )
        item["interest_id"] = classified_interest
        feed_items.append(_build_feed_item(item, summary))

    for item in ranked_for_topics:
        url = str(item.get("url", "")).strip()
        summary = summary_map.get(url)
        if not isinstance(summary, dict):
            continue
        classified_interest = _normalize_trending_interest_id(
            str(summary.get("interest_id", "")).strip() or str(item.get("interest_id", "")).strip()
        )
        item["interest_id"] = classified_interest

    _log(f"Built {len(feed_items)} feed items")

    # Build grouped topics from the pre-dedup set (multiple articles per story
    # are needed for clustering) but filtered to strict 24h window.
    trending_topics, topic_stats = _build_trending_topics_payload(
        store=store,
        ranked_items=ranked_for_topics,
        summary_map=summary_map,
        max_topics=20,
    )
    _log(
        f"Built {len(trending_topics)} grouped topics "
        f"(overview_generated={topic_stats.get('overview_generated', 0)} "
        f"overview_cached={topic_stats.get('overview_cached', 0)})"
    )

    # Write to global feed location
    store.write_global_feed_section(target_date, "trending", feed_items)
    store.write_global_feed_section(target_date, "trending_topics", trending_topics)
    stats["items"] = len(feed_items)
    stats["topics"] = int(topic_stats.get("topics", 0))
    stats["topic_overview_generated"] = int(topic_stats.get("overview_generated", 0))
    stats["topic_overview_cached"] = int(topic_stats.get("overview_cached", 0))

    if not args.skip_notifications:
        notification_stats = send_interest_notifications(
            store=store,
            previous_topics=previous_topics,
            current_topics=trending_topics,
        )
        stats.update(notification_stats)
        _log(
            "Interest notifications: "
            f"new_topics={notification_stats.get('new_topics', 0)} "
            f"users_matched={notification_stats.get('users_matched', 0)} "
            f"sent={notification_stats.get('notifications_sent', 0)}"
        )

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
