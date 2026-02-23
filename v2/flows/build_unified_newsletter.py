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
import re
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
from v3.lib.store import V3Store  # noqa: E402

MAX_ITEMS_DEFAULT = 6
TOPIC_PRIORITY = [
    "technology",
    "business-market",
    "experience",
]
TOPIC_TARGET_COUNTS = {
    "technology": 2,
    "business-market": 2,
    "experience": 2,
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


def _collect_v3_feed_trending(store: FirestoreStore, date: str) -> list[dict[str, Any]]:
    """Pull trending items from an existing v3 user feed (already has AI summaries)."""
    v3 = V3Store()
    users = v3.get_onboarded_users()

    best_items: list[dict[str, Any]] = []
    for user in users:
        uid = user.get("uid", "")
        if not uid:
            continue
        feed = v3.load_feed(uid, date)
        trending = feed.get("trending", [])
        if isinstance(trending, list) and trending:
            best_items = trending
            break

    rows: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in best_items:
        if not isinstance(item, dict):
            continue
        url = str(item.get("url", "")).strip()
        title = str(item.get("title", "")).strip()
        if not url or not title or url in seen:
            continue
        seen.add(url)

        summary = item.get("summary", {})
        short = summary.get("short_article", {}) if isinstance(summary, dict) else {}
        subtitle = str(short.get("subtitle", "")).strip() if isinstance(short, dict) else ""

        rows.append({
            "topic_id": str(item.get("interest_id", "")).strip(),
            "topic_name": "",
            "title": title,
            "url": url,
            "subtitle": subtitle,
            "details": subtitle,
            "thumbnail": str(item.get("thumbnail", "")).strip(),
            "published_date": str(item.get("published_date", "")).strip(),
            "source_name": str(item.get("source_name", "")).strip(),
        })

    return rows


def _select_diverse(
    articles: list[dict[str, Any]],
    max_items: int,
) -> list[dict[str, Any]]:
    def _domain(url: str) -> str:
        return (urlparse(url).hostname or "").lower().replace("www.", "")

    selected: list[dict[str, Any]] = []
    seen_urls: set[str] = set()
    domain_counts: dict[str, int] = {}

    for candidate in articles:
        if len(selected) >= max_items:
            break
        url = str(candidate.get("url", "")).strip()
        if not url or url in seen_urls:
            continue
        domain = _domain(url)
        if domain and domain_counts.get(domain, 0) >= MAX_PER_DOMAIN:
            continue
        seen_urls.add(url)
        selected.append(candidate)
        if domain:
            domain_counts[domain] = domain_counts.get(domain, 0) + 1

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
        subject = f"Trace Daily: AI, Product & Design picks for {date}"
    if not intro:
        intro = (
            "Here are today's best trending picks across AI, Product, and Design. "
            "Just the essential stories in one quick edition."
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

    source = "trending_news"
    articles = _collect_trending_articles(store, target_date)
    if not articles:
        articles = _collect_v3_feed_trending(store, target_date)
        source = "v3_user_feed"
    if not articles:
        return {
            "success": False,
            "error": "no trending articles found",
            "date": target_date,
        }

    selected = _select_diverse(articles, max_items=max_items)
    if not selected:
        return {
            "success": False,
            "error": "no selectable trending articles",
            "date": target_date,
        }

    subject = f"Trace Daily: AI, Product & Design picks for {target_date}"
    intro_html = (
        '<p style="margin: 0; font-size: 15px; color: #52525b; '
        "line-height: 1.7; font-family: -apple-system, BlinkMacSystemFont, "
        f"'Segoe UI', sans-serif;\">"
        "Here are today's top trending picks across AI, product development, and design."
        "</p>"
    )
    rewritten_blurbs: dict[str, str] = {}

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
            "source": source,
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
        "source": f"v2_unified_trending:{source}",
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
