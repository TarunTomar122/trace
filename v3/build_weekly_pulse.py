#!/usr/bin/env python3
"""
Build Weekly Pulse — one role-aware digest with top tools, blogs, and discussions.

Usage:
  python3 -m v3.build_weekly_pulse
  python3 -m v3.build_weekly_pulse --user-id <uid>
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from openai import OpenAI

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
load_dotenv(REPO_ROOT / ".env")

from v3.lib.content import fetch_content, fetch_og_image  # noqa: E402
from v3.lib.pulse_common import (  # noqa: E402
    ROLE_ORDER,
    classify_content_pool,
    load_recent_role_history,
    normalize_role,
    role_label,
    select_role_articles,
    signal_score,
)
from v3.lib.pulse_sources import fetch_build_pool, fetch_community_pool  # noqa: E402
from v3.lib.store import V3Store, _today_ist  # noqa: E402

ROLE_CLASSIFIER_BUCKET = "weekly_pulse_role_classifier_v1"
ROLE_CLASSIFIER_MODEL = "gpt-4.1-nano"
ITEM_SUMMARY_BUCKET = "weekly_pulse_item_summary_v2"
ITEM_SUMMARY_MODEL = "gpt-4o-mini"

TOOLS_LIMIT = 4
BLOGS_LIMIT = 3
DISCUSSIONS_LIMIT = 4

TOOLS_SOURCES = {"product hunt", "show hn", "github trending"}
DISCUSSION_SOURCES = {"hacker news", "lobsters"}
BLOG_SOURCES = {
    "pragmatic engineer",
    "leaddev",
    "nielsen norman group",
    "mind the product",
    "lenny's newsletter",
    "first round review",
    "techcrunch startups",
    "y combinator blog",
}


def _log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] [v3-weekly-pulse] {msg}")


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Build Weekly Pulse")
    p.add_argument("--user-id", default="")
    p.add_argument(
        "--audience",
        choices=["subscribed", "unsubscribed", "all"],
        default="all",
    )
    p.add_argument("--date", default="")
    p.add_argument("--users-file", default="", help="Accepted for scheduler compatibility.")
    return p.parse_args()


def _load_profiles(store: V3Store, args: argparse.Namespace) -> list[dict[str, Any]]:
    if args.user_id:
        profile = store.get_user_profile(args.user_id)
        return [profile] if profile else []
    return store.get_onboarded_users(args.audience)


def _resolve_roles(profiles: list[dict[str, Any]]) -> tuple[list[str], dict[str, int]]:
    counts: dict[str, int] = {}
    for profile in profiles:
        role = normalize_role(profile.get("role"))
        counts[role] = counts.get(role, 0) + 1
    roles = [role for role in ROLE_ORDER if counts.get(role, 0) > 0]
    if not roles:
        roles = list(ROLE_ORDER)
    return roles, counts


def _history_window(target_date: str) -> tuple[str, str]:
    try:
        end = datetime.strptime(target_date, "%Y-%m-%d").date()
    except ValueError:
        end = datetime.now(timezone.utc).date()
    start = end - timedelta(days=6)
    return start.isoformat(), end.isoformat()


def _safe_text(text: str) -> str:
    return re.sub(r"\s+", " ", str(text or "").strip())


def _clean_summary_text(text: str, limit: int = 900) -> str:
    paragraphs = []
    raw = str(text or "").replace("\r\n", "\n")
    for block in re.split(r"\n\s*\n", raw):
        cleaned_block = re.sub(r"\s+", " ", block).strip()
        if cleaned_block:
            paragraphs.append(cleaned_block)
    cleaned = "\n\n".join(paragraphs) if paragraphs else _safe_text(text)
    if len(cleaned) <= limit:
        return cleaned
    return cleaned[: limit - 1].rstrip() + "…"


def _item_cache_url(target_date: str, role: str, section: str, article: dict[str, Any]) -> str:
    raw = "|".join(
        [
            target_date,
            role,
            section,
            str(article.get("source", "")).strip(),
            str(article.get("url", "")).strip(),
            str(article.get("title", "")).strip(),
        ]
    )
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]
    return f"trace://weekly-pulse/{target_date}/{role}/{section}/{digest}"


def _fallback_summary(section: str, article: dict[str, Any]) -> str:
    preview = _safe_text(article.get("snippet", ""))
    title = _safe_text(article.get("title", ""))
    source = _safe_text(article.get("source", ""))
    if preview:
        return _clean_summary_text(preview)
    if section == "tools":
        return f"{title} surfaced in {source} this week and looks like one of the stronger role-relevant tools or launches."
    if section == "blogs":
        return f"{title} was one of the more useful reads this week from {source}."
    return f"{title} was one of the more substantive discussions we saw this week from {source}."


def _summarize_item(
    store: V3Store,
    target_date: str,
    role: str,
    section: str,
    article: dict[str, Any],
) -> str:
    cache_url = _item_cache_url(target_date, role, section, article)
    cached = store.get_cached_summary_v2(cache_url, ITEM_SUMMARY_BUCKET)
    if cached:
        summary = cached.get("summary")
        if isinstance(summary, dict) and isinstance(summary.get("body"), str):
            return summary["body"]

    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        return _fallback_summary(section, article)

    content = fetch_content(str(article.get("url", "")).strip())
    prompt_parts = [
        f"Role: {role_label(role)}",
        f"Section: {section}",
        f"Title: {_safe_text(article.get('title', ''))}",
        f"Source: {_safe_text(article.get('source', ''))}",
        f"Snippet: {_safe_text(article.get('snippet', ''))}",
    ]
    body = _safe_text((content or {}).get("content", ""))
    if section == "blogs" and len(body) < 500:
        _log(f"summary skipped: insufficient source text for {article.get('title', '')[:60]}")
        return _fallback_summary(section, article)
    if body:
        prompt_parts.append(f"Article text excerpt: {body[:7000]}")

    prompt = (
        "Write a compact but detailed weekly-digest summary for this item.\n"
        "It should be detailed enough that the user can mostly skip the original link.\n"
        "Write it as 2 to 4 short paragraphs, separated by blank lines.\n"
        "Each paragraph should be 1 to 3 sentences.\n"
        "Be concrete, readable, and specific. No fluff, no advice voice, no 'why it matters'.\n"
        "Return JSON only with key body.\n\n"
        + "\n".join(prompt_parts)
    )

    client = OpenAI(api_key=api_key)
    try:
        response = client.chat.completions.create(
            model=ITEM_SUMMARY_MODEL,
            messages=[
                {"role": "system", "content": "Return valid JSON only."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
            response_format={"type": "json_object"},
            timeout=60,
        )
        raw = json.loads(response.choices[0].message.content or "{}")
        generated_body = raw.get("body")
        if not isinstance(generated_body, str):
            raise ValueError("summary body must be a string")
        summary = {"body": _clean_summary_text(generated_body)}
        if summary["body"]:
            store.save_cached_summary_v2(cache_url, ITEM_SUMMARY_BUCKET, summary, ITEM_SUMMARY_MODEL)
            return summary["body"]
    except Exception as exc:
        _log(f"summary failed for {article.get('title', '')[:60]}: {exc}")

    fallback = _fallback_summary(section, article)
    store.save_cached_summary_v2(cache_url, ITEM_SUMMARY_BUCKET, {"body": fallback}, ITEM_SUMMARY_MODEL)
    return fallback


def _item_payload(
    store: V3Store,
    target_date: str,
    role: str,
    section: str,
    article: dict[str, Any],
) -> dict[str, Any]:
    url = str(article.get("url", "")).strip()
    title = _safe_text(article.get("title", ""))
    thumbnail = _safe_text(article.get("thumbnail", "")) or fetch_og_image(url)
    summary = _summarize_item(store, target_date, role, section, article)
    return {
        "id": hashlib.sha256(f"{section}:{url or title}".encode("utf-8")).hexdigest()[:16],
        "title": title,
        "url": url,
        "source": _safe_text(article.get("source", "")),
        "source_kind": _safe_text(article.get("source_kind", "")),
        "signal": _safe_text(article.get("signal", "")),
        "published_date": _safe_text(article.get("published_date", "")),
        "thumbnail": thumbnail,
        "summary": {
            "body": summary,
            "short_article": {
                "title": title,
                "body": summary,
            },
        },
        "roles": article.get("roles", []),
        "reading_time_minutes": max(1, len(summary.split()) // 180),
    }


def _blog_score(role: str, article: dict[str, Any], recent_urls: set[str], recent_titles: set[str]) -> float:
    score = 0.0
    role = normalize_role(role)
    if role in (article.get("roles") or []):
        score += 24.0
    if role in (article.get("role_hints") or []):
        score += 8.0

    source = str(article.get("source", "")).strip().lower()
    source_kind = str(article.get("source_kind", "")).strip().lower()
    if source in BLOG_SOURCES:
        score += 12.0
    if source.startswith("tldr "):
        score += 10.0
    if source_kind == "editorial":
        score += 8.0
    elif source_kind == "support":
        score += 6.0

    score += min(8.0, signal_score(article) / 20.0)
    url = str(article.get("url", "")).strip()
    title_sig = re.sub(r"[^a-z0-9]+", " ", str(article.get("title", "")).lower()).strip()
    if url in recent_urls:
        score -= 60.0
    if title_sig and title_sig in recent_titles:
        score -= 35.0
    return score


def _pick_blogs(
    role: str,
    articles: list[dict[str, Any]],
    recent_urls: set[str],
    recent_titles: set[str],
) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    for article in articles:
        source = str(article.get("source", "")).strip().lower()
        source_kind = str(article.get("source_kind", "")).strip().lower()
        if source not in BLOG_SOURCES and not source.startswith("tldr ") and source_kind not in {"editorial", "support"}:
            continue
        if role not in (article.get("roles") or []):
            continue
        record = dict(article)
        record["_rank_score"] = _blog_score(role, article, recent_urls, recent_titles)
        candidates.append(record)
    candidates.sort(key=lambda item: item.get("_rank_score", 0.0), reverse=True)

    selected: list[dict[str, Any]] = []
    source_counts: dict[str, int] = {}
    for article in candidates:
        source = str(article.get("source", "")).strip().lower()
        if source_counts.get(source, 0) >= 1:
            continue
        selected.append(article)
        source_counts[source] = source_counts.get(source, 0) + 1
        if len(selected) >= BLOGS_LIMIT:
            break
    return selected


def _pick_tools(
    role: str,
    build_articles: list[dict[str, Any]],
    recent_urls: set[str],
    recent_titles: set[str],
) -> list[dict[str, Any]]:
    pool = [
        article
        for article in build_articles
        if str(article.get("source", "")).strip().lower() in TOOLS_SOURCES
        or str(article.get("source_kind", "")).strip().lower() == "build"
    ]
    return select_role_articles(role, pool, recent_urls, recent_titles, total_limit=TOOLS_LIMIT, lane="build")[:TOOLS_LIMIT]


def _pick_discussions(
    role: str,
    community_articles: list[dict[str, Any]],
    recent_urls: set[str],
    recent_titles: set[str],
) -> list[dict[str, Any]]:
    pool = []
    for article in community_articles:
        source = str(article.get("source", "")).strip().lower()
        source_kind = str(article.get("source_kind", "")).strip().lower()
        if source_kind == "community" or source in DISCUSSION_SOURCES or source.startswith("r/"):
            pool.append(article)
    return select_role_articles(role, pool, recent_urls, recent_titles, total_limit=DISCUSSIONS_LIMIT, lane="community")[:DISCUSSIONS_LIMIT]


def main() -> None:
    args = _parse_args()
    store = V3Store()
    profiles = _load_profiles(store, args)
    roles, role_counts = _resolve_roles(profiles)
    target_date = args.date or _today_ist()
    window_start, window_end = _history_window(target_date)

    _log("==================================================")
    _log("WEEKLY PULSE — Starting")
    _log(f"  user-id={args.user_id or 'ALL'} audience={args.audience}")
    _log("==================================================")
    _log(f"Building weekly pulse for roles={roles} date={target_date} window={window_start}..{window_end}")

    community_pool = fetch_community_pool(roles=roles, weekly=True, log_fn=_log)
    build_pool = fetch_build_pool(roles=roles, weekly=True, log_fn=_log)

    community_classified, community_stats = classify_content_pool(
        store,
        community_pool,
        bucket=ROLE_CLASSIFIER_BUCKET,
        model=ROLE_CLASSIFIER_MODEL,
        log_fn=_log,
    )
    build_classified, build_stats = classify_content_pool(
        store,
        build_pool,
        bucket=ROLE_CLASSIFIER_BUCKET,
        model=ROLE_CLASSIFIER_MODEL,
        log_fn=_log,
    )

    total_sections = 0
    total_items = 0
    for role in roles:
        recent_urls, recent_titles = load_recent_role_history(
            store,
            role,
            target_date,
            section_prefix="weekly_pulse",
            lookback_days=28,
        )
        tools = _pick_tools(role, build_classified, recent_urls, recent_titles)
        blogs = _pick_blogs(role, community_classified + build_classified, recent_urls, recent_titles)
        discussions = _pick_discussions(role, community_classified, recent_urls, recent_titles)

        payload = {
            "tools": [
                _item_payload(store, target_date, role, "tools", article)
                for article in tools
            ],
            "blogs": [
                _item_payload(store, target_date, role, "blogs", article)
                for article in blogs
            ],
            "discussions": [
                _item_payload(store, target_date, role, "discussions", article)
                for article in discussions
            ],
        }
        metadata = {
            "label": "Weekly Pulse",
            "window_start": window_start,
            "window_end": window_end,
            "role": role,
            "audience_users": role_counts.get(role, 0),
            "tools_count": len(payload["tools"]),
            "blogs_count": len(payload["blogs"]),
            "discussions_count": len(payload["discussions"]),
            "community_pool_size": len(community_classified),
            "build_pool_size": len(build_classified),
        }
        store.write_global_role_digest(target_date, "weekly_pulse", role, payload, metadata=metadata)
        total_sections += 3
        total_items += sum(len(items) for items in payload.values())
        _log(
            f"  role={role} wrote tools={len(payload['tools'])} blogs={len(payload['blogs'])} discussions={len(payload['discussions'])}"
        )

    result = {
        "roles": len(roles),
        "items_total": total_items,
        "sections_total": total_sections,
        **community_stats,
        **{f"build_{k}": v for k, v in build_stats.items()},
    }
    _log(f"Weekly pulse done: {result}")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
