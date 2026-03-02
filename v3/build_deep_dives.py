#!/usr/bin/env python3
"""
Build "Deep Dives" feed — synthesized original content from multiple sources.

Each deep dive combines 2-3 related articles from user's selected sources
into one cohesive, original piece with our own title and narrative.

Users get 2 deep dives per day, personalized to their source selections.

Usage:
  python3 -m v3.build_deep_dives
  python3 -m v3.build_deep_dives --skip-pool
  python3 -m v3.build_deep_dives --user-id <uid>
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from openai import OpenAI
import os

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
load_dotenv(REPO_ROOT / ".env")

from v1.storage import is_user_subscribed  # noqa: E402
from v2.utils.fetch_article_links import fetch_article_links  # noqa: E402
from v3.lib.store import V3Store, DEEP_DIVE_POOL, FREE_TIER_LIMITS, _today_ist  # noqa: E402
from v3.lib.content import fetch_content, fetch_og_image  # noqa: E402

CONFIG_PATH = "v3/config/deep_dive_sources.json"
DEFAULT_DEEP_DIVES_PER_USER = 2
DEFAULT_LIMIT_PER_SOURCE = 5
DEFAULT_MAX_AGE = 60

MODEL = "gpt-4o-mini"
CLUSTERING_MODEL = "gpt-4o-mini"

# Fallback: map user interests → deep dive source categories.
INTEREST_TO_DD_CATEGORIES: dict[str, list[str]] = {
    "technology":       ["tech-engineering"],
    "engineering":      ["tech-engineering"],
    "experience":       ["design-ux"],
    "business-market":  ["business-strategy"],
    "startups":         ["startups-product", "business-strategy"],
    "leadership":       ["business-strategy", "productivity-growth"],
    "marketing":        ["business-strategy"],
    "fintech":          ["finance-markets"],
    "productivity":     ["productivity-growth"],
    "web3":             ["tech-engineering"],
    "climate":          ["business-strategy"],
    "health":           ["productivity-growth"],
}


def _log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] [v3-deep-dives] {msg}")


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Build Deep Dives feed")
    p.add_argument("--skip-pool", action="store_true")
    p.add_argument("--pool-only", action="store_true")
    p.add_argument("--user-id", default="")
    p.add_argument("--limit-users", type=int, default=0)
    p.add_argument("--limit-per-source", type=int, default=DEFAULT_LIMIT_PER_SOURCE)
    p.add_argument("--max-age-days", type=int, default=DEFAULT_MAX_AGE)
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


def _sources_for_interests(interests: list[str], config_sources: list[dict]) -> set[str]:
    """Derive a set of deep dive source names from user interests."""
    categories: set[str] = set()
    for interest_id in interests:
        categories.update(INTEREST_TO_DD_CATEGORIES.get(interest_id, []))
    if not categories:
        categories = {"tech-engineering", "business-strategy"}
    return {
        s["name"] for s in config_sources if s.get("category_id") in categories
    }


# ---------------------------------------------------------------------------
# Clustering: Group related articles by topic
# ---------------------------------------------------------------------------

CLUSTERING_PROMPT = """You are grouping articles by topic for synthesis.

Given these articles, identify 2 distinct topic clusters where articles can be combined into a cohesive deep dive. Each cluster should have 2-3 articles that share a common theme.

ARTICLES:
{articles}

Return JSON:
{{
  "clusters": [
    {{
      "theme": "Short theme description (3-5 words)",
      "article_indices": [0, 2, 4],
      "synthesis_angle": "What interesting narrative could combine these?"
    }},
    {{
      "theme": "Another theme",
      "article_indices": [1, 3],
      "synthesis_angle": "The narrative angle"
    }}
  ]
}}

