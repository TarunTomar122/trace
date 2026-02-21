#!/usr/bin/env python3
"""
Build a learning article pool from curated educational sources.

Reuses the same content-fetch and summarization infra as the main pool
but targets a separate Firestore collection (learning_pool) with a
much longer recency window (default 60 days).

Articles are tagged by interest_id / subinterest_id so they can be
matched to individual users during feed generation.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from openai import OpenAI

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
load_dotenv(REPO_ROOT / ".env")

from v1.storage import FirestoreStore  # noqa: E402
from v1.tools.summary_prompts import get_prompt_for_skill_level  # noqa: E402
from v2.utils.fetch_article_links import fetch_article_links  # noqa: E402
from v2.flows.refresh_article_pool_firestore import (  # noqa: E402
    _fetch_article_content_with_exa_fallback,
    _parse_json_object,
    _is_recent,
    _is_fresh,
    _content_hash,
)  # noqa: E402

COLLECTION = "learning_pool"
DEFAULT_CONFIG = "v2/config/learning_source_links.json"


def _log(msg: str) -> None:
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{stamp}] [learning-pool] {msg}")


def _doc_id(url: str) -> str:
    return hashlib.sha256(url.encode("utf-8")).hexdigest()[:40]


def _summarize(
    client: OpenAI | None,
    model: str,
    temperature: float,
    timeout: int,
    skill_level: str,
    interest_id: str,
    subinterest_id: str,
    title: str,
    url: str,
    content: str,
) -> tuple[dict[str, Any], str]:
    if client is None:
        return {}, "openai_not_configured"
    ctx = {
        "interests": [interest_id],
        "subinterests": [subinterest_id],
        "skills": [],
        "content_depth": "high",
    }
    prompt = get_prompt_for_skill_level(
        skill_level=skill_level,
        title=title,
        content=content,
        user_context=ctx,
        url=url,
        is_video=False,
    )
    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You return valid JSON only. No markdown fences."},
                {"role": "user", "content": prompt},
            ],
            temperature=temperature,
            response_format={"type": "json_object"},
            timeout=timeout,
        )
    except Exception as exc:
        return {}, f"openai_error:{exc}"
    raw = (resp.choices[0].message.content or "").strip()
    parsed, error = _parse_json_object(raw)
    if not parsed:
        return {}, error
    return parsed, ""


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Build learning article pool.")
    p.add_argument("--config", default=DEFAULT_CONFIG)
    p.add_argument(
        "--limit-per-source", type=int, default=5,
    )
    p.add_argument(
        "--max-age-days", type=int, default=60,
    )
    p.add_argument(
        "--retention-days", type=int, default=90,
    )
    p.add_argument(
        "--content-ttl-days", type=int, default=7,
    )
    p.add_argument(
        "--summary-ttl-days", type=int, default=30,
    )
    p.add_argument("--summary-model", default="gpt-4o-mini")
    p.add_argument(
        "--summary-skill-level", default="intermediate",
    )
    p.add_argument(
        "--summary-temperature", type=float, default=0.3,
    )
    p.add_argument(
        "--summary-timeout", type=int, default=60,
    )
    p.add_argument("--http-timeout", type=int, default=25)
    p.add_argument("--force", action="store_true")
    return p.parse_args()


def build_learning_pool(args: argparse.Namespace | None = None) -> dict[str, Any]:
    if args is None:
        args = _parse_args()

    _log("Starting learning pool build")
    store = FirestoreStore()
    config_path = (REPO_ROOT / args.config).resolve()
    config = json.loads(config_path.read_text(encoding="utf-8"))
    sources = config.get("validated_sources", [])
    max_age = (
        getattr(args, "max_age_days", None)
        or config.get("max_age_days", 60)
    )
    _log(f"Sources: {len(sources)}, max_age_days: {max_age}")

    openai_key = os.getenv("OPENAI_API_KEY", "").strip()
    client = OpenAI(api_key=openai_key) if openai_key else None
    exa_key = os.getenv("EXA_API_KEY", "").strip()
    now_iso = datetime.now(timezone.utc).isoformat()

    stats = {
        "sources_processed": 0,
        "sources_failed": 0,
        "articles_upserted": 0,
        "content_fetched": 0,
        "content_cached": 0,
        "summaries_generated": 0,
        "summaries_cached": 0,
        "content_failures": 0,
        "summary_failures": 0,
    }

    for src in sources:
        stats["sources_processed"] += 1
        interest_id = src.get("interest_id", "")
        subinterest_id = src.get("subinterest_id", "")
        name = src.get("source_name", "")
        url = src.get("source_url", "")
        _log(f"Source: {name} ({interest_id}/{subinterest_id})")

        try:
            extracted = fetch_article_links(
                source_url=url,
                limit=args.limit_per_source,
                include_external=False,
                enrich_metadata=False,
            )
        except Exception:
            stats["sources_failed"] += 1
            _log(f"  FAILED to fetch links from {name}")
            continue

        _log(f"  Candidates: {len(extracted.articles)}")

        for article in extracted.articles:
            pub = article.get("published_date", "")
            art_url = article.get("url", "")
            title = article.get("title", "")
            if not art_url or not title:
                continue

            if pub and not _is_recent(pub, max_age):
                continue

            doc_id = _doc_id(art_url)
            doc_ref = store.db.collection(COLLECTION).document(doc_id)
            existing = doc_ref.get()
            existing_data = existing.to_dict() if existing.exists else {}
            if not isinstance(existing_data, dict):
                existing_data = {}

            use_cached_content = (
                not args.force
                and existing_data.get("content")
                and _is_fresh(
                    existing_data.get("content_fetched_at", ""),
                    args.content_ttl_days,
                )
            )

            exa_image = ""
            if use_cached_content:
                content = existing_data["content"]
                content_source = "cached"
                stats["content_cached"] += 1
            else:
                info, content_source = _fetch_article_content_with_exa_fallback(
                    url=art_url,
                    timeout=args.http_timeout,
                    exa_api_key=exa_key,
                )
                content = info.get("content", "")
                exa_image = (info.get("image") or "").strip()
                if not content:
                    stats["content_failures"] += 1
                    continue
                stats["content_fetched"] += 1

            c_hash = _content_hash(content)
            use_cached_summary = (
                not args.force
                and existing_data.get("summary")
                and isinstance(existing_data.get("summary"), dict)
                and existing_data["summary"].get("short_article")
                and _is_fresh(
                    existing_data.get("summary_generated_at", ""),
                    args.summary_ttl_days,
                )
                and existing_data.get("content_hash") == c_hash
            )

            if use_cached_summary:
                summary = existing_data["summary"]
                stats["summaries_cached"] += 1
            else:
                summary, err = _summarize(
                    client=client,
                    model=args.summary_model,
                    temperature=args.summary_temperature,
                    timeout=args.summary_timeout,
                    skill_level=args.summary_skill_level,
                    interest_id=interest_id,
                    subinterest_id=subinterest_id,
                    title=title,
                    url=art_url,
                    content=content,
                )
                if not summary:
                    stats["summary_failures"] += 1
                    _log(f"  Summary failed: {title[:60]} ({err})")
                    continue
                stats["summaries_generated"] += 1

            og_image = article.get("og_image", "")
            if not og_image and exa_image:
                og_image = exa_image

            payload: dict[str, Any] = {
                "url": art_url,
                "title": title,
                "interest_id": interest_id,
                "subinterest_id": subinterest_id,
                "source_name": name,
                "published_date": pub,
                "og_image": og_image,
                "content": content,
                "content_length": len(content),
                "content_hash": c_hash,
                "content_fetched_at": (
                    now_iso if not use_cached_content
                    else existing_data.get(
                        "content_fetched_at", now_iso,
                    )
                ),
                "content_source": content_source,
                "summary": summary,
                "summary_generated_at": (
                    now_iso if not use_cached_summary
                    else existing_data.get(
                        "summary_generated_at", now_iso,
                    )
                ),
                "feed_category": "learn",
                "updated_at": now_iso,
            }
            if not existing_data:
                payload["created_at"] = now_iso

            doc_ref.set(payload, merge=True)
            stats["articles_upserted"] += 1
            _log(f"  Upserted: {title[:70]}")

    # Cleanup old items beyond retention window
    cutoff = datetime.now(timezone.utc) - timedelta(days=args.retention_days)
    cutoff_iso = cutoff.isoformat()
    stale = (
        store.db.collection(COLLECTION)
        .where("updated_at", "<", cutoff_iso)
        .stream()
    )
    deleted = 0
    for doc in stale:
        doc.reference.delete()
        deleted += 1
    if deleted:
        _log(f"Cleaned up {deleted} stale items (>{args.retention_days}d)")

    stats["stale_deleted"] = deleted

    store.db.collection("pipeline_runs_v2").document("learning_pool").set({
        "last_run_at": now_iso,
        "status": "success",
        "articles_upserted": stats["articles_upserted"],
        "sources_processed": stats["sources_processed"],
    })

    _log(f"Done. {json.dumps(stats, indent=2)}")
    return stats


def main() -> None:
    args = _parse_args()
    result = build_learning_pool(args)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
