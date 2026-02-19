#!/usr/bin/env python3
"""
Fetch full article content for entries in a recent-article index JSON.

Input shape:
  Produced by v2/scripts/build_recent_source_article_index.py

Output:
  Same grouped shape, with per-article content fetch fields added:
    - content
    - content_length
    - is_paywalled
    - fetch_error
    - http_status
"""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests
from bs4 import BeautifulSoup

USER_AGENT = "TraceContentFetcher/1.0 (+https://trace.app)"
DEFAULT_TIMEOUT_SECONDS = 25

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

DROP_TAGS = (
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
)

MAIN_SELECTORS = (
    "article",
    "main",
    "[role='main']",
    ".post-content",
    ".article-content",
    ".entry-content",
    ".content",
    "#content",
)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Fetch full article content for grouped "
            "recent-article index entries."
        )
    )
    parser.add_argument(
        "--input",
        default="v2/output/recent_source_articles.json",
        help="Input index JSON from build_recent_source_article_index.py",
    )
    parser.add_argument(
        "--out",
        default="v2/output/recent_source_articles_with_content.json",
        help="Output JSON path with fetched content attached",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=DEFAULT_TIMEOUT_SECONDS,
        help="HTTP timeout in seconds per article URL",
    )
    parser.add_argument(
        "--interest-id",
        action="append",
        default=[],
        help="Filter to one or more interest IDs. Repeat for multiple.",
    )
    parser.add_argument(
        "--subinterest-id",
        action="append",
        default=[],
        help="Filter to one or more subinterest IDs. Repeat for multiple.",
    )
    parser.add_argument(
        "--max-articles-per-source",
        type=int,
        default=0,
        help="Optional cap per source. 0 means no cap.",
    )
    return parser.parse_args()


def _clean_text(text: str) -> str:
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text.strip()


def _extract_main_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")

    for tag in soup.find_all(DROP_TAGS):
        tag.decompose()

    node = None
    for selector in MAIN_SELECTORS:
        node = soup.select_one(selector)
        if node:
            break

    root = node or soup.body or soup
    paragraphs = [
        p.get_text(" ", strip=True)
        for p in root.find_all(["p", "li", "h2", "h3"])
    ]
    if paragraphs:
        return _clean_text("\n\n".join(x for x in paragraphs if x))

    return _clean_text(root.get_text(" ", strip=True))


def _is_paywalled(html: str, text: str) -> bool:
    haystack = f"{html}\n{text}".lower()
    return any(marker in haystack for marker in PAYWALL_INDICATORS)


def _fetch_one_content(url: str, timeout_seconds: int) -> dict[str, Any]:
    result = {
        "content": "",
        "content_length": 0,
        "is_paywalled": False,
        "fetch_error": "",
        "http_status": 0,
    }

    if not url:
        result["fetch_error"] = "missing_url"
        return result

    try:
        response = requests.get(
            url,
            timeout=timeout_seconds,
            headers={"User-Agent": USER_AGENT},
        )
        result["http_status"] = response.status_code
        response.raise_for_status()
    except Exception as exc:
        result["fetch_error"] = str(exc)
        return result

    html = response.text or ""
    text = _extract_main_text(html)
    result["is_paywalled"] = _is_paywalled(html, text)

    if not text:
        result["fetch_error"] = "empty_extracted_content"
        return result

    # Intentionally do not truncate content.
    result["content"] = text
    result["content_length"] = len(text)
    return result


def _should_process(
    interest_id: str,
    subinterest_id: str,
    allow_interest_ids: set[str],
    allow_subinterest_ids: set[str],
) -> bool:
    if allow_interest_ids and interest_id not in allow_interest_ids:
        return False
    if allow_subinterest_ids and subinterest_id not in allow_subinterest_ids:
        return False
    return True


def main() -> None:
    args = _parse_args()
    input_path = Path(args.input).resolve()
    out_path = Path(args.out).resolve()

    payload = json.loads(input_path.read_text(encoding="utf-8"))
    grouped = payload.get("grouped_articles", {})
    allow_interest_ids = set(args.interest_id)
    allow_subinterest_ids = set(args.subinterest_id)

    processed_articles = 0
    success_articles = 0
    failed_articles = 0

    for interest_id, sub_map in grouped.items():
        if not isinstance(sub_map, dict):
            continue
        for subinterest_id, source_entries in sub_map.items():
            if not _should_process(
                interest_id,
                subinterest_id,
                allow_interest_ids,
                allow_subinterest_ids,
            ):
                continue
            if not isinstance(source_entries, list):
                continue

            for source_entry in source_entries:
                articles = source_entry.get("articles", [])
                if not isinstance(articles, list):
                    continue

                limited_articles = articles
                if args.max_articles_per_source > 0:
                    limited_articles = articles[: args.max_articles_per_source]

                for article in limited_articles:
                    url = article.get("url", "")
                    fetched = _fetch_one_content(url, args.timeout)
                    article.update(fetched)
                    processed_articles += 1
                    if fetched.get("fetch_error"):
                        failed_articles += 1
                    else:
                        success_articles += 1

                source_entry["content_fetch_stats"] = {
                    "attempted": len(limited_articles),
                    "succeeded": sum(
                        1 for a in limited_articles if not a.get("fetch_error")
                    ),
                    "failed": sum(
                        1 for a in limited_articles if a.get("fetch_error")
                    ),
                }

    payload["content_fetch"] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "settings": {
            "timeout_seconds": args.timeout,
            "interest_ids": sorted(allow_interest_ids),
            "subinterest_ids": sorted(allow_subinterest_ids),
            "max_articles_per_source": args.max_articles_per_source,
        },
        "stats": {
            "processed_articles": processed_articles,
            "success_articles": success_articles,
            "failed_articles": failed_articles,
        },
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(
        json.dumps(
            {
                "out": str(out_path),
                "processed_articles": processed_articles,
                "success_articles": success_articles,
                "failed_articles": failed_articles,
            }
        )
    )


if __name__ == "__main__":
    main()