RULES:
- Exactly 2 clusters
- Each cluster has 2-3 articles (prefer 3 if possible)
- Articles can only appear in ONE cluster
- Find genuinely related articles, not forced groupings
- If articles are too diverse, pick the best 2 groupings you can
"""

def cluster_articles(articles: list[dict[str, Any]], max_retries: int = 2) -> list[dict[str, Any]]:
    """Use LLM to cluster articles into topic groups.

    Includes retry logic for transient API errors.
    """
    if len(articles) < 4:
        # Not enough to make 2 clusters, return single cluster
        return [{"theme": "Mixed insights", "articles": articles[:3], "synthesis_angle": "Key learnings"}]

    # Format articles for prompt
    formatted = []
    for i, art in enumerate(articles[:12]):  # Cap at 12 to avoid token limits
        formatted.append(f"[{i}] \"{art.get('title', '')}\" - {art.get('source_name', '')}")

    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY", "").strip())

    for attempt in range(max_retries):
        try:
            resp = client.chat.completions.create(
                model=CLUSTERING_MODEL,
                messages=[
                    {"role": "system", "content": "Return valid JSON only."},
                    {"role": "user", "content": CLUSTERING_PROMPT.format(articles="\n".join(formatted))}
                ],
                temperature=0.3,
                response_format={"type": "json_object"},
                timeout=30,
            )
            result = json.loads(resp.choices[0].message.content or "{}")
            clusters = result.get("clusters", [])

            # Map indices back to articles
            output = []
            for cluster in clusters[:2]:
                indices = cluster.get("article_indices", [])
                cluster_articles_list = [articles[i] for i in indices if i < len(articles)]
                if cluster_articles_list:
                    output.append({
                        "theme": cluster.get("theme", ""),
                        "articles": cluster_articles_list,
                        "synthesis_angle": cluster.get("synthesis_angle", ""),
                    })
            return output
        except Exception as e:
            error_type = type(e).__name__
            if attempt < max_retries - 1:
                _log(f"Clustering attempt {attempt + 1} failed: [{error_type}] {e}. Retrying...")
                time.sleep(2)
            else:
                _log(f"Clustering failed after {max_retries} attempts: [{error_type}] {e}, using fallback")

    # Fallback: just split articles
    mid = len(articles) // 2
    return [
        {"theme": "Insights Part 1", "articles": articles[:3], "synthesis_angle": ""},
        {"theme": "Insights Part 2", "articles": articles[mid:mid+3], "synthesis_angle": ""},
    ]


# ---------------------------------------------------------------------------
# Pre-summarization: Extract key points before synthesis
# ---------------------------------------------------------------------------

EXTRACT_PROMPT = """Extract the key insights from this article for a deep dive synthesis.

ARTICLE: {title}
SOURCE: {source}

CONTENT:
{content}

Return JSON:
{{
  "key_points": [
    "First key insight or argument (1-2 sentences)",
    "Second key point (1-2 sentences)",
    "Third key point if available (1-2 sentences)"
  ],
  "notable_quotes": [
    "Any memorable quote or strong statement from the article",
    "Another quote if available"
  ],
  "main_thesis": "What is the article's central argument? (1-2 sentences)"
}}

RULES:
- Extract 2-4 key points that capture the essence
- Include 1-2 actual quotes from the text (not paraphrased)
- Keep total output under 400 words
- Focus on unique insights, not generic statements
"""


def extract_article_key_points(
    article: dict[str, Any],
    client: OpenAI,
    store: V3Store,
    max_retries: int = 2,
) -> tuple[dict[str, Any] | None, bool]:
    """Extract key points from an article before synthesis.

    This produces a focused ~300 word summary that captures what matters,
    rather than arbitrary truncation.

    Returns:
        Tuple of (extraction_result, was_cached)
    """
    url = article.get("url", "")
    content = article.get("content", "")
    if not content or len(content) < 200:
        return None, False

    # Check cache first
    if url:
        cached = store.get_cached_extraction(url)
        if cached:
            return cached, True

    # Truncate very long content for extraction (but model picks what matters)
    content_for_extraction = content[:8000] if len(content) > 8000 else content

    for attempt in range(max_retries):
        try:
            resp = client.chat.completions.create(
                model="gpt-4o-mini",  # Cheap, fast model for extraction
                messages=[
                    {"role": "system", "content": "Extract key insights. Return valid JSON only."},
                    {"role": "user", "content": EXTRACT_PROMPT.format(
                        title=article.get("title", ""),
                        source=article.get("source_name", ""),
                        content=content_for_extraction,
                    )}
                ],
                temperature=0.2,
                response_format={"type": "json_object"},
                timeout=30,
            )
            result = json.loads(resp.choices[0].message.content or "{}")

            # Cache the result
            if url and result:
                store.cache_extraction(url, result)

            return result, False
        except Exception as e:
            if attempt < max_retries - 1:
                time.sleep(1)
            else:
                _log(f"  Extract failed for {article.get('title', '')[:30]}: {e}")
    return None, False


# ---------------------------------------------------------------------------
# Synthesis: Create original deep dive from multiple articles
# ---------------------------------------------------------------------------

SYNTHESIS_PROMPT = """You are creating a DEEP DIVE article that synthesizes insights from multiple expert sources.

