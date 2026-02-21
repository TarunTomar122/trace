#!/usr/bin/env python3
"""
Build one unified newsletter for all users from trending news.

This flow:
1) Loads trending_news/{date}/topics/*
2) Selects up to 8 items with topic diversity
3) Generates subject + intro
4) Saves draft to unified_newsletters/{date}
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from dotenv import load_dotenv
from openai import OpenAI

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
load_dotenv(REPO_ROOT / ".env")

from v1.storage import FirestoreStore  # noqa: E402

MAX_ITEMS_DEFAULT = 8
TOPIC_PRIORITY = [
    "technology",
    "business-market",
    "experience",
    "productivity",
]
TOPIC_TARGET_COUNTS = {
    "technology": 3,
    "business-market": 3,
    "experience": 1,
    "productivity": 1,
}
MAX_PER_DOMAIN = 2


def _today_ist() -> str:
    ist = timezone(timedelta(hours=5, minutes=30))
    return datetime.now(ist).strftime("%Y-%m-%d")


def _parse_iso(value: str) -> datetime:
    text = (value or "").strip()
    if not text:
        return datetime.min.replace(tzinfo=timezone.utc)
    try:
        dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except ValueError:
        try:
            return datetime.strptime(text[:10], "%Y-%m-%d").replace(
                tzinfo=timezone.utc
            )
        except ValueError:
            return datetime.min.replace(tzinfo=timezone.utc)


def _collect_trending_articles(
    store: FirestoreStore,
    date: str,
) -> list[dict[str, Any]]:
    root_doc = store.db.collection("trending_news").document(date).get()
    if not root_doc.exists:
        return []

    rows: list[dict[str, Any]] = []
    topic_docs = (
        store.db.collection("trending_news")
        .document(date)
        .collection("topics")
        .stream()
    )
    for topic_doc in topic_docs:
        topic = topic_doc.to_dict() or {}
        topic_id = topic.get("topic_id", topic_doc.id)
        topic_name = topic.get("name", topic_id)
        for article in topic.get("articles", []) or []:
            if not isinstance(article, dict):
                continue
            url = str(article.get("url", "")).strip()
            title = str(article.get("title", "")).strip()
            if not url or not title:
                continue
            rows.append(
                {
                    "topic_id": topic_id,
                    "topic_name": topic_name,
                    "title": title,
                    "url": url,
                    "subtitle": str(article.get("subtitle", "")).strip(),
                    "details": str(article.get("details", "")).strip(),
                    "thumbnail": str(article.get("thumbnail", "")).strip(),
                    "published_date": str(
                        article.get("published_date", "")
                    ).strip(),
                }
            )

    rows.sort(
        key=lambda x: _parse_iso(x.get("published_date", "")),
        reverse=True,
    )
    return rows


def _select_diverse(
    articles: list[dict[str, Any]],
    max_items: int,
) -> list[dict[str, Any]]:
    def _domain(url: str) -> str:
        return (urlparse(url).hostname or "").lower().replace("www.", "")

    by_topic: dict[str, list[dict[str, Any]]] = {}
    for item in articles:
        by_topic.setdefault(item["topic_id"], []).append(item)

    topic_ids = sorted(
        by_topic.keys(),
        key=lambda t: (
            TOPIC_PRIORITY.index(t)
            if t in TOPIC_PRIORITY
            else len(TOPIC_PRIORITY),
            t,
        ),
    )
    selected: list[dict[str, Any]] = []
    seen_urls: set[str] = set()
    domain_counts: dict[str, int] = {}

    # Pass 1: enforce AI/tech-first target mix.
    for topic_id in topic_ids:
        target = TOPIC_TARGET_COUNTS.get(topic_id, 0)
        queue = by_topic.get(topic_id, [])
        while queue and len(selected) < max_items and target > 0:
            candidate = queue.pop(0)
            url = candidate["url"]
            domain = _domain(url)
            if url in seen_urls:
                continue
            if domain and domain_counts.get(domain, 0) >= MAX_PER_DOMAIN:
                continue
            seen_urls.add(url)
            selected.append(candidate)
            if domain:
                domain_counts[domain] = domain_counts.get(domain, 0) + 1
            target -= 1
        if len(selected) >= max_items:
            return selected

    # Pass 2: fill remaining slots in priority order.
    while len(selected) < max_items:
        added = False
        for topic_id in topic_ids:
            queue = by_topic.get(topic_id, [])
            while queue and queue[0]["url"] in seen_urls:
                queue.pop(0)
            if not queue:
                continue
            candidate = queue.pop(0)
            url = candidate["url"]
            domain = _domain(url)
            if domain and domain_counts.get(domain, 0) >= MAX_PER_DOMAIN:
                continue
            seen_urls.add(url)
            selected.append(candidate)
            if domain:
                domain_counts[domain] = domain_counts.get(domain, 0) + 1
            added = True
            if len(selected) >= max_items:
                break
        if not added:
            break
    return selected


def _build_item_summary(item: dict[str, Any]) -> str:
    details = item.get("details", "")
    subtitle = item.get("subtitle", "")
    if details:
        return details
    return subtitle


def _generate_editorial(
    client: OpenAI,
    items: list[dict[str, Any]],
    date: str,
) -> tuple[str, str]:
    payload = [
        {
            "topic": i.get("topic_name", ""),
            "title": i.get("title", ""),
            "subtitle": i.get("subtitle", ""),
        }
        for i in items
    ]
    prompt = (
        f"You are editing a concise daily newsletter for {date}. "
        f"Here are {len(items)} selected items:\n"
        f"{json.dumps(payload, indent=2)}\n\n"
        "Return JSON only with keys: subject, intro.\n"
        "Rules:\n"
        "- subject max 70 chars\n"
        "- intro 2-3 sentences, plain language, no hype\n"
    )
    try:
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.6,
            max_tokens=220,
        )
        parsed = json.loads(resp.choices[0].message.content or "{}")
        subject = str(parsed.get("subject", "")).strip()
        intro = str(parsed.get("intro", "")).strip()
    except Exception:
        subject = ""
        intro = ""

    if not subject:
        subject = f"Trace Daily: {len(items)} trending stories for {date}"
    if not intro:
        intro = (
            "Here are today's top trending stories across all categories. "
            "Quick, useful updates in one edition."
        )
    intro_html = (
        '<p style="margin: 0; font-size: 15px; color: #52525b; '
        "line-height: 1.7; font-family: -apple-system, BlinkMacSystemFont, "
        f"'Segoe UI', sans-serif;\">{intro}</p>"
    )
    return subject, intro_html


def _rewrite_item_blurbs(
    client: OpenAI,
    items: list[dict[str, Any]],
) -> dict[str, str]:
    payload = [
        {
            "url": i.get("url", ""),
            "topic": i.get("topic_name", ""),
            "title": i.get("title", ""),
            "subtitle": i.get("subtitle", ""),
            "details": i.get("details", ""),
        }
        for i in items
    ]
    prompt = (
        "Rewrite each item into one concise, interesting blurb.\n"
        "Return JSON only as:\n"
        "{\"items\": [{\"url\": \"...\", \"blurb\": \"...\"}]}\n"
        "Rules:\n"
        "- Max 2 sentences per blurb\n"
        "- Keep it factual and specific\n"
        "- No clickbait, no hype, no new claims\n"
        "- Preserve the original URL\n\n"
        f"Items:\n{json.dumps(payload, indent=2)}"
    )
    try:
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.8,
            max_tokens=800,
        )
        parsed = json.loads(resp.choices[0].message.content or "{}")
        rows = parsed.get("items", []) if isinstance(parsed, dict) else []
        mapping: dict[str, str] = {}
        if isinstance(rows, list):
            for row in rows:
                if not isinstance(row, dict):
                    continue
                url = str(row.get("url", "")).strip()
                blurb = str(row.get("blurb", "")).strip()
                if url and blurb:
                    mapping[url] = blurb
        return mapping
    except Exception:
        return {}


def build_unified_newsletter(
    date: str | None = None,
    max_items: int = MAX_ITEMS_DEFAULT,
    force: bool = False,
) -> dict[str, Any]:
    store = FirestoreStore()
    target_date = (date or "").strip() or _today_ist()
    doc_ref = store.db.collection("unified_newsletters").document(target_date)
    existing = doc_ref.get()
    if existing.exists and not force:
        data = existing.to_dict() or {}
        return {
            "success": False,
            "error": "unified newsletter already exists (use --force)",
            "date": target_date,
            "item_count": int(data.get("item_count", 0)),
        }

    articles = _collect_trending_articles(store, target_date)
    if not articles:
        return {
            "success": False,
            "error": "no trending articles found for date",
            "date": target_date,
        }

    selected = _select_diverse(articles, max_items=max_items)
    if not selected:
        return {
            "success": False,
            "error": "no selectable trending articles",
            "date": target_date,
        }

    client = OpenAI()
    subject, intro_html = _generate_editorial(client, selected, target_date)
    rewritten_blurbs = _rewrite_item_blurbs(client, selected)

    newsletter_items = []
    for idx, item in enumerate(selected, start=1):
        row = {
            "id": f"unified_{idx}_{target_date}",
            "title": item.get("title", ""),
            "url": item.get("url", ""),
            "summary": (
                rewritten_blurbs.get(item.get("url", ""))
                or _build_item_summary(item)
            ),
            "type": "news",
            "source": "trending_news",
            "tags": [item.get("topic_id", "")],
            "topic_id": item.get("topic_id", ""),
            "topic_name": item.get("topic_name", ""),
            "published_date": item.get("published_date", ""),
        }
        thumb = item.get("thumbnail", "")
        if thumb:
            row["thumbnail"] = thumb
        newsletter_items.append(row)

    payload = {
        "date": target_date,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "status": "draft",
        "item_count": len(newsletter_items),
        "items": newsletter_items,
        "email_subject": subject,
        "intro_html": intro_html,
        "source": "v2_unified_trending",
    }
    doc_ref.set(payload, merge=True)
    return {
        "success": True,
        "date": target_date,
        "item_count": len(newsletter_items),
        "subject": subject,
        "topics": sorted({i.get("topic_id", "") for i in newsletter_items}),
    }


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build unified newsletter from trending news."
    )
    parser.add_argument("--date", default="", help="YYYY-MM-DD")
    parser.add_argument(
        "--max-items",
        type=int,
        default=MAX_ITEMS_DEFAULT,
        help="Target number of items.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Rebuild even if draft exists.",
    )
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    result = build_unified_newsletter(
        date=args.date,
        max_items=args.max_items,
        force=args.force,
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
