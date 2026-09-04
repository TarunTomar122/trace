#!/usr/bin/env python3
"""
Build Pulse — one shared builders digest with top tools, blogs, and discussions.

Runs hourly. Fetches the current content pool, classifies it across engineering,
design, product, and founder perspectives, then writes the shared payload to
every legacy role key so older mobile clients keep their existing contract.

Usage:
  python3 -m v3.build_daily_pulse
  python3 -m v3.build_daily_pulse --user-id <uid>
  python3 -m v3.build_daily_pulse --pool-only
  python3 -m v3.build_daily_pulse --skip-pool
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
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

ROLE_CLASSIFIER_BUCKET = "daily_pulse_role_classifier_v1"
ROLE_CLASSIFIER_MODEL = "gpt-4.1-nano"
ITEM_SUMMARY_BUCKET = "daily_pulse_item_summary_v5"
ITEM_SUMMARY_MODEL = "gpt-4o-mini"
PULSE_SELECTION_ROLE = "developer"
COMPACT_SUMMARY_SECTIONS = {"tools", "discussions"}
COMPACT_SUMMARY_MAX_WORDS = 24
BLOG_SUMMARY_MAX_CHARS = 1800

TOOLS_LIMIT = 4
BLOGS_LIMIT = 6
DISCUSSIONS_LIMIT = 6

TOOLS_SOURCES = {"product hunt", "show hn", "github trending"}
DISCUSSION_SOURCES = {"hacker news", "lobsters"}
BLOG_SOURCES = {
    "pragmatic engineer",
    "stack overflow blog",
    "github blog",
    "simon willison's blog",
    "latent space",
    "eugene yan",
    "google deepmind",
    "hugging face",
    "hamel's blog",
    "drew breunig",
}
VIDEO_SOURCES = {
    "theo - t3.gg",
    "fireship",
    "the primetime",
    "ai explained",
    "jack herrington",
    "ai engineer",
}
BLOG_SOURCES |= VIDEO_SOURCES

BUILDER_FOCUS_TERMS = {
    "ai": 14,
    "llm": 14,
    "llms": 14,
    "model": 10,
    "models": 10,
    "agent": 10,
    "agents": 10,
    "claude": 14,
    "openai": 14,
    "anthropic": 14,
    "gemini": 12,
    "kimi": 12,
    "coding": 8,
    "code": 6,
    "programming": 8,
    "developer": 6,
    "software": 6,
    "typescript": 8,
    "javascript": 8,
    "python": 8,
    "rust": 8,
    "react": 8,
    "database": 8,
    "postgres": 8,
    "compiler": 8,
    "api": 6,
    "open source": 8,
}
BUILDER_NOISE_TERMS = {
    "sales": 14,
    "marketing": 14,
    "prospect": 14,
    "prospects": 14,
    "outreach": 14,
    "lead generation": 14,
    "fundraising": 10,
    "seed round": 10,
    "product-market fit": 10,
}


def _log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] [v3-daily-pulse] {msg}")


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Build Daily Pulse")
    p.add_argument("--user-id", default="")
    p.add_argument(
        "--audience",
        choices=["subscribed", "unsubscribed", "all"],
        default="all",
    )
    p.add_argument("--date", default="")
    p.add_argument("--users-file", default="", help="Accepted for scheduler compatibility.")
    p.add_argument("--pool-only", action="store_true", help="Refresh pool data only, skip feed generation.")
    p.add_argument("--skip-pool", action="store_true", help="Skip pool refresh, use cached pool data.")
    return p.parse_args()


def _load_profiles(store: V3Store, args: argparse.Namespace) -> list[dict[str, Any]]:
    if args.user_id:
        profile = store.get_user_profile(args.user_id)
        return [profile] if profile else []
    return store.get_onboarded_users(args.audience)


def _safe_text(text: str) -> str:
    return re.sub(r"\s+", " ", str(text or "").strip())


def _clean_summary_text(text: str, limit: int = BLOG_SUMMARY_MAX_CHARS) -> str:
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


def _compact_summary_text(text: str) -> str:
    clean = _safe_text(text)
    if not clean:
        return ""
    first_sentence = re.split(r"(?<=[.!?])\s+", clean, maxsplit=1)[0]
    words = first_sentence.split()
    if len(words) <= COMPACT_SUMMARY_MAX_WORDS:
        return first_sentence
    return " ".join(words[:COMPACT_SUMMARY_MAX_WORDS]).rstrip(".,;:!?") + "…"


def _normalize_item_summary(section: str, text: str) -> str:
    if section in COMPACT_SUMMARY_SECTIONS:
        return _compact_summary_text(text)
    return _clean_summary_text(text)


def _normalize_summary_payload(
    section: str,
    body: str,
    key_takeaways: Any = None,
) -> dict[str, Any]:
    points = [
        _safe_text(point)
        for point in (key_takeaways if isinstance(key_takeaways, list) else [])
        if isinstance(point, str) and _safe_text(point)
    ]
    if section == "blogs":
        marker = re.search(r"\bKey takeaways:\s*", body, flags=re.IGNORECASE)
        if marker:
            flattened = body[marker.end():]
            body = body[:marker.start()].rstrip()
            if not points:
                points = [
                    _safe_text(point)
                    for point in re.split(r"(?:^|\s)[-•]\s+", flattened)
                    if _safe_text(point)
                ]
    return {
        "body": _normalize_item_summary(section, body),
        "key_takeaways": points[:4] if section == "blogs" else [],
    }


def _summary_instructions(section: str) -> str:
    if section in COMPACT_SUMMARY_SECTIONS:
        return (
            f"Write exactly one factual sentence of no more than {COMPACT_SUMMARY_MAX_WORDS} words.\n"
            "Say what it is and its main differentiator. No setup, hype, advice, or call to action.\n"
        )
    return (
        "Write a 180-260 word replacement brief that lets a busy builder skip the original.\n"
        "Start directly with the central result or argument. Never write meta phrases such as "
        "'the article discusses', 'the author explores', or 'the post highlights'.\n"
        "Capture the concrete facts: named people or systems, what changed, how it was done, "
        "the sequence of events, numbers, evidence, constraints, and the outcome.\n"
        "For technical stories, include the before/after architecture or process, implementation "
        "details, tradeoffs, failure modes, and what the team would do differently.\n"
        "Write 3-5 short paragraphs in body and return 2-4 reusable lessons separately "
        "in the key_takeaways array.\n"
        "Be specific and plainspoken. "
        "Do not add facts, conclusions, or advice that the source does not support.\n"
    )


def _item_cache_url(target_date: str, role: str, section: str, article: dict[str, Any]) -> str:
    raw = "|".join([
        target_date, role, section,
        str(article.get("source", "")).strip(),
        str(article.get("url", "")).strip(),
        str(article.get("title", "")).strip(),
    ])
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]
    return f"trace://daily-pulse/{target_date}/{role}/{section}/{digest}"


def _fallback_summary(section: str, article: dict[str, Any]) -> str:
    preview = _safe_text(article.get("snippet", ""))
    title = _safe_text(article.get("title", ""))
    source = _safe_text(article.get("source", ""))
    if preview:
        return _normalize_item_summary(section, preview)
    if section == "tools":
        fallback = f"{title} surfaced in {source} today and looks like one of the stronger role-relevant tools or launches."
        return _normalize_item_summary(section, fallback)
    if section == "blogs":
        return f"{title} was one of the more useful reads today from {source}."
    fallback = f"{title} was one of the more substantive discussions we saw today from {source}."
    return _normalize_item_summary(section, fallback)


def _summarize_item(
    store: V3Store,
    target_date: str,
    role: str,
    section: str,
    article: dict[str, Any],
) -> dict[str, Any]:
    cache_url = _item_cache_url(target_date, role, section, article)
    cached = store.get_cached_summary_v2(cache_url, ITEM_SUMMARY_BUCKET)
    if cached:
        summary = cached.get("summary")
        if isinstance(summary, dict) and isinstance(summary.get("body"), str):
            return _normalize_summary_payload(
                section,
                summary["body"],
                summary.get("key_takeaways"),
            )

    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        return _normalize_summary_payload(section, _fallback_summary(section, article))

    content = fetch_content(str(article.get("url", "")).strip())
    prompt_parts = [
        f"Role: {role_label(role)}",
        f"Section: {section}",
        f"Title: {_safe_text(article.get('title', ''))}",
        f"Source: {_safe_text(article.get('source', ''))}",
        f"Snippet: {_safe_text(article.get('snippet', ''))}",
    ]
    body = _safe_text((content or {}).get("content", ""))
    snippet = _safe_text(article.get("snippet", ""))
    is_video = str(article.get("source", "")).strip().lower() in VIDEO_SOURCES
    if section == "blogs" and len(body) < 500 and not (is_video and len(snippet) >= 120):
        _log(f"summary skipped: insufficient source text for {article.get('title', '')[:60]}")
        return _normalize_summary_payload(section, _fallback_summary(section, article))
    if body:
        prompt_parts.append(f"Article text excerpt: {body[:20000]}")

    prompt = (
        _summary_instructions(section)
        + "Return JSON only with keys body and key_takeaways. body must be one string; "
        "key_takeaways must be an array of strings and must be empty for compact sections.\n\n"
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
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "daily_pulse_summary",
                    "strict": True,
                    "schema": {
                        "type": "object",
                        "properties": {
                            "body": {"type": "string"},
                            "key_takeaways": {
                                "type": "array",
                                "items": {"type": "string"},
                                "minItems": 2 if section == "blogs" else 0,
                                "maxItems": 4 if section == "blogs" else 0,
                            },
                        },
                        "required": ["body", "key_takeaways"],
                        "additionalProperties": False,
                    },
                },
            },
            timeout=60,
        )
        raw = json.loads(response.choices[0].message.content or "{}")
        generated_body = raw.get("body")
        if not isinstance(generated_body, str):
            raise ValueError("summary body must be a string")
        summary = _normalize_summary_payload(
            section,
            generated_body,
            raw.get("key_takeaways"),
        )
        if summary["body"]:
            store.save_cached_summary_v2(cache_url, ITEM_SUMMARY_BUCKET, summary, ITEM_SUMMARY_MODEL)
            return summary
    except Exception as exc:
        _log(f"summary failed for {article.get('title', '')[:60]}: {exc}")

    fallback = _normalize_summary_payload(section, _fallback_summary(section, article))
    store.save_cached_summary_v2(cache_url, ITEM_SUMMARY_BUCKET, fallback, ITEM_SUMMARY_MODEL)
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
            "body": summary["body"],
            "short_article": {
                "title": title,
                "body": summary["body"],
                "key_takeaways": summary["key_takeaways"],
            },
        },
        "roles": article.get("roles", []),
        "reading_time_minutes": max(1, len(summary["body"].split()) // 180),
    }


def _write_shared_pulse(
    store: V3Store,
    target_date: str,
    payload: dict[str, list[dict[str, Any]]],
    metadata: dict[str, Any],
) -> None:
    store.write_global_role_digests(
        target_date,
        "daily_pulse",
        {role: payload for role in ROLE_ORDER},
        metadata_by_role={
            role: {**metadata, "role": role}
            for role in ROLE_ORDER
        },
    )


def _builder_focus_score(article: dict[str, Any]) -> int:
    text = " " + re.sub(
        r"[^a-z0-9+#.]+",
        " ",
        " ".join([
            str(article.get("title", "")),
            str(article.get("source", "")),
            str(article.get("snippet", "")),
        ]).lower(),
    ).strip() + " "
    score = sum(
        weight
        for term, weight in BUILDER_FOCUS_TERMS.items()
        if f" {term} " in text
    )
    score -= sum(
        weight
        for term, weight in BUILDER_NOISE_TERMS.items()
        if f" {term} " in text
    )
    return score


def _freshness_score(article: dict[str, Any]) -> int:
    raw = str(article.get("published_date", "")).strip()
    if not raw:
        return 0
    try:
        try:
            published = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError:
            published = parsedate_to_datetime(raw)
        if published.tzinfo is None:
            published = published.replace(tzinfo=timezone.utc)
        age_days = max(0, (datetime.now(timezone.utc) - published).days)
    except (TypeError, ValueError):
        return 0
    if age_days <= 2:
        return 30
    if age_days <= 7:
        return 20
    if age_days <= 14:
        return 10
    return -30 if age_days > 30 else 0


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
    score += _builder_focus_score(article)
    score += _freshness_score(article)
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
        if normalize_role(role) not in (article.get("roles") or []):
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
        a for a in build_articles
        if str(a.get("source", "")).strip().lower() in TOOLS_SOURCES
        or str(a.get("source_kind", "")).strip().lower() == "build"
    ]
    selected = select_role_articles(
        role,
        pool,
        recent_urls,
        recent_titles,
        total_limit=TOOLS_LIMIT * 3,
        lane="build",
    )
    selected.sort(
        key=lambda article: (
            _builder_focus_score(article)
            + (10 if str(article.get("source", "")).lower() in {"github trending", "show hn"} else 0),
            article.get("_rank_score", 0),
        ),
        reverse=True,
    )
    return selected[:TOOLS_LIMIT]


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
    selected = select_role_articles(
        role,
        pool,
        recent_urls,
        recent_titles,
        total_limit=DISCUSSIONS_LIMIT * 3,
        lane="community",
    )
    selected.sort(
        key=lambda article: (
            _builder_focus_score(article),
            article.get("_rank_score", 0),
        ),
        reverse=True,
    )
    return selected[:DISCUSSIONS_LIMIT]


def main() -> None:
    args = _parse_args()
    store = V3Store()
    target_date = args.date or _today_ist()

    _log("==================================================")
    _log("DAILY PULSE — Starting")
    _log(f"  user-id={args.user_id or 'ALL'} audience={args.audience} date={target_date}")
    _log("==================================================")

    if args.pool_only:
        _log("Pool-only mode — fetching community and build pools")
        fetch_community_pool(roles=[PULSE_SELECTION_ROLE], weekly=False, log_fn=_log)
        fetch_build_pool(roles=[PULSE_SELECTION_ROLE], weekly=False, log_fn=_log)
        _log("Pool refresh done")
        print(json.dumps({"pool_only": True}))
        return

    profiles = _load_profiles(store, args)
    _log(f"Building shared daily pulse for audience={len(profiles)}")

    community_pool = fetch_community_pool(roles=[PULSE_SELECTION_ROLE], weekly=False, log_fn=_log)
    build_pool = fetch_build_pool(roles=[PULSE_SELECTION_ROLE], weekly=False, log_fn=_log)

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

    recent_urls, recent_titles = load_recent_role_history(
        store,
        PULSE_SELECTION_ROLE,
        target_date,
        section_prefix="daily_pulse",
        lookback_days=7,
    )
    tools = _pick_tools(PULSE_SELECTION_ROLE, build_classified, recent_urls, recent_titles)
    blogs = _pick_blogs(
        PULSE_SELECTION_ROLE,
        community_classified + build_classified,
        recent_urls,
        recent_titles,
    )
    discussions = _pick_discussions(
        PULSE_SELECTION_ROLE,
        community_classified,
        recent_urls,
        recent_titles,
    )

    payload = {
        "tools": [_item_payload(store, target_date, PULSE_SELECTION_ROLE, "tools", a) for a in tools],
        "blogs": [_item_payload(store, target_date, PULSE_SELECTION_ROLE, "blogs", a) for a in blogs],
        "discussions": [_item_payload(store, target_date, PULSE_SELECTION_ROLE, "discussions", a) for a in discussions],
    }
    metadata = {
        "label": "Builders Pulse",
        "date": target_date,
        "shared": True,
        "audience_users": len(profiles),
        "tools_count": len(payload["tools"]),
        "blogs_count": len(payload["blogs"]),
        "discussions_count": len(payload["discussions"]),
        "community_pool_size": len(community_classified),
        "build_pool_size": len(build_classified),
    }
    _write_shared_pulse(store, target_date, payload, metadata)
    total_items = sum(len(items) for items in payload.values())
    _log(
        f"  shared tools={len(payload['tools'])} blogs={len(payload['blogs'])} "
        f"discussions={len(payload['discussions'])}"
    )

    result = {
        "roles": 1,
        "items_total": total_items,
        "sections_total": 3,
        **community_stats,
        **{f"build_{k}": v for k, v in build_stats.items()},
    }
    _log(f"Daily pulse done: {result}")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
