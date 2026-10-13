"""
Shared utilities for feed diversity: source capping and same-story dedup.
"""

from __future__ import annotations

import re
from difflib import SequenceMatcher
from typing import Any
from urllib.parse import urlsplit, urlunsplit

MAX_PER_SOURCE = 2
TITLE_SIMILARITY_THRESHOLD = 0.6

STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "how",
    "in",
    "is",
    "it",
    "its",
    "of",
    "on",
    "that",
    "the",
    "to",
    "was",
    "were",
    "what",
    "when",
    "where",
    "who",
    "why",
    "with",
}

def _normalize_title(title: str) -> str:
    return " ".join(title.lower().strip().split())


def _titles_are_similar(a: str, b: str) -> bool:
    na, nb = _normalize_title(a), _normalize_title(b)
    if na == nb:
        return True
    return SequenceMatcher(None, na, nb).ratio() >= TITLE_SIMILARITY_THRESHOLD


def _canonical_story_url(url: str) -> str:
    raw = str(url or "").strip()
    if not raw:
        return ""
    parsed = urlsplit(raw)
    if not parsed.scheme or not parsed.netloc:
        return raw
    path = parsed.path or "/"
    if path != "/" and path.endswith("/"):
        path = path[:-1]
    return urlunsplit((parsed.scheme.lower(), parsed.netloc.lower(), path, "", ""))


def dedupe_and_cap(
    items: list[dict[str, Any]],
    max_per_source: int = MAX_PER_SOURCE,
) -> list[dict[str, Any]]:
    """
    Remove near-duplicate stories and cap items per source_name.
    Preserves the original ordering (first-seen wins).
    """
    result: list[dict[str, Any]] = []
    source_counts: dict[str, int] = {}
    seen_titles: list[str] = []

    for item in items:
        title = item.get("title", "")
        src = item.get("source_name", "")

        if source_counts.get(src, 0) >= max_per_source:
            continue

        if any(_titles_are_similar(title, t) for t in seen_titles):
            continue

        result.append(item)
        source_counts[src] = source_counts.get(src, 0) + 1
        seen_titles.append(title)

    return result


def dedupe_trending_latest_story(
    items: list[dict[str, Any]],
    max_per_source: int = 4,
) -> tuple[list[dict[str, Any]], dict[str, int]]:
    """
    Exact URL dedupe for trending:
    - keep first-seen item (caller passes latest-first list)
    - semantic grouping happens after summaries via embeddings + Jev
    - apply per-source cap
    """
    result: list[dict[str, Any]] = []
    source_counts: dict[str, int] = {}
    stats = {
        "dropped_exact_url": 0,
        "dropped_source_cap": 0,
    }
    seen_urls: set[str] = set()

    for item in items:
        title = str(item.get("title", "")).strip()
        if not title:
            continue

        canonical_url = _canonical_story_url(str(item.get("url", "")))
        if canonical_url and canonical_url in seen_urls:
            stats["dropped_exact_url"] += 1
            continue

        src = str(item.get("source_name", "")).strip()
        if source_counts.get(src, 0) >= max_per_source:
            stats["dropped_source_cap"] += 1
            continue

        result.append(item)
        if canonical_url:
            seen_urls.add(canonical_url)
        source_counts[src] = source_counts.get(src, 0) + 1

    return result, stats
