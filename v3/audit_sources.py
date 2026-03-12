#!/usr/bin/env python3
"""
Audit source quality before adding or changing feed configs.

Checks three things for each source:
1. Can we fetch article links from the source URL?
2. Can we fetch usable article content from sampled links?
3. How many links can we currently fetch from the source?

Usage:
  python3 -m v3.audit_sources --config v3/config/for_you_sources.json
  python3 -m v3.audit_sources --config v3/config/trending_sources.json --source "OpenAI News"
  python3 -m v3.audit_sources --config v3/config/for_you_sources.json --limit 30 --sample-articles 5 --json
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from v2.utils.fetch_article_links import fetch_article_links  # noqa: E402
from v3.lib.content import fetch_content  # noqa: E402

DEFAULT_LIMIT = 25
DEFAULT_SAMPLE_ARTICLES = 4
GOOD_CONTENT_LENGTH = 500
STRONG_CONTENT_LENGTH = 1200


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Audit feed sources.")
    parser.add_argument(
        "--config",
        required=True,
        help="Path to source config JSON",
    )
    parser.add_argument(
        "--source",
        action="append",
        default=[],
        help="Optional source name filter. Repeat for multiple sources.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=DEFAULT_LIMIT,
        help=f"Max links to fetch per source (default: {DEFAULT_LIMIT})",
    )
    parser.add_argument(
        "--sample-articles",
        type=int,
        default=DEFAULT_SAMPLE_ARTICLES,
        help=(
            "How many fetched links to test for content quality "
            f"(default: {DEFAULT_SAMPLE_ARTICLES})"
        ),
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output JSON instead of readable text.",
    )
    return parser.parse_args()


def _load_sources(config_path: str, source_names: set[str]) -> list[dict[str, Any]]:
    with open(REPO_ROOT / config_path, "r", encoding="utf-8") as handle:
        config = json.load(handle)

    sources = config.get("sources", [])
    if not source_names:
        return sources

    wanted = {name.strip().lower() for name in source_names if name.strip()}
    return [
        source
        for source in sources
        if str(source.get("name", "")).strip().lower() in wanted
    ]


def _content_grade(length: int) -> str:
    if length >= STRONG_CONTENT_LENGTH:
        return "strong"
    if length >= GOOD_CONTENT_LENGTH:
        return "good"
    if length >= 200:
        return "weak"
    return "empty"


def _audit_source(
    source: dict[str, Any],
    limit: int,
    sample_articles: int,
) -> dict[str, Any]:
    name = str(source.get("name", "")).strip()
    url = str(source.get("url", "")).strip()
    interest_id = str(source.get("interest_id", "")).strip()
    result: dict[str, Any] = {
        "name": name,
        "url": url,
        "interest_id": interest_id,
        "status": "ok",
        "fetch_error": "",
        "source_type_detected": "",
        "links_found": 0,
        "sampled_articles": 0,
        "usable_articles": 0,
        "good_articles": 0,
        "strong_articles": 0,
        "avg_content_length": 0,
        "median_content_length": 0,
        "sample_titles": [],
        "sample_urls": [],
        "content_samples": [],
    }

    try:
        extracted = fetch_article_links(url, limit=limit, enrich_metadata=True)
    except Exception as exc:
        result["status"] = "fetch_failed"
        result["fetch_error"] = str(exc)
        return result

    articles = extracted.articles if hasattr(extracted, "articles") else []
    result["source_type_detected"] = getattr(extracted, "source_type", "")
    result["links_found"] = len(articles)
    result["sample_titles"] = [
        (article.title if hasattr(article, "title") else article.get("title", ""))[:160]
        for article in articles[:5]
    ]
    result["sample_urls"] = [
        article.url if hasattr(article, "url") else article.get("url", "")
        for article in articles[:5]
    ]

    sampled = articles[: max(0, sample_articles)]
    content_lengths: list[int] = []

    for article in sampled:
        article_url = article.url if hasattr(article, "url") else article.get("url", "")
        title = article.title if hasattr(article, "title") else article.get("title", "")
        if not article_url:
            continue

        content = fetch_content(article_url)
        text = str(content.get("content", ""))
        length = len(text)
        grade = _content_grade(length)

        result["sampled_articles"] += 1
        if length >= 200:
            result["usable_articles"] += 1
        if grade in {"good", "strong"}:
            result["good_articles"] += 1
        if grade == "strong":
            result["strong_articles"] += 1
        content_lengths.append(length)
        result["content_samples"].append(
            {
                "title": title[:160],
                "url": article_url,
                "content_source": content.get("source", ""),
                "content_length": length,
                "grade": grade,
            }
        )

    if content_lengths:
        result["avg_content_length"] = round(statistics.mean(content_lengths))
        result["median_content_length"] = int(statistics.median(content_lengths))

    return result


def _print_human(results: list[dict[str, Any]]) -> None:
    for result in results:
        print("")
        print(f"{result['name']} [{result['interest_id']}]")
        print(f"  url: {result['url']}")
        print(f"  status: {result['status']}")
        if result["fetch_error"]:
            print(f"  fetch_error: {result['fetch_error']}")
            continue
        print(f"  detected_type: {result['source_type_detected']}")
        print(f"  links_found: {result['links_found']}")
        print(
            "  content_quality: "
            f"{result['usable_articles']}/{result['sampled_articles']} usable, "
            f"{result['good_articles']} good, {result['strong_articles']} strong"
        )
        print(
            "  content_lengths: "
            f"avg={result['avg_content_length']} "
            f"median={result['median_content_length']}"
        )
        if result["sample_titles"]:
            print("  recent_titles:")
            for title in result["sample_titles"]:
                print(f"    - {title}")
        if result["content_samples"]:
            print("  sampled_articles:")
            for sample in result["content_samples"]:
                print(
                    "    - "
                    f"{sample['grade']} "
                    f"len={sample['content_length']} "
                    f"via={sample['content_source']} "
                    f"{sample['title']}"
                )


def main() -> None:
    args = _parse_args()
    sources = _load_sources(args.config, set(args.source))
    results = [
        _audit_source(source, args.limit, args.sample_articles)
        for source in sources
    ]
    if args.json:
        print(json.dumps(results, indent=2))
        return
    _print_human(results)


if __name__ == "__main__":
    main()