This is NOT a summary. It's an ORIGINAL, in-depth piece that weaves ideas into a cohesive narrative with chapters. Think of yourself as a magazine writer creating premium content.

THEME: {theme}
SYNTHESIS ANGLE: {angle}

SOURCE ARTICLES:
{sources}

Create a chapter-style deep dive. Return JSON:
{{
  "title": "Compelling, original title (not copying sources)",
  "subtitle": "One sentence hook that makes reader want to dive in",
  "tldr": "2-3 sentence executive summary of the key insight",
  "chapters": [
    {{
      "title": "Chapter title (e.g., 'The Shift Everyone Missed')",
      "content": "150-200 words of original analysis weaving source insights together. Write in an engaging, editorial style. Use **bold** for key phrases.",
      "quote": {{
        "text": "An actual quote or key insight extracted from one of the sources",
        "source": "Author/Source name"
      }}
    }},
    {{
      "title": "Second chapter title",
      "content": "150-200 words continuing the narrative...",
      "quote": {{
        "text": "Another powerful quote from the sources",
        "source": "Author name"
      }}
    }},
    {{
      "title": "Third chapter title",
      "content": "150-200 words...",
      "quote": null
    }}
  ],
  "bottom_line": {{
    "title": "The Bottom Line",
    "content": "80-100 words synthesizing what this all means. What should the reader take away? What action or shift in thinking?"
  }},
  "reading_time_minutes": <estimated int, typically 4-6>
}}

RULES:
- 3-4 chapters, each 150-200 words (total ~800 words of content)
- Weave sources together naturally, don't treat them separately
- Include 2-3 actual quotes extracted from the source content (not made up)
- Write in engaging editorial style, not dry summary
- Each chapter should have a compelling title
- The narrative should BUILD - each chapter adds to the previous
- **Bold** 1-2 key phrases per chapter
- NO fluff, NO generic statements - every sentence should add value
"""

# Keep old prompt for backwards compatibility
SYNTHESIS_PROMPT_CARDS = """You are creating an ORIGINAL deep dive that synthesizes insights from multiple expert sources.

This is NOT a summary of each article. It's a NEW piece of content that weaves together the ideas into one cohesive narrative. Think of yourself as a writer creating original content, using these sources as research.

THEME: {theme}
SYNTHESIS ANGLE: {angle}

SOURCE ARTICLES:
{sources}

Create a deep dive with:
1. An ORIGINAL, compelling title (not copying any source title)
2. Learning cards that teach the concept by drawing from all sources

Return JSON:
{{
  "title": "Your original, intriguing title",
  "subtitle": "One sentence hook",
  "learning_cards": [
    {{
      "type": "hook",
      "emoji": "🎯",
      "content": "Set up the topic - why should reader care? (40-60 words)"
    }},
    {{
      "type": "insight",
      "emoji": "💡",
      "content": "Key insight weaving perspectives from sources (50-70 words)"
    }},
    {{
      "type": "insight",
      "emoji": "🔍",
      "content": "Another insight, maybe where sources agree/disagree (50-70 words)"
    }},
    {{
      "type": "insight",
      "emoji": "🛠️",
      "content": "Practical angle or framework from the sources (50-70 words)"
    }},
    {{
      "type": "why",
      "emoji": "🎯",
      "content": "Why this matters for the reader's work/thinking (40-60 words)"
    }},
    {{
      "type": "bottom_line",
      "emoji": "⚡",
      "content": "The synthesis - what to take away from all this (40-50 words)"
    }}
  ]
}}

