#!/usr/bin/env python3
"""
Refresh Firestore-backed article pool from validated sources.

Pipeline:
1) Read validated sources from v2/config/interest_source_links.json
2) Fetch recent article links per source
3) Fetch full article content (no truncation)
4) Generate summary (default: intermediate)
5) Upsert into Firestore collection article_pool_v2
6) Cleanup stale items by retention window
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

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from openai import OpenAI

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
load_dotenv(REPO_ROOT / ".env")

from v1.storage import FirestoreStore  # noqa: E402
from v1.tools.summary_prompts import get_prompt_for_skill_level  # noqa: E402
from v2.utils.fetch_article_links import fetch_article_links  # noqa: E402

POOL_COLLECTION = "article_pool_v2"
RUNS_COLLECTION = "pipeline_runs_v2"
DEFAULT_SOURCES_CONFIG = "v2/config/interest_source_links.json"

PAYWALL_INDICATORS = (
    "subscribe to continue reading",
    "subscribe to read",
    "already a subscriber",
    "member-only",
    "subscribers only",
    "premium content",
    "unlock this article",
    "create an account to continue",
)


def _log(message: str) -> None:
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{stamp}] [v2-pool] {message}")


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Refresh article pool in Firestore from validated sources."
    )
    parser.add_argument(
        "--sources-config",
        default=DEFAULT_SOURCES_CONFIG,
        help="Path to source config JSON.",
    )
    parser.add_argument(
        "--limit-per-source",
        type=int,
        default=5,
        help="Max candidate links fetched per source.",
    )
    parser.add_argument(
        "--days-rss",
        type=int,
        default=7,
        help="Recency window for RSS sources.",
    )
    parser.add_argument(
        "--days-atom",
        type=int,
        default=7,
        help="Recency window for Atom sources.",
    )
    parser.add_argument(
        "--days-html",
        type=int,
        default=14,
        help="Recency window for HTML sources.",
    )
    parser.add_argument(
        "--days-sitemap",
        type=int,
        default=14,
        help="Recency window for sitemap sources.",
    )
    parser.add_argument(
        "--default-days",
        type=int,
        default=14,
        help="Fallback recency window.",
    )
    parser.add_argument(
        "--retention-days",
        type=int,
        default=14,
        help="Retention window for pool items.",
    )
    parser.add_argument(
        "--summary-skill-level",
        default="intermediate",
        choices=["beginner", "intermediate", "expert"],
        help="Summary style for generated summaries.",
    )
    parser.add_argument(
        "--summary-model",
        default="gpt-4o-mini",
        help="OpenAI model for summaries.",
    )
    parser.add_argument(
        "--summary-temperature",
        type=float,
        default=0.3,
        help="OpenAI summary temperature.",
    )
    parser.add_argument(
        "--summary-timeout-seconds",
        type=int,
        default=60,
        help="Timeout in seconds for each OpenAI summary request.",
    )
    parser.add_argument(
        "--content-ttl-days",
        type=int,
        default=3,
        help="Skip re-fetching content if fetched within this TTL.",
    )
    parser.add_argument(
        "--summary-ttl-days",
        type=int,
        default=14,
        help="Skip re-summarizing if summary is fresh and content unchanged.",
    )
    parser.add_argument(
        "--force-refresh",
        action="store_true",
        help="Force re-fetch + re-summarize even when cache is fresh.",
    )
    parser.add_argument(
        "--http-timeout",
        type=int,
        default=25,
        help="HTTP timeout for article fetch.",
    )
    parser.add_argument(
        "--interest-id",
        action="append",
        default=[],
        help="Filter to one or more interests. Repeat flag for multiple.",
    )
    parser.add_argument(
        "--subinterest-id",
        action="append",
        default=[],
        help="Filter to one or more subinterests. Repeat flag for multiple.",
    )
    return parser.parse_args()


def _source_days(args: argparse.Namespace, source_type: str) -> int:
    source = (source_type or "").lower()
    if source == "rss":
        return args.days_rss
    if source == "atom":
        return args.days_atom
    if source == "html":
        return args.days_html
    if source == "sitemap":
        return args.days_sitemap
    return args.default_days


def _parse_iso(value: str) -> datetime | None:
    text = (value or "").strip()
    if not text:
        return None
    try:
        dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _is_fresh(timestamp_value: str, ttl_days: int) -> bool:
    ts = _parse_iso(timestamp_value)
    if ts is None:
        return False
    cutoff = datetime.now(timezone.utc) - timedelta(days=max(0, ttl_days))
    return ts >= cutoff


def _content_hash(text: str) -> str:
    if not text:
        return ""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:24]


def _is_recent(published: str, days: int) -> bool:
    dt = _parse_iso(published)
    if dt is None:
        return False
    cutoff = datetime.now(timezone.utc) - timedelta(days=max(0, days))
    return dt >= cutoff


def _clean_text(text: str) -> str:
    text = re.sub(r"\n{3,}", "\n\n", text or "")
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text.strip()


def _extract_text_from_html(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup.find_all(
        [
            "script",
            "style",
            "nav",
            "footer",
            "header",
            "aside",
            "noscript",
            "iframe",
            "form",
            "button",
            "svg",
        ]
    ):
        tag.decompose()

    main = None
    for selector in (
        "article",
        "main",
        "[role='main']",
        ".post-content",
        ".article-content",
        ".entry-content",
        ".content",
        "#content",
    ):
        main = soup.select_one(selector)
        if main:
            break

    root = main or soup.body or soup
    blocks = [
        node.get_text(" ", strip=True)
        for node in root.find_all(["p", "li"])
    ]
    if blocks:
        return _clean_text("\n\n".join(b for b in blocks if b))
    return _clean_text(root.get_text(" ", strip=True))


def _fetch_article_content(url: str, timeout: int) -> dict[str, Any]:
    result = {
        "content": "",
        "content_length": 0,
        "is_paywalled": False,
        "fetch_error": "",
        "http_status": 0,
    }
    try:
        response = requests.get(
            url,
            timeout=timeout,
            headers={
                "User-Agent": "TracePoolRefresher/1.0 (+https://trace.app)",
            },
        )
        result["http_status"] = response.status_code
        response.raise_for_status()
    except Exception as exc:
        result["fetch_error"] = str(exc)
        return result

    html = response.text or ""
    content = _extract_text_from_html(html)
    if not content:
        result["fetch_error"] = "empty_extracted_content"
        return result

    lower = f"{html}\n{content}".lower()
    result["is_paywalled"] = any(
        marker in lower for marker in PAYWALL_INDICATORS
    )
    result["content"] = content
    result["content_length"] = len(content)
    return result


def _parse_json_object(raw_text: str) -> tuple[dict[str, Any] | None, str]:
    cleaned = (raw_text or "").strip()
    if not cleaned:
        return None, "empty_response"
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        cleaned = cleaned.replace("json", "", 1).strip()
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if not match:
            return None, "no_json_object_found"
        try:
            parsed = json.loads(match.group())
        except json.JSONDecodeError as exc:
            return None, f"json_parse_error:{exc}"
    if not isinstance(parsed, dict):
        return None, "response_not_object"
    if "short_article" not in parsed:
        return None, "missing_short_article"
    return parsed, ""


def _summarize_article(
    client: OpenAI | None,
    model: str,
    temperature: float,
    timeout_seconds: int,
    skill_level: str,
    interest_id: str,
    subinterest_id: str,
    title: str,
    url: str,
    content: str,
) -> tuple[dict[str, Any], str]:
    if client is None:
        return {}, "openai_not_configured"

    prompt = get_prompt_for_skill_level(
        skill_level=skill_level,
        title=title,
        content=content,
        user_context={
            "interests": [interest_id],
            "subinterests": [subinterest_id],
            "skills": [],
            "content_depth": "high",
        },
        url=url,
        is_video=False,
    )
    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You return valid JSON only. "
                        "No markdown fences."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            temperature=temperature,
            response_format={"type": "json_object"},
            timeout=timeout_seconds,
        )
    except Exception as exc:
        return {}, f"openai_error:{exc}"

    raw = (response.choices[0].message.content or "").strip()
    parsed, error = _parse_json_object(raw)
    if not parsed:
        return {}, error
    return parsed, ""


def _doc_id_for_url(url: str) -> str:
    return hashlib.sha256(url.encode("utf-8")).hexdigest()[:40]


def _passes_filters(
    src: dict[str, Any],
    allow_interest_ids: set[str],
    allow_subinterest_ids: set[str],
) -> bool:
    if allow_interest_ids and src.get("interest_id") not in allow_interest_ids:
        return False
    if (
        allow_subinterest_ids
        and src.get("subinterest_id") not in allow_subinterest_ids
    ):
        return False
    return True


def refresh_article_pool_firestore(args: argparse.Namespace) -> dict[str, Any]:
    _log("Starting pool refresh")
    store = FirestoreStore()
    config_path = (REPO_ROOT / args.sources_config).resolve()
    config = json.loads(config_path.read_text(encoding="utf-8"))
    validated_sources = config.get("validated_sources", [])
    _log(f"Validated sources loaded: {len(validated_sources)}")

    openai_key = os.getenv("OPENAI_API_KEY", "").strip()
    openai_client = OpenAI(api_key=openai_key) if openai_key else None
    if openai_client is None:
        _log("OPENAI_API_KEY not found; summaries will be skipped")

    allow_interest_ids = set(args.interest_id)
    allow_subinterest_ids = set(args.subinterest_id)
    if allow_interest_ids:
        _log(f"Interest filter: {sorted(list(allow_interest_ids))}")
    if allow_subinterest_ids:
        _log(f"Subinterest filter: {sorted(list(allow_subinterest_ids))}")
    now_iso = datetime.now(timezone.utc).isoformat()

    sources_processed = 0
    sources_failed = 0
    pool_upserts = 0
    content_failures = 0
    summary_failures = 0
    content_fetch_attempted = 0
    content_fetch_skipped_cached = 0
    summary_attempted = 0
    summary_skipped_cached = 0

    for src in validated_sources:
        if not _passes_filters(src, allow_interest_ids, allow_subinterest_ids):
            continue

        sources_processed += 1
        interest_id = src.get("interest_id", "")
        subinterest_id = src.get("subinterest_id", "")
        source_name = src.get("source_name", "")
        source_url = src.get("source_url", "")
        configured_source_type = src.get("source_type", "")
        _log(
            f"Source start: {source_name} | "
            f"{interest_id}/{subinterest_id} | {source_url}"
        )

        try:
            extracted = fetch_article_links(
                source_url=source_url,
                limit=args.limit_per_source,
                include_external=False,
                enrich_metadata=False,
            )
        except Exception:
            sources_failed += 1
            _log(f"Source failed: {source_name}")
            continue

        days_window = _source_days(
            args,
            extracted.source_type or configured_source_type,
        )
        _log(
            f"Source parsed: {source_name} | "
            f"type={extracted.source_type} | "
            f"candidates={len(extracted.articles)} | days_window={days_window}"
        )
        source_upserts = 0
        source_recent_candidates = 0
        source_content_fetch_attempted = 0
        source_content_fetch_skipped = 0
        source_summary_attempted = 0
        source_summary_skipped = 0

        for idx, article in enumerate(extracted.articles, start=1):
            published_date = article.get("published_date", "")
            if not _is_recent(published_date, days_window):
                continue
            source_recent_candidates += 1

            url = article.get("url", "")
            if not url:
                continue
            title = article.get("title", "")
            og_image = article.get("og_image", "")
            _log(
                f"Source article {idx}/{len(extracted.articles)}: "
                f"{source_name} | title={title[:80]}"
            )

            doc_id = _doc_id_for_url(url)
            doc_ref = store.db.collection(POOL_COLLECTION).document(doc_id)
            existing = doc_ref.get()
            existing_data = existing.to_dict() if existing.exists else {}
            if not isinstance(existing_data, dict):
                existing_data = {}

            created_at = existing_data.get("created_at", now_iso)
            existing_content = existing_data.get("content", "") or ""
            existing_content_fetched_at = (
                existing_data.get("content_fetched_at", "") or ""
            )
            existing_summary = existing_data.get("summary", {}) or {}
            if not isinstance(existing_summary, dict):
                existing_summary = {}
            existing_summary_error = (
                existing_data.get("summary_error", "") or ""
            )
            existing_summary_generated_at = (
                existing_data.get("summary_generated_at", "") or ""
            )
            existing_summary_content_hash = (
                existing_data.get("summary_content_hash", "") or ""
            )
            existing_content_hash = (
                existing_data.get("content_hash", "") or ""
            )

            use_cached_content = (
                bool(existing_content)
                and not args.force_refresh
                and _is_fresh(
                    existing_content_fetched_at,
                    args.content_ttl_days,
                )
            )

            if use_cached_content:
                content_info = {
                    "content": existing_content,
                    "content_length": existing_data.get("content_length", 0) or 0,
                    "is_paywalled": existing_data.get("is_paywalled", False),
                    "fetch_error": existing_data.get("fetch_error", "") or "",
                    "http_status": existing_data.get("http_status", 200) or 200,
                }
                content_fetch_skipped_cached += 1
                source_content_fetch_skipped += 1
                _log(
                    f"Article content cache hit | source={source_name} | "
                    f"url={url}"
                )
            else:
                content_fetch_attempted += 1
                source_content_fetch_attempted += 1
                _log(
                    f"Article content fetch start | source={source_name} | "
                    f"url={url}"
                )
                content_info = _fetch_article_content(
                    url,
                    timeout=args.http_timeout,
                )
                if content_info["fetch_error"]:
                    content_failures += 1
                    _log(
                        f"Article content fetch failed | source={source_name} | "
                        f"url={url} | error={content_info['fetch_error'][:120]}"
                    )

            summary_payload: dict[str, Any] = {}
            summary_error = ""
            summary_generated_at = existing_summary_generated_at
            content_fetched_at = (
                existing_content_fetched_at if use_cached_content else now_iso
            )
            content_hash = (
                existing_content_hash if use_cached_content else ""
            )

            if content_info["content"]:
                if not content_hash:
                    content_hash = _content_hash(content_info["content"])
                can_reuse_summary = (
                    bool(existing_summary)
                    and not existing_summary_error
                    and not args.force_refresh
                    and _is_fresh(
                        existing_summary_generated_at,
                        args.summary_ttl_days,
                    )
                    and existing_summary_content_hash == content_hash
                )
                if can_reuse_summary:
                    summary_payload = existing_summary
                    summary_error = ""
                    summary_generated_at = existing_summary_generated_at
                    summary_skipped_cached += 1
                    source_summary_skipped += 1
                    _log(
                        f"Article summary cache hit | source={source_name} | "
                        f"url={url}"
                    )
                else:
                    summary_attempted += 1
                    source_summary_attempted += 1
                    _log(
                        f"Article summary start | source={source_name} | "
                        f"url={url}"
                    )
                    summary_payload, summary_error = _summarize_article(
                        client=openai_client,
                        model=args.summary_model,
                        temperature=args.summary_temperature,
                        timeout_seconds=args.summary_timeout_seconds,
                        skill_level=args.summary_skill_level,
                        interest_id=interest_id,
                        subinterest_id=subinterest_id,
                        title=title,
                        url=url,
                        content=content_info["content"],
                    )
                    summary_generated_at = now_iso
                    if summary_error:
                        summary_failures += 1
                        _log(
                            f"Article summary failed | source={source_name} | "
                            f"url={url} | error={summary_error[:120]}"
                        )
                        if existing_summary and not args.force_refresh:
                            summary_payload = existing_summary
                            summary_error = ""
                            summary_generated_at = existing_summary_generated_at
                    else:
                        _log(
                            f"Article summary success | source={source_name} | "
                            f"url={url}"
                        )

            payload = {
                "doc_id": doc_id,
                "url": url,
                "title": title,
                "interest_id": interest_id,
                "subinterest_id": subinterest_id,
                "source_name": source_name,
                "source_url": source_url,
                "source_type": extracted.source_type or configured_source_type,
                "published_date": published_date,
                "og_image": og_image,
                "content": content_info["content"],
                "content_length": content_info["content_length"],
                "is_paywalled": content_info["is_paywalled"],
                "fetch_error": content_info["fetch_error"],
                "http_status": content_info["http_status"],
                "content_fetched_at": content_fetched_at,
                "content_hash": content_hash,
                "summary": summary_payload,
                "summary_error": summary_error,
                "summary_model": args.summary_model,
                "summary_skill_level": args.summary_skill_level,
                "summary_generated_at": summary_generated_at,
                "summary_content_hash": content_hash if summary_payload else "",
                "created_at": created_at,
                "last_seen_at": now_iso,
                "updated_at": now_iso,
                "is_active": True,
            }
            doc_ref.set(payload, merge=True)
            pool_upserts += 1
            source_upserts += 1
        _log(
            f"Source complete: {source_name} | "
            f"recent_candidates={source_recent_candidates} | "
            f"upserts={source_upserts} | "
            f"content_fetch_attempted={source_content_fetch_attempted} | "
            f"content_fetch_cache_hits={source_content_fetch_skipped} | "
            f"summary_attempted={source_summary_attempted} | "
            f"summary_cache_hits={source_summary_skipped}"
        )

    cleanup_cutoff = datetime.now(timezone.utc) - timedelta(
        days=args.retention_days
    )
    stale_updates = 0
    for doc in (
        store.db.collection(POOL_COLLECTION)
        .where("is_active", "==", True)
        .stream()
    ):
        data = doc.to_dict() or {}
        candidate_time = (
            data.get("published_date")
            or data.get("last_seen_at")
            or ""
        )
        dt = _parse_iso(candidate_time)
        if dt is None or dt >= cleanup_cutoff:
            continue
        doc.reference.update(
            {
                "is_active": False,
                "deactivated_at": now_iso,
                "deactivated_reason": "retention_expired",
            }
        )
        stale_updates += 1

    store.db.collection(RUNS_COLLECTION).document("pool_refresh").set(
        {
            "last_run_at": now_iso,
            "status": "success",
            "sources_processed": sources_processed,
            "sources_failed": sources_failed,
            "pool_upserts": pool_upserts,
            "content_failures": content_failures,
            "summary_failures": summary_failures,
            "content_fetch_attempted": content_fetch_attempted,
            "content_fetch_cache_hits": content_fetch_skipped_cached,
            "summary_attempted": summary_attempted,
            "summary_cache_hits": summary_skipped_cached,
            "retention_days": args.retention_days,
            "summary_skill_level": args.summary_skill_level,
            "content_ttl_days": args.content_ttl_days,
            "summary_ttl_days": args.summary_ttl_days,
        },
        merge=True,
    )
    _log(
        "Pool refresh complete: "
        f"sources_processed={sources_processed}, "
        f"sources_failed={sources_failed}, "
        f"pool_upserts={pool_upserts}, "
        f"content_failures={content_failures}, "
        f"summary_failures={summary_failures}, "
        f"content_fetch_attempted={content_fetch_attempted}, "
        f"content_fetch_cache_hits={content_fetch_skipped_cached}, "
        f"summary_attempted={summary_attempted}, "
        f"summary_cache_hits={summary_skipped_cached}, "
        f"stale_deactivated={stale_updates}"
    )

    return {
        "sources_processed": sources_processed,
        "sources_failed": sources_failed,
        "pool_upserts": pool_upserts,
        "content_failures": content_failures,
        "summary_failures": summary_failures,
        "content_fetch_attempted": content_fetch_attempted,
        "content_fetch_cache_hits": content_fetch_skipped_cached,
        "summary_attempted": summary_attempted,
        "summary_cache_hits": summary_skipped_cached,
        "deactivated_stale_items": stale_updates,
    }


def main() -> None:
    args = _parse_args()
    result = refresh_article_pool_firestore(args)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
