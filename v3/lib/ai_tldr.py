"""Parse AI/TLDR's public JSON feed into Trace pool articles.

AI/TLDR tracks model launches from primary sources (lab blogs, GitHub, HF).
We only keep seismic/major model releases so the feed does not fill with
tools, recap videos, or tiny fine-tunes.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


def _iso_datetime(value: str) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()
    except (ValueError, TypeError):
        return raw


def flatten_explainer(explainer: Any) -> str:
    if isinstance(explainer, str):
        return explainer.strip()
    if not isinstance(explainer, dict):
        return ""
    parts: list[str] = []
    for key in ("tagline", "whatIsIt", "howItWorks", "whyItMatters", "forWho", "tryIt"):
        value = explainer.get(key)
        if isinstance(value, str) and value.strip():
            parts.append(value.strip())
    return "\n\n".join(parts)


def flatten_facts(facts: Any) -> str:
    if not isinstance(facts, list):
        return ""
    lines: list[str] = []
    for fact in facts:
        if not isinstance(fact, dict):
            continue
        label = str(fact.get("label") or "").strip()
        value = str(fact.get("value") or "").strip()
        if label and value:
            lines.append(f"{label}: {value}")
    return "\n".join(lines)


def item_to_article(item: dict[str, Any]) -> dict[str, str] | None:
    url = str(item.get("url") or "").strip()
    title = str(item.get("title") or "").strip()
    if not url or not title:
        return None
    summary = str(item.get("summary") or "").strip()
    description = "\n\n".join(
        part
        for part in (
            summary,
            flatten_explainer(item.get("explainer")),
            flatten_facts(item.get("quickFacts")),
        )
        if part
    )
    image = item.get("image")
    og_image = ""
    if isinstance(image, dict):
        og_image = str(image.get("url") or "").strip()
    elif isinstance(image, str):
        og_image = image.strip()
    published = str(item.get("publishDate") or item.get("date") or "").strip()
    return {
        "url": url,
        "title": title,
        "description": description,
        "published_date": _iso_datetime(published),
        "og_image": og_image,
    }


def select_model_releases(
    items: list[dict[str, Any]],
    *,
    include_categories: list[str] | None = None,
    include_importance: list[str] | None = None,
    limit: int = 15,
) -> list[dict[str, str]]:
    allowed_cats = {
        str(cat).strip().lower()
        for cat in (include_categories or ["model"])
        if str(cat).strip()
    }
    allowed_imp = {
        str(level).strip().lower()
        for level in (include_importance or ["seismic", "major"])
        if str(level).strip()
    }
    selected: list[dict[str, str]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        categories = {
            str(cat).strip().lower()
            for cat in (item.get("categories") or [])
            if str(cat).strip()
        }
        if allowed_cats and categories.isdisjoint(allowed_cats):
            continue
        importance = str(item.get("importance") or "").strip().lower()
        if allowed_imp and importance not in allowed_imp:
            continue
        article = item_to_article(item)
        if not article:
            continue
        selected.append(article)
        if len(selected) >= max(0, limit):
            break
    return selected
