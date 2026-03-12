#!/usr/bin/env python3
"""
Assemble final user feeds from the three feed sections.

Reads the for_you and trending sections already written
by the build scripts, adds metadata, promotes yesterday's URLs to seen,
and writes the final assembled doc.

Usage:
  python3 -m v3.assemble_feeds
  python3 -m v3.assemble_feeds --user-id <uid>
  python3 -m v3.assemble_feeds --date 2026-02-17
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

from v3.lib.store import V3Store, _today_ist  # noqa: E402
from v3.lib.store import FOR_YOU_POOL  # noqa: E402
from v3.lib.summarizer import compute_technical_depth, evaluate_for_you_fit, get_or_generate_summary  # noqa: E402
from v3.lib.scorer import rank_articles  # noqa: E402
from v3.lib.diversity import dedupe_and_cap  # noqa: E402

ROLE_PRIMARY_INTERESTS: dict[str, list[str]] = {
    "designer": ["experience"],
    "developer": ["engineering", "technology"],
    "pm": ["business-market", "startups"],
    "marketer": ["marketing", "business-market"],
    "founder": ["startups", "business-market", "leadership"],
}

INTEREST_ALIASES: dict[str, str] = {
    "ai": "technology",
    "business": "business-market",
    "design": "experience",
}

EVERGREEN_EXPERIMENT_MAX_AGE_DAYS = 365
EVERGREEN_EXPERIMENT_SOURCES = {
    "Import AI",
    "Latent Space",
    "Smashing Magazine",
    "A List Apart",
    "Nielsen Norman Group",
    "Figma Blog",
    "Interaction Design Foundation",
    "Boxes and Arrows",
    "InfoQ",
    "Stripe Blog",
    "GitHub Blog Engineering",
    "Cloudflare Blog",
    "SaaStr",
    "First Round Review",
    "Y Combinator Blog",
    "Lenny's Newsletter",
    "Stratechery",
    "Mind the Product",
    "Farnam Street",
}


def _log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] [v3-assemble] {msg}")


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Assemble v3 user feeds")
    p.add_argument("--user-id", default="")
    p.add_argument("--limit-users", type=int, default=0)
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
        help="Which users to assemble for",
    )
    p.add_argument(
        "--merged-experiment",
        action="store_true",
        help="Build merged_feed from exact-date inputs only with small caps and no fallback",
    )
    p.add_argument(
        "--merged-now-limit",
        type=int,
        default=4,
        help="Max topic_now items in merged experiment mode",
    )
    p.add_argument(
        "--merged-evergreen-limit",
        type=int,
        default=2,
        help="Max article_worth_reading items in merged experiment mode",
    )
    return p.parse_args()


def _yesterday(date_str: str) -> str:
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    return (dt - timedelta(days=1)).strftime("%Y-%m-%d")


def _recent_dates(start_date: str, days: int) -> list[str]:
    dt = datetime.strptime(start_date, "%Y-%m-%d")
    return [
        (dt - timedelta(days=offset)).strftime("%Y-%m-%d")
        for offset in range(max(1, days))
    ]


def _normalize_interest_id(value: str) -> str:
    normalized = str(value or "").strip().lower()
    return INTEREST_ALIASES.get(normalized, normalized)


def _first_sentence(text: str) -> str:
    cleaned = " ".join(str(text or "").split()).strip()
    if not cleaned:
        return ""
    parts = [p.strip() for p in cleaned.split(".") if p.strip()]
    if not parts:
        return cleaned[:220].strip()
    sentence = parts[0]
    return sentence if sentence.endswith((".", "!", "?")) else f"{sentence}."


def _sentences(text: str) -> list[str]:
    cleaned = " ".join(str(text or "").split()).strip()
    if not cleaned:
        return []
    chunks = [part.strip() for part in cleaned.replace("!", ".").replace("?", ".").split(".")]
    sentences = [chunk for chunk in chunks if chunk]
    return [
        sentence if sentence.endswith((".", "!", "?")) else f"{sentence}."
        for sentence in sentences
    ]


def _to_paragraphs(texts: list[str], max_paragraphs: int = 3, max_sentences_per_paragraph: int = 2) -> list[str]:
    sentences: list[str] = []
    for text in texts:
        sentences.extend(_sentences(text))
    if not sentences:
        return []

    paragraphs: list[str] = []
    current: list[str] = []
    for sentence in sentences:
        current.append(sentence)
        if len(current) >= max_sentences_per_paragraph:
            paragraphs.append(" ".join(current).strip())
            current = []
        if len(paragraphs) >= max_paragraphs:
            break
    if current and len(paragraphs) < max_paragraphs:
        paragraphs.append(" ".join(current).strip())
    return paragraphs[:max_paragraphs]


def _derive_worth_reading_summary(item: dict[str, Any]) -> dict[str, Any]:
    summary = item.get("summary", {}) if isinstance(item.get("summary"), dict) else {}
    short = summary.get("short_article", {}) if isinstance(summary.get("short_article"), dict) else {}
    subtitle = str(short.get("subtitle", "")).strip()
    body = str(short.get("body", "")).strip()
    key_takeaways = short.get("key_takeaways") if isinstance(short.get("key_takeaways"), list) else []

    takeaways: list[str] = []

    if key_takeaways:
        takeaways = [
            " ".join(str(point).split()).strip()
            for point in key_takeaways
            if str(point).strip()
        ][:3]

    paragraph_sources = [
        text for text in [
            subtitle,
            body,
        ]
        if str(text).strip()
    ]
    if takeaways:
        paragraph_sources.extend(takeaways)

    paragraphs = _to_paragraphs(paragraph_sources)
    if not paragraphs:
        fallback = _first_sentence(body) or _first_sentence(subtitle) or "A sharp read worth your time."
        paragraphs = [fallback]

    return {
        "paragraphs": paragraphs[:3],
    }


def _make_topic_now_entry(topic: dict[str, Any]) -> dict[str, Any]:
    display_summary = str(topic.get("summary", "")).strip()
    key_points = topic.get("key_points") if isinstance(topic.get("key_points"), list) else []
    normalized_interest = _normalize_interest_id(str(topic.get("interest_id", "")))
    return {
        "id": f"mf_topic_{topic.get('id', '')}",
        "item_kind": "topic_now",
        "label": "Now",
        "interest_id": normalized_interest,
        "topic_id": topic.get("id", ""),
        "published_date": topic.get("last_updated_at", "") or topic.get("first_seen_at", ""),
        "last_updated_at": topic.get("last_updated_at", ""),
        "source_count": topic.get("source_count", 0),
        "article_count": topic.get("article_count", 0),
        "display_summary": display_summary,
        "display_key_points": [str(point).strip() for point in key_points if str(point).strip()][:3],
    }


def _make_worth_reading_entry(item: dict[str, Any]) -> dict[str, Any]:
    worth_summary = _derive_worth_reading_summary(item)
    return {
        "id": f"mf_article_{item.get('id', '')}",
        "item_kind": "article_worth_reading",
        "label": "Worth Reading",
        "interest_id": _normalize_interest_id(str(item.get("interest_id", ""))),
        "article_id": item.get("id", ""),
        "published_date": item.get("published_date", ""),
        "source_count": 1,
        "article_count": 1,
        "display_summary": worth_summary["paragraphs"][0] if worth_summary["paragraphs"] else "",
        "display_key_points": worth_summary["paragraphs"],
        "worth_reading": worth_summary,
    }


def _build_for_you_feed_item(pool_item: dict[str, Any], summary: dict[str, Any]) -> dict[str, Any]:
    url = str(pool_item.get("url", "")).strip()
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
        "summary": summary,
        "metadata": {
            "feed_type": "for_you",
            "content_length": pool_item.get("content_length", 0),
            "experimental_evergreen": True,
        },
    }


def _score_topic_for_user(
    topic: dict[str, Any],
    interests: set[str],
    role_primary: set[str],
) -> float:
    score = 0.0
    interest_id = _normalize_interest_id(str(topic.get("interest_id", "")))
    if interest_id in interests:
        score += 5.0
    if interest_id in role_primary:
        score += 2.0
    score += min(int(topic.get("source_count", 0) or 0), 5) * 0.35
    score += min(int(topic.get("article_count", 0) or 0), 5) * 0.2
    return score


def _rank_topics_for_user(
    topics: list[dict[str, Any]],
    profile: dict[str, Any],
) -> list[dict[str, Any]]:
    interests = {
        _normalize_interest_id(interest)
        for interest in profile.get("interests", [])
        if str(interest).strip()
    }
    role_primary = {
        _normalize_interest_id(interest)
        for interest in ROLE_PRIMARY_INTERESTS.get(str(profile.get("role", "")).strip(), [])
    }
    scored = [
        (_score_topic_for_user(topic, interests, role_primary), idx, topic)
        for idx, topic in enumerate(topics)
    ]
    scored.sort(key=lambda row: (-row[0], row[1]))
    return [topic for _, _, topic in scored]


def _apply_role_quota(
    ranked: list[dict[str, Any]],
    role_primary: set[str],
    target: int,
) -> list[dict[str, Any]]:
    if not role_primary or target <= 0:
        return ranked[:target]

    primary = [a for a in ranked if a.get("interest_id") in role_primary]
    other = [a for a in ranked if a.get("interest_id") not in role_primary]
    min_primary = max(1, int(target * 0.5))
    picked_primary = primary[:min_primary]
    remaining = target - len(picked_primary)
    leftover_primary = primary[min_primary:]
    fill_pool = leftover_primary + other
    return (picked_primary + fill_pool[:remaining])[:target]


def _load_recent_user_section(
    store: V3Store,
    uid: str,
    target_date: str,
    section: str,
    lookback_days: int = 5,
) -> tuple[list[dict[str, Any]], str]:
    for date_key in _recent_dates(target_date, lookback_days):
        feed = store.load_feed(uid, date_key)
        items = feed.get(section, [])
        if isinstance(items, list) and items:
            return items, date_key
    return [], target_date


def _build_experimental_evergreen_feed(
    store: V3Store,
    profile: dict[str, Any],
    *,
    limit: int,
) -> list[dict[str, Any]]:
    if limit <= 0:
        return []

    uid = str(profile.get("uid", "")).strip()
    role = str(profile.get("role", "")).strip()
    goals = profile.get("careerGoals", []) or []
    interests = {str(i).strip() for i in profile.get("interests", []) if str(i).strip()}
    role_primary = set(ROLE_PRIMARY_INTERESTS.get(role, []))
    eligible = interests | role_primary
    if not eligible:
        return []

    seen_urls = store.get_seen_urls(uid) if uid else set()
    candidates = store.load_pool(
        FOR_YOU_POOL,
        interest_ids=eligible,
        source_names=EVERGREEN_EXPERIMENT_SOURCES,
        max_age_days=EVERGREEN_EXPERIMENT_MAX_AGE_DAYS,
        exclude_urls=seen_urls,
    )
    if not candidates:
        return []

    ranked = rank_articles(candidates, goals, role_primary_interests=role_primary)
    diverse = dedupe_and_cap(ranked)
    seeded = _apply_role_quota(diverse, role_primary, max(limit * 3, limit))
    technical_depth = compute_technical_depth(profile)

    feed_items: list[dict[str, Any]] = []
    for candidate in seeded:
        if len(feed_items) >= limit:
            break
        title = str(candidate.get("title", "")).strip()
        url = str(candidate.get("url", "")).strip()
        content = str(candidate.get("content", "")).strip()
        source_name = str(candidate.get("source_name", "")).strip()
        if not title or not url or not content:
            continue

        fit_ok, _ = evaluate_for_you_fit(
            title=title,
            url=url,
            content=content,
            interest_id=str(candidate.get("interest_id", "")),
            subinterest_id=str(candidate.get("subinterest_id", "")),
            source_name=source_name,
        )
        if not fit_ok:
            continue

        summary, _ = get_or_generate_summary(
            store,
            url,
            title,
            content,
            feed_type="for_you",
            technical_depth=technical_depth,
        )
        if not summary:
            continue
        feed_items.append(_build_for_you_feed_item(candidate, summary))

    return feed_items[:limit]


def _build_merged_feed(
    profile: dict[str, Any],
    topics: list[dict[str, Any]],
    for_you_items: list[dict[str, Any]],
    *,
    now_limit: int = 0,
    evergreen_limit: int = 0,
) -> list[dict[str, Any]]:
    ranked_topics = _rank_topics_for_user(topics, profile)
    topic_entries = [_make_topic_now_entry(topic) for topic in ranked_topics]
    article_entries = [_make_worth_reading_entry(item) for item in for_you_items]

    if now_limit > 0:
        topic_entries = topic_entries[:now_limit]
    if evergreen_limit > 0:
        article_entries = article_entries[:evergreen_limit]

    if not topic_entries:
        return article_entries
    if not article_entries:
        return topic_entries

    merged: list[dict[str, Any]] = []
    topic_idx = 0
    article_idx = 0
    topic_block_sizes = [3, 4]
    block_idx = 0

    if topic_idx < len(topic_entries):
        merged.append(topic_entries[topic_idx])
        topic_idx += 1

    while topic_idx < len(topic_entries) or article_idx < len(article_entries):
        block_size = topic_block_sizes[block_idx % len(topic_block_sizes)]
        added_topics = 0
        while topic_idx < len(topic_entries) and added_topics < block_size:
            merged.append(topic_entries[topic_idx])
            topic_idx += 1
            added_topics += 1
        if article_idx < len(article_entries):
            merged.append(article_entries[article_idx])
            article_idx += 1
        block_idx += 1

    return merged


def _load_exact_user_section(
    store: V3Store,
    uid: str,
    target_date: str,
    section: str,
) -> list[dict[str, Any]]:
    feed = store.load_feed(uid, target_date)
    items = feed.get(section, [])
    return items if isinstance(items, list) else []


def _load_exact_global_trending(
    store: V3Store, target_date: str
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], str]:
    global_feed = store.load_global_feed(target_date)
    trending = global_feed.get("trending", [])
    trending_topics = global_feed.get("trending_topics", [])
    return (
        trending if isinstance(trending, list) else [],
        trending_topics if isinstance(trending_topics, list) else [],
        target_date,
    )


def _load_recent_global_trending(
    store: V3Store, target_date: str, lookback_days: int = 5
) -> tuple[list, list, str]:
    """
    Load global trending with fallback to recent non-empty days.
    Returns (trending_items, trending_topics, source_date).
    """
    for date_key in _recent_dates(target_date, lookback_days):
        global_feed = store.load_global_feed(date_key)
        trending = global_feed.get("trending", [])
        trending_topics = global_feed.get("trending_topics", [])
        if trending or trending_topics:
            return trending, trending_topics, date_key

    # Fall back to exact target date if no recent non-empty snapshot exists.
    global_feed = store.load_global_feed(target_date)
    return (
        global_feed.get("trending", []),
        global_feed.get("trending_topics", []),
        target_date,
    )


def _load_users(store: V3Store, args: argparse.Namespace) -> list[dict]:
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


def assemble(args: argparse.Namespace) -> dict[str, int]:
    store = V3Store()
    target_date = args.date.strip() or _today_ist()
    yesterday = _yesterday(target_date)

    users = _load_users(store, args)
    if args.user_id:
        users = [u for u in users if u.get("uid") == args.user_id]
    if args.limit_users > 0:
        users = users[: args.limit_users]

    _log(f"Assembling feeds for {len(users)} users, date={target_date}")
    stats = {"users": 0, "total_items": 0, "merged_items": 0, "seen_promoted": 0}

    # Load global trending feed (shared across all users).
    if args.merged_experiment:
        global_trending, global_trending_topics, global_source_date = _load_exact_global_trending(
            store, target_date
        )
    else:
        # If today's global doc is partial, fall back to recent non-empty snapshot.
        global_trending, global_trending_topics, global_source_date = _load_recent_global_trending(
            store, target_date
        )
    _log(f"Global trending: {len(global_trending)} items (source_date={global_source_date})")
    _log(
        f"Global trending topics: {len(global_trending_topics)} groups "
        f"(source_date={global_source_date})"
    )

    for profile in users:
        uid = profile.get("uid", "")
        if not uid:
            continue

        feed = store.load_feed(uid, target_date)
        for_you_source_date = target_date
        if args.merged_experiment:
            for_you = _build_experimental_evergreen_feed(
                store,
                profile,
                limit=args.merged_evergreen_limit,
            )
            store.write_feed_section(uid, target_date, "for_you", for_you)
        else:
            for_you = feed.get("for_you", [])
            if not isinstance(for_you, list):
                for_you = []
            if not for_you:
                for_you, for_you_source_date = _load_recent_user_section(
                    store, uid, target_date, "for_you"
                )
        # Always use global trending (it's fresher news, refreshed every 2 hours)
        trending = global_trending
        trending_topics = global_trending_topics
        # Write global trending to user's feed
        if trending:
            store.write_feed_section(uid, target_date, "trending", trending)
        # Always write grouped topics (empty list clears stale content on re-runs).
        store.write_feed_section(uid, target_date, "trending_topics", trending_topics)
        merged_feed = _build_merged_feed(
            profile,
            trending_topics,
            for_you,
            now_limit=args.merged_now_limit if args.merged_experiment else 0,
            evergreen_limit=args.merged_evergreen_limit if args.merged_experiment else 0,
        )
        store.write_feed_section(uid, target_date, "merged_feed", merged_feed)
        total = len(for_you) + len(trending)

        # Promote today's AND yesterday's feed URLs to seen
        all_seen_urls: list[str] = []
        for date_key in (target_date, yesterday):
            day_feed = store.load_feed(uid, date_key) if date_key != target_date else feed
            for section in ("for_you", "trending"):
                for item in day_feed.get(section, []):
                    if isinstance(item, dict) and item.get("url"):
                        all_seen_urls.append(item["url"])
        if all_seen_urls:
            promoted = store.promote_feed_to_seen(uid, all_seen_urls)
            stats["seen_promoted"] += promoted

        metadata = {
            "for_you_count": len(for_you),
            "trending_count": len(trending),
            "trending_topics_count": len(trending_topics),
            "merged_feed_count": len(merged_feed),
            "total_items": total,
            "pipeline": "v3",
            "interests": sorted(profile.get("interests", [])),
            "summary_style": profile.get("summaryStyle", ""),
            "seniority": profile.get("seniority", ""),
            "for_you_source_date": for_you_source_date,
            "merged_feed_generated_at": datetime.now(timezone.utc).isoformat(),
            "merged_feed_experiment": bool(args.merged_experiment),
            "merged_now_limit": args.merged_now_limit if args.merged_experiment else 0,
            "merged_evergreen_limit": args.merged_evergreen_limit if args.merged_experiment else 0,
        }
        store.write_feed_metadata(uid, target_date, metadata)

        stats["users"] += 1
        stats["total_items"] += total
        stats["merged_items"] += len(merged_feed)
        _log(
            f"  user={uid} assembled: fy={len(for_you)} "
            f"tr={len(trending)} merged={len(merged_feed)} "
            f"(fy_source={for_you_source_date})"
        )

    store.record_run("assemble", {"date": target_date, **stats})
    _log(f"Assembly done: {stats}")
    return stats


def main() -> None:
    args = _parse_args()
    _log("=" * 50)
    _log("ASSEMBLE — Starting")
    _log(
        f"  user-id={args.user_id or 'ALL'} audience={args.audience} "
        f"date={args.date or 'today'}"
    )
    _log("=" * 50)
    result = assemble(args)
    _log("=" * 50)
    _log(f"ASSEMBLE — Complete: {result}")
    _log("=" * 50)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
