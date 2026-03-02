"""
Shared utilities for feed diversity: source capping and same-story dedup.
"""

from __future__ import annotations

import re
from difflib import SequenceMatcher
from typing import Any

MAX_PER_SOURCE = 2
TITLE_SIMILARITY_THRESHOLD = 0.6
TRENDING_SIMILARITY_THRESHOLD = 0.58

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

# Broad topic words should not be enough on their own to merge stories.
BROAD_TOPIC_TOKENS = {
    "war",
    "conflict",
    "crisis",
    "election",
    "politics",
    "government",
    "military",
    "market",
    "markets",
    "stocks",
    "economy",
}

DEVELOPMENT_MARKERS = {
    "ceasefire",
    "approved",
    "approval",
    "signed",
    "sanctions",
    "explosion",
    "blast",
    "killed",
    "injured",
    "death",
    "deaths",
    "strike",
    "missile",
    "lawsuit",
    "ban",
}


def _normalize_title(title: str) -> str:
    return " ".join(title.lower().strip().split())


def _titles_are_similar(a: str, b: str) -> bool:
    na, nb = _normalize_title(a), _normalize_title(b)
    if na == nb:
        return True
    return SequenceMatcher(None, na, nb).ratio() >= TITLE_SIMILARITY_THRESHOLD


def _story_tokens(title: str) -> set[str]:
    cleaned = re.sub(r"[^a-z0-9\s]", " ", _normalize_title(title))
    tokens = []
    for token in cleaned.split():
        if len(token) < 4:
            continue
        if token in STOPWORDS or token in BROAD_TOPIC_TOKENS:
            continue
        tokens.append(token)
    return set(tokens)


def _has_conflicting_markers(a: str, b: str) -> bool:
    at = set(re.findall(r"[a-z0-9]+", _normalize_title(a)))
    bt = set(re.findall(r"[a-z0-9]+", _normalize_title(b)))
    am = at & DEVELOPMENT_MARKERS
    bm = bt & DEVELOPMENT_MARKERS
    if not am and not bm:
        return False
    # If one title has development markers and the other doesn't,
    # treat it as likely a new development and avoid merging.
    if bool(am) != bool(bm):
        return True
    return False


def _is_same_story(candidate_title: str, kept_title: str) -> bool:
    if _has_conflicting_markers(candidate_title, kept_title):
        return False

    similarity = SequenceMatcher(
        None,
        _normalize_title(candidate_title),
        _normalize_title(kept_title),
    ).ratio()
    if similarity >= TRENDING_SIMILARITY_THRESHOLD:
        return True

    ct = _story_tokens(candidate_title)
    kt = _story_tokens(kept_title)
    if not ct or not kt:
        return False
    shared = ct & kt
    if len(shared) < 2:
        return False
    overlap = len(shared) / max(1, min(len(ct), len(kt)))
    return overlap >= 0.5


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
    Aggressive dedupe for trending:
    - cluster likely same-story headlines across sources
    - keep first-seen item (caller passes latest-first list)
    - apply per-source cap
    """
    result: list[dict[str, Any]] = []
    source_counts: dict[str, int] = {}
    kept_titles: list[str] = []
    stats = {
        "dropped_similar_story": 0,
        "dropped_source_cap": 0,
    }

    for item in items:
        title = str(item.get("title", "")).strip()
        if not title:
            continue

        if any(_is_same_story(title, kept) for kept in kept_titles):
            stats["dropped_similar_story"] += 1
            continue

        src = str(item.get("source_name", "")).strip()
        if source_counts.get(src, 0) >= max_per_source:
            stats["dropped_source_cap"] += 1
            continue

        result.append(item)
        kept_titles.append(title)
        source_counts[src] = source_counts.get(src, 0) + 1

    return result, stats
