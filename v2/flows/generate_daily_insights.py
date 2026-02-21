#!/usr/bin/env python3
"""
Generate a daily insight for each subscribed user from their feed items.

Picks the most interesting articles from the user's feed, sends them to
gpt-4o-mini, and stores a single punchy insight in the feed document.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
import os

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
load_dotenv(REPO_ROOT / ".env")

from openai import OpenAI  # noqa: E402
from v1.storage import FirestoreStore  # noqa: E402


def _today_ist() -> str:
    return (
        datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)
    ).strftime("%Y-%m-%d")


def _log(msg: str) -> None:
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{stamp}] [daily-insights] {msg}")


INSIGHT_PROMPT = """You are an insightful analyst. Given these article summaries from a user's daily feed, generate ONE punchy "insight of the day."

Rules:
- One specific, non-obvious insight drawn from the articles below
- 2-3 sentences max. Dense with value. No fluff.
- Make it feel like a smart friend whispering something useful at breakfast
- Include which article it's from (just the title)
- No markdown, no bullet points, just clean prose
- Return JSON: {{"insight": "...", "source_title": "...", "source_url": "..."}}

Articles:
{articles}"""


def _pick_best_items(items: list[dict[str, Any]], limit: int = 4) -> list[dict[str, Any]]:
    scored: list[tuple[float, dict[str, Any]]] = []
    for item in items:
        score = 0.0
        summary = item.get("summary", {})
        if isinstance(summary, dict):
            sa = summary.get("short_article", {})
            if sa.get("body"):
                score += 3.0
            if sa.get("outline"):
                score += 1.0
        cat = ""
        meta = item.get("metadata", {})
        if isinstance(meta, dict):
            cat = meta.get("feed_category", "")
        if cat == "learn":
            score += 2.0
        elif cat == "trending_news":
            score += 1.5
        if item.get("title", ""):
            score += 0.5
        scored.append((score, item))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [item for _, item in scored[:limit]]


def generate_daily_insights(
    date: str | None = None,
    user_id: str = "",
) -> dict[str, Any]:
    target_date = (date or "").strip() or _today_ist()
    store = FirestoreStore()

    openai_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not openai_key:
        _log("OPENAI_API_KEY not set, aborting")
        return {"error": "no_api_key"}
    client = OpenAI(api_key=openai_key)

    users = store.get_onboarded_users()
    _log(f"Users: {len(users)}, date={target_date}")
    if user_id:
        users = [u for u in users if u.get("uid") == user_id]

    generated = 0
    skipped = 0

    for profile in users:
        uid = profile.get("uid", "")
        if not uid:
            continue

        feed_ref = (
            store.db.collection("user_feeds")
            .document(uid)
            .collection("daily")
            .document(target_date)
        )
        feed_doc = feed_ref.get()
        if not feed_doc.exists:
            _log(f"user={uid} no feed for {target_date}")
            skipped += 1
            continue

        feed_data = feed_doc.to_dict() or {}
        if feed_data.get("daily_insight"):
            _log(f"user={uid} already has insight")
            skipped += 1
            continue

        items = feed_data.get("items", [])
        if not items:
            skipped += 1
            continue

        best = _pick_best_items(items)
        articles_text = ""
        for i, item in enumerate(best, 1):
            title = item.get("title", "")
            url = item.get("url", "")
            summary = item.get("summary", {})
            body = ""
            if isinstance(summary, dict):
                sa = summary.get("short_article", {})
                body = sa.get("body", "") or sa.get("subtitle", "")
            articles_text += (
                f"{i}. Title: {title}\n"
                f"   URL: {url}\n"
                f"   Summary: {body[:300]}\n\n"
            )

        try:
            resp = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "user",
                        "content": INSIGHT_PROMPT.format(
                            articles=articles_text,
                        ),
                    },
                ],
                response_format={"type": "json_object"},
                temperature=0.7,
                max_tokens=200,
            )
            raw = (resp.choices[0].message.content or "").strip()
            parsed = json.loads(raw)
            insight_text = parsed.get("insight", "").strip()
            source_title = parsed.get("source_title", "").strip()
            source_url = parsed.get("source_url", "").strip()

            if not insight_text:
                _log(f"user={uid} empty insight from API")
                skipped += 1
                continue

            feed_ref.set(
                {
                    "daily_insight": {
                        "text": insight_text,
                        "source_title": source_title,
                        "source_url": source_url,
                        "generated_at": datetime.now(
                            timezone.utc
                        ).isoformat(),
                    },
                },
                merge=True,
            )
            generated += 1
            _log(f"user={uid} insight generated")

        except Exception as exc:
            _log(f"user={uid} error: {exc}")
            skipped += 1

    _log(f"Done. generated={generated}, skipped={skipped}")
    return {"generated": generated, "skipped": skipped}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", default="")
    parser.add_argument("--user-id", default="")
    args = parser.parse_args()
    result = generate_daily_insights(
        date=args.date, user_id=args.user_id,
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
