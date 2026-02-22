"""
Shared utilities for feed diversity: source capping and same-story dedup.
"""

from __future__ import annotations

from difflib import SequenceMatcher
from typing import Any

MAX_PER_SOURCE = 2
TITLE_SIMILARITY_THRESHOLD = 0.6


def _normalize_title(title: str) -> str:
    return " ".join(title.lower().strip().split())


def _titles_are_similar(a: str, b: str) -> bool:
    na, nb = _normalize_title(a), _normalize_title(b)
    if na == nb:
        return True
    return SequenceMatcher(None, na, nb).ratio() >= TITLE_SIMILARITY_THRESHOLD


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
