#!/usr/bin/env python3
"""
Build a recent-article index from validated interest sources.

Reads validated sources from:
  v2/config/interest_source_links.json

Fetches article links via:
  v2/utils/fetch_article_links.py

Writes grouped output by:
  interest_id -> subinterest_id -> source
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from v2.utils.fetch_article_links import fetch_article_links  # noqa: E402


@dataclass
class SourceRunResult:
    interest_id: str
    subinterest_id: str
    source_name: str
    source_url: str
    configured_source_type: str
    detected_source_type: str
    days_window: int
    articles: list[dict[str, str]]
    skipped_undated_count: int
    skipped_old_count: int
    error: str = ""


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Fetch recent articles from validated sources and save "
            "grouped JSON output."
        )
    )
    parser.add_argument(
        "--sources-config",
        default="v2/config/interest_source_links.json",
        help="Path to source registry JSON.",
    )
    parser.add_argument(
        "--out",
        default="v2/output/recent_source_articles.json",
        help="Path to write grouped output JSON.",
    )
    parser.add_argument(
        "--limit-per-source",
        type=int,
        default=5,
        help=(
            "Max candidate article links fetched per source "
            "before date filtering."
        ),
    )
    parser.add_argument(
        "--days-rss",
        type=int,
        default=7,
        help="Recency window in days for RSS sources.",
    )
    parser.add_argument(
        "--days-atom",
        type=int,
        default=7,
        help="Recency window in days for Atom sources.",
    )
    parser.add_argument(
        "--days-html",
        type=int,
        default=14,
        help="Recency window in days for HTML sources.",
    )
    parser.add_argument(
        "--days-sitemap",
        type=int,
        default=14,
        help="Recency window in days for sitemap sources.",
    )
    parser.add_argument(
        "--default-days",
        type=int,
        default=14,
        help="Fallback recency window if source type is unknown.",
    )
    parser.add_argument(
        "--include-undated",
        action="store_true",
        help="Include items without published_date (excluded by default).",
    )
    parser.add_argument(
        "--enrich-metadata",
        action="store_true",
        help=(
            "Enrich each article by fetching page metadata "
            "for missing date/image/title."
        ),
    )
    parser.add_argument(
        "--interest-id",
        action="append",
        default=[],
        help="Filter to one or more interest IDs. Repeat flag for multiple.",
    )
    parser.add_argument(
        "--subinterest-id",
        action="append",
        default=[],
        help=(
            "Filter to one or more subinterest IDs. "
            "Repeat flag for multiple."
        ),
    )
    return parser.parse_args()


def _load_validated_sources(path: Path) -> list[dict[str, Any]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    return data.get("validated_sources", [])


def _source_type_window(args: argparse.Namespace, source_type: str) -> int:
    key = (source_type or "").lower()
    if key == "rss":
        return args.days_rss
    if key == "atom":
        return args.days_atom
    if key == "html":
        return args.days_html
    if key == "sitemap":
        return args.days_sitemap
    return args.default_days


def _parse_iso_utc(value: str) -> datetime | None:
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


def _filter_recent_articles(
    articles: list[dict[str, str]],
    days_window: int,
    include_undated: bool,
) -> tuple[list[dict[str, str]], int, int]:
    now_utc = datetime.now(timezone.utc)
    cutoff = now_utc - timedelta(days=max(0, days_window))
    kept: list[dict[str, str]] = []
    skipped_undated = 0
    skipped_old = 0

    for article in articles:
        published_raw = article.get("published_date", "")
        published = _parse_iso_utc(published_raw)
        if published is None:
            if include_undated:
                kept.append(article)
            else:
                skipped_undated += 1
            continue
        if published < cutoff:
            skipped_old += 1
            continue
        kept.append(article)
    return kept, skipped_undated, skipped_old


def _passes_filters(
    source: dict[str, Any],
    allow_interest_ids: set[str],
    allow_subinterest_ids: set[str],
) -> bool:
    if (
        allow_interest_ids
        and source.get("interest_id") not in allow_interest_ids
    ):
        return False
    if (
        allow_subinterest_ids
        and source.get("subinterest_id") not in allow_subinterest_ids
    ):
        return False
    return True


def main() -> None:
    args = _parse_args()
    source_path = (REPO_ROOT / args.sources_config).resolve()
    out_path = (REPO_ROOT / args.out).resolve()

    sources = _load_validated_sources(source_path)
    allow_interest_ids = set(args.interest_id)
    allow_subinterest_ids = set(args.subinterest_id)

    run_results: list[SourceRunResult] = []

    for source in sources:
        if not _passes_filters(
            source,
            allow_interest_ids,
            allow_subinterest_ids,
        ):
            continue

        interest_id = source.get("interest_id", "")
        subinterest_id = source.get("subinterest_id", "")
        source_name = source.get("source_name", "")
        source_url = source.get("source_url", "")
        configured_type = source.get("source_type", "")

        try:
            fetched = fetch_article_links(
                source_url=source_url,
                limit=args.limit_per_source,
                include_external=False,
                enrich_metadata=args.enrich_metadata,
            )
            days_window = _source_type_window(
                args,
                fetched.source_type or configured_type,
            )
            recent_articles, skipped_undated, skipped_old = (
                _filter_recent_articles(
                fetched.articles,
                days_window=days_window,
                include_undated=args.include_undated,
            )
            )
            run_results.append(
                SourceRunResult(
                    interest_id=interest_id,
                    subinterest_id=subinterest_id,
                    source_name=source_name,
                    source_url=source_url,
                    configured_source_type=configured_type,
                    detected_source_type=fetched.source_type,
                    days_window=days_window,
                    articles=recent_articles,
                    skipped_undated_count=skipped_undated,
                    skipped_old_count=skipped_old,
                )
            )
        except Exception as exc:
            run_results.append(
                SourceRunResult(
                    interest_id=interest_id,
                    subinterest_id=subinterest_id,
                    source_name=source_name,
                    source_url=source_url,
                    configured_source_type=configured_type,
                    detected_source_type="unknown",
                    days_window=_source_type_window(args, configured_type),
                    articles=[],
                    skipped_undated_count=0,
                    skipped_old_count=0,
                    error=str(exc),
                )
            )

    grouped: dict[str, dict[str, list[dict[str, Any]]]] = defaultdict(
        lambda: defaultdict(list)
    )
    total_articles = 0
    total_errors = 0

    for result in run_results:
        item = {
            "source_name": result.source_name,
            "source_url": result.source_url,
            "configured_source_type": result.configured_source_type,
            "detected_source_type": result.detected_source_type,
            "days_window": result.days_window,
            "article_count": len(result.articles),
            "skipped_undated_count": result.skipped_undated_count,
            "skipped_old_count": result.skipped_old_count,
            "error": result.error,
            "articles": result.articles,
        }
        grouped[result.interest_id][result.subinterest_id].append(item)
        total_articles += len(result.articles)
        if result.error:
            total_errors += 1

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "config_path": str(source_path),
        "filters": {
            "interest_ids": sorted(allow_interest_ids),
            "subinterest_ids": sorted(allow_subinterest_ids),
        },
        "settings": {
            "limit_per_source": args.limit_per_source,
            "include_undated": args.include_undated,
            "enrich_metadata": args.enrich_metadata,
            "days_by_type": {
                "rss": args.days_rss,
                "atom": args.days_atom,
                "html": args.days_html,
                "sitemap": args.days_sitemap,
                "default": args.default_days,
            },
        },
        "stats": {
            "sources_processed": len(run_results),
            "sources_with_errors": total_errors,
            "total_articles_kept": total_articles,
        },
        "grouped_articles": grouped,
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(
        json.dumps(
            {
                "out": str(out_path),
                "sources_processed": len(run_results),
                "sources_with_errors": total_errors,
                "total_articles_kept": total_articles,
            }
        )
    )


if __name__ == "__main__":
    main()