RULES:
- Create ORIGINAL content, not summaries
- Weave sources together, don't treat them separately
- Reference sources naturally: "As [Author] points out..." or "Building on [Source]'s framework..."
- The title should be compelling and original - something a top publication would use
- 5-6 cards total
- Dense with insights, no fluff
"""

def synthesize_deep_dive(
    cluster: dict[str, Any],
    store: V3Store,
    max_retries: int = 3,
) -> dict[str, Any] | None:
    """Generate a synthesized deep dive from a cluster of articles.

    Includes automatic retry with exponential backoff for transient API errors.
    """
    articles = cluster.get("articles", [])
    if not articles:
        return None

    # Check cache first (use different key for chapter format)
    cache_key = _synthesis_cache_key(articles) + "_v2"
    cached = store.get_cached_synthesis(cache_key)
    if cached:
        _log(f"  Using cached synthesis: {cached.get('title', '')[:50]}")
        return cached

    # Collect images from sources
    images = []
    for art in articles:
        img = art.get("og_image", "")
        if img and img.startswith("http") and img not in images:
            images.append(img)

    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY", "").strip())

    # Pre-extract key points from each article (smart extraction, not truncation)
    cached_count = 0
    sources_text = []
    for i, art in enumerate(articles):
        extracted, was_cached = extract_article_key_points(art, client, store)
        if was_cached:
            cached_count += 1

        if extracted:
            # Use model-extracted key points
            key_points = "\n".join(f"- {p}" for p in extracted.get("key_points", []))
            quotes = "\n".join(f'"{q}"' for q in extracted.get("notable_quotes", []))
            thesis = extracted.get("main_thesis", "")

            source_content = f"Main thesis: {thesis}\n\nKey points:\n{key_points}"
            if quotes:
                source_content += f"\n\nNotable quotes:\n{quotes}"
        else:
            # Fallback: simple truncation if extraction fails
            content = art.get("content", "")
            source_content = content[:2000] if len(content) > 2000 else content

        sources_text.append(
            f"--- SOURCE {i+1}: {art.get('source_name', '')} ---\n"
            f"Title: {art.get('title', '')}\n"
            f"{source_content}\n"
        )

    _log(f"  Extracted {len(articles)} articles ({cached_count} from cache)")
    last_error = None

    for attempt in range(max_retries):
        try:
            resp = client.chat.completions.create(
                model=MODEL,
                messages=[
                    {"role": "system", "content": "You are an expert magazine writer creating premium editorial content. Return valid JSON only."},
                    {"role": "user", "content": SYNTHESIS_PROMPT.format(
                        theme=cluster.get("theme", ""),
                        angle=cluster.get("synthesis_angle", ""),
                        sources="\n\n".join(sources_text),
                    )}
                ],
                temperature=0.6,  # Higher for more creative writing
                response_format={"type": "json_object"},
                timeout=90,
            )
            result = json.loads(resp.choices[0].message.content or "{}")

            if not result.get("title") or not result.get("chapters"):
                _log(f"  Synthesis returned incomplete result")
                return None

            # Add source references and images
            result["sources"] = [
                {
                    "name": art.get("source_name", ""),
                    "title": art.get("title", ""),
                    "url": art.get("url", ""),
                }
                for art in articles
            ]
            result["images"] = images[:3]  # Max 3 images

            # Cache the result
            store.cache_synthesis(cache_key, result)
            _log(f"  Synthesized: {result.get('title', '')[:50]}")
            return result

        except Exception as e:
            last_error = e
            error_type = type(e).__name__
            if attempt < max_retries - 1:
                wait_time = (2 ** attempt) + 1  # 2s, 3s, 5s
                _log(f"  Synthesis attempt {attempt + 1} failed: [{error_type}] {e}. Retrying in {wait_time}s...")
                time.sleep(wait_time)
            else:
                _log(f"  Synthesis failed after {max_retries} attempts: [{error_type}] {last_error}")

    return None


def _synthesis_cache_key(articles: list[dict]) -> str:
    """Create a cache key from article URLs."""
    urls = sorted(art.get("url", "") for art in articles)
    return hashlib.sha256("|".join(urls).encode()).hexdigest()[:32]


# ---------------------------------------------------------------------------
# Phase 1: Pool refresh (same as before)
# ---------------------------------------------------------------------------

def refresh_pool(store: V3Store, config: dict[str, Any], limit_per_source: int) -> dict[str, int]:
    from concurrent.futures import ThreadPoolExecutor, as_completed
    import threading

    sources = config.get("sources", [])
    stats = {"sources": len(sources), "links_found": 0, "new_items": 0, "skipped": 0, "errors": 0}
    stats_lock = threading.Lock()

    def _process_source(src: dict[str, Any]) -> None:
        src_name = src["name"]
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
        existing_urls = store.pool_items_exist(DEEP_DIVE_POOL, article_urls)

        for art in articles:
            url = art.url if hasattr(art, "url") else art.get("url", "")
            if not url:
                continue

            if url in existing_urls:
                with stats_lock:
                    stats["skipped"] += 1
                continue

            title = art.title if hasattr(art, "title") else art.get("title", "")
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

    stale = store.deactivate_stale(DEEP_DIVE_POOL, max_age_days=DEFAULT_MAX_AGE + 30)
    stats["deactivated"] = stale
    _log(f"Pool refresh done: {stats}")
    return stats


# ---------------------------------------------------------------------------
# Phase 2: Per-user synthesized deep dives
# ---------------------------------------------------------------------------

def _build_feed_item(synthesis: dict[str, Any], index: int) -> dict[str, Any]:
    """Build a feed item from synthesized content."""
    title = synthesis.get("title", "")
    item_id = hashlib.sha256(f"{title}_{index}".encode()).hexdigest()[:32]
    images = synthesis.get("images", [])

    return {
        "id": f"dd_{item_id}",
        "title": title,
        "type": "deep_dive",
        "source": "trace",
        "source_name": "Trace Deep Dive",
        "feed_type": "deep_dives",
        "thumbnail": images[0] if images else "",
        "sources": synthesis.get("sources", []),
        "summary": {
            "deep_dive": {
                "subtitle": synthesis.get("subtitle", ""),
                "tldr": synthesis.get("tldr", ""),
                "chapters": synthesis.get("chapters", []),
                "bottom_line": synthesis.get("bottom_line", {}),
                "images": images,
            },
            "reading_time_minutes": synthesis.get("reading_time_minutes", 5),
        },
        "metadata": {
            "feed_type": "deep_dives",
            "synthesized": True,
            "source_count": len(synthesis.get("sources", [])),
            "format": "chapters",
        },
    }


def _build_global_deep_dive(
    store: V3Store,
    config: dict[str, Any],
    target_date: str,
    max_age: int,
) -> list[dict[str, Any]]:
    """Build a single global deep dive to share with all free users."""
    _log("Building GLOBAL deep dive for free users...")

    # Use all sources for global deep dive
    all_sources = {s.get("name", "") for s in config.get("sources", []) if s.get("name")}

    candidates = store.load_pool(
        DEEP_DIVE_POOL,
        source_names=all_sources,
        max_age_days=max_age,
    )

    if len(candidates) < 3:
        _log("  Not enough articles for global deep dive")
        return []

    # Pick top articles by recency/quality
    candidates = sorted(
        candidates,
        key=lambda x: x.get("published_date", "") or x.get("fetched_at", ""),
        reverse=True,
    )[:20]

    clusters = cluster_articles(candidates)
    if not clusters:
        _log("  No clusters found for global deep dive")
        return []

    # Generate one deep dive from the best cluster
    synthesis = synthesize_deep_dive(clusters[0], store)
    if not synthesis:
        _log("  Failed to synthesize global deep dive")
        return []

    feed_item = _build_feed_item(synthesis, 0)
    feed_item["metadata"]["is_global"] = True  # Mark as global/shared

    # Store global deep dive
    store.write_feed_section("_global", target_date, "deep_dives", [feed_item])
    _log(f"  Global deep dive created: {feed_item.get('title', '')[:50]}")

    return [feed_item]


def build_user_feeds(
    store: V3Store,
    config: dict[str, Any],
    args: argparse.Namespace,
) -> dict[str, int]:
    target_date = args.date.strip() or _today_ist()
    max_age = args.max_age_days

    users = _load_users(store, args)
    if args.user_id:
        users = [u for u in users if u.get("uid") == args.user_id]
    if args.limit_users > 0:
        users = users[: args.limit_users]

    _log(f"Building synthesized Deep Dives for {len(users)} users, date={target_date}")

    stats = {
        "users": 0,
        "deep_dives_total": 0,
        "syntheses_generated": 0,
        "syntheses_cached": 0,
        "users_skipped_no_articles": 0,
        "free_users_global": 0,
    }

    # Precompute per-user source selections and shared source union once.
    # This avoids N repeated Firestore pool scans for subscribed users.
    user_jobs: list[tuple[dict[str, Any], bool, set[str]]] = []
    subscribed_source_union: set[str] = set()

    for profile in users:
        uid = profile.get("uid", "")
        if not uid:
            continue
        is_sub = is_user_subscribed(profile)
        selected_sources: set[str] = set()

        if is_sub:
            selected_sources = set(profile.get("selectedLearningSources", []) or [])
            if not selected_sources:
                interests = profile.get("interests", []) or []
                selected_sources = _sources_for_interests(interests, config.get("sources", []))
                if selected_sources:
                    _log(f"  user={uid} no sources → using {len(selected_sources)} from interests")
            if selected_sources:
                subscribed_source_union |= selected_sources
        user_jobs.append((profile, is_sub, selected_sources))

    # Build global deep dive once per run.
    # Used for free users and as a fallback for subscribed users with sparse matches.
    global_deep_dives = _build_global_deep_dive(store, config, target_date, max_age)

    # Load subscribed candidates once and filter in memory per user.
    subscribed_candidates: list[dict[str, Any]] = []
    if subscribed_source_union:
        subscribed_candidates = store.load_pool(
            DEEP_DIVE_POOL,
            source_names=subscribed_source_union,
            max_age_days=max_age,
        )
        _log(
            f"Loaded {len(subscribed_candidates)} shared deep-dive candidates "
            f"for {len(subscribed_source_union)} subscribed sources"
        )

    for profile, is_sub, selected_sources in user_jobs:
        uid = profile.get("uid", "")
        if not uid:
            continue

        # Free users get the global shared deep dive (no personalized generation)
        if not is_sub:
            store.write_feed_section(uid, target_date, "deep_dives", global_deep_dives)
            stats["free_users_global"] += 1
            _log(f"  user={uid} FREE → assigned global deep dive")
            continue

        target_deep_dives = DEFAULT_DEEP_DIVES_PER_USER

        if not selected_sources:
            _log(f"  user={uid} no sources, skipping")
            store.write_feed_section(uid, target_date, "deep_dives", [])
            stats["users_skipped_no_articles"] += 1
            continue

        # Filter shared candidate pool by user's source choices, then by seen URLs.
        candidates = [
            c for c in subscribed_candidates
            if c.get("source_name", "") in selected_sources
        ]
        seen_urls = store.get_seen_urls(uid)
        candidates = [c for c in candidates if c.get("url", "") not in seen_urls]

        if len(candidates) < 2:
            # Fallback to global deep dive for pro users with no personalized content
            if global_deep_dives:
                store.write_feed_section(uid, target_date, "deep_dives", global_deep_dives)
                _log(f"  user={uid} only {len(candidates)} articles → fallback to global deep dive")
            else:
                store.write_feed_section(uid, target_date, "deep_dives", [])
                _log(f"  user={uid} only {len(candidates)} articles, skipping")
            stats["users_skipped_no_articles"] += 1
            continue

        _log(f"  user={uid} has {len(candidates)} articles from {len(selected_sources)} sources")

        # Cluster articles into topic groups
        clusters = cluster_articles(candidates)
        _log(f"  Found {len(clusters)} clusters")

        # Generate synthesized deep dives
        feed_items = []
        for i, cluster in enumerate(clusters[:target_deep_dives]):
            synthesis = synthesize_deep_dive(cluster, store)
            if synthesis:
                feed_items.append(_build_feed_item(synthesis, i))
                stats["syntheses_generated"] += 1

        # Write feed
        store.write_feed_section(uid, target_date, "deep_dives", feed_items)
        stats["users"] += 1
        stats["deep_dives_total"] += len(feed_items)
        _log(f"  user={uid} wrote {len(feed_items)} synthesized deep dives")

    store.record_run("deep_dives", {"date": target_date, **stats})
    _log(f"Deep Dives done: {stats}")
    return stats


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    args = _parse_args()
    _log("=" * 50)
    _log("DEEP DIVES (Synthesized) — Starting")
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
    _log("PHASE 2: Per-user synthesized deep dives")
    _log("-" * 40)
    feed_stats = build_user_feeds(store, config, args)
    _log("=" * 50)
    _log(f"DEEP DIVES — Complete: {feed_stats}")
    _log("=" * 50)
    print(json.dumps(feed_stats, indent=2))


if __name__ == "__main__":
    main()
