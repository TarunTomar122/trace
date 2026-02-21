#!/usr/bin/env python3
"""
Generate a weekly knowledge wrap for each subscribed user.

Reads the past 7 days of feeds and reading patterns, then uses
gpt-4o-mini to create a shareable summary card stored in Firestore.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

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
    print(f"[{stamp}] [weekly-wrap] {msg}")


WRAP_PROMPT = """You are creating a fun, shareable "weekly knowledge wrap" for a user.

Given the topics and articles they had in their feed this week, generate a short wrap.

Rules:
- Keep it upbeat and personal (like Spotify Wrapped but for learning)
- Return JSON with keys: headline, summary, top_topic, fun_stat
- headline: one catchy line (e.g. "Your brain had a big week")
- summary: 2-3 sentences about what they explored
- top_topic: the dominant topic this week
- fun_stat: a fun one-liner stat (e.g. "You covered 23 articles across 5 topics")
- No markdown, clean prose

Data:
Total articles in feeds: {total_articles}
Topics covered: {topics}
Top titles: {top_titles}
Days with feeds: {days_count}"""


def generate_weekly_wraps(
    date: str | None = None,
    user_id: str = "",
) -> dict[str, Any]:
    end_date_str = (date or "").strip() or _today_ist()
    end_date = datetime.strptime(end_date_str, "%Y-%m-%d")
    start_date = end_date - timedelta(days=6)

    dates = []
    for i in range(7):
        d = start_date + timedelta(days=i)
        dates.append(d.strftime("%Y-%m-%d"))

    week_id = f"{dates[0]}_to_{dates[-1]}"

    store = FirestoreStore()
    openai_key = os.getenv("OPENAI_API_KEY", "").strip()
    client = OpenAI(api_key=openai_key) if openai_key else None

    users = store.get_onboarded_users()
    _log(f"Users: {len(users)}, week: {week_id}")
    if user_id:
        users = [u for u in users if u.get("uid") == user_id]

    generated = 0
    skipped = 0

    for profile in users:
        uid = profile.get("uid", "")
        if not uid:
            continue

        wrap_ref = (
            store.db.collection("user_weekly_wraps")
            .document(uid)
            .collection("weeks")
            .document(week_id)
        )
        existing = wrap_ref.get()
        if existing.exists:
            _log(f"user={uid} wrap already exists for {week_id}")
            skipped += 1
            continue

        all_titles: list[str] = []
        topic_counter: Counter[str] = Counter()
        days_with_feed = 0

        for d in dates:
            feed_doc = (
                store.db.collection("user_feeds")
                .document(uid)
                .collection("daily")
                .document(d)
                .get()
            )
            if not feed_doc.exists:
                continue
            feed_data = feed_doc.to_dict() or {}
            items = feed_data.get("items", [])
            if not items:
                continue
            days_with_feed += 1
            for item in items:
                title = item.get("title", "")
                if title:
                    all_titles.append(title)
                tags = item.get("tags", [])
                if isinstance(tags, list):
                    for t in tags:
                        if t:
                            topic_counter[t] += 1
                meta = item.get("metadata", {})
                if isinstance(meta, dict):
                    cat = meta.get("feed_category", "")
                    if cat:
                        topic_counter[cat] += 1

        if not all_titles:
            _log(f"user={uid} no feed data this week")
            skipped += 1
            continue

        top_topics = [t for t, _ in topic_counter.most_common(5)]
        top_titles_sample = all_titles[:8]

        if client:
            try:
                resp = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {
                            "role": "user",
                            "content": WRAP_PROMPT.format(
                                total_articles=len(all_titles),
                                topics=", ".join(top_topics),
                                top_titles="\n".join(
                                    f"- {t}" for t in top_titles_sample
                                ),
                                days_count=days_with_feed,
                            ),
                        },
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.8,
                    max_tokens=250,
                )
                raw = (resp.choices[0].message.content or "").strip()
                parsed = json.loads(raw)
            except Exception as exc:
                _log(f"user={uid} AI error: {exc}")
                parsed = {}
        else:
            parsed = {}

        wrap_data: dict[str, Any] = {
            "week_id": week_id,
            "start_date": dates[0],
            "end_date": dates[-1],
            "total_articles": len(all_titles),
            "days_with_feed": days_with_feed,
            "top_topics": top_topics,
            "headline": parsed.get(
                "headline",
                f"You explored {len(all_titles)} articles this week!",
            ),
            "summary": parsed.get(
                "summary",
                f"Across {days_with_feed} days, you covered topics like "
                f"{', '.join(top_topics[:3])}.",
            ),
            "top_topic": parsed.get(
                "top_topic",
                top_topics[0] if top_topics else "",
            ),
            "fun_stat": parsed.get(
                "fun_stat",
                f"{len(all_titles)} articles across "
                f"{len(top_topics)} topics",
            ),
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

        wrap_ref.set(wrap_data)
        generated += 1
        _log(f"user={uid} wrap generated: {wrap_data['headline']}")

    _log(f"Done. generated={generated}, skipped={skipped}")
    return {"generated": generated, "skipped": skipped, "week_id": week_id}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", default="")
    parser.add_argument("--user-id", default="")
    args = parser.parse_args()
    result = generate_weekly_wraps(
        date=args.date, user_id=args.user_id,
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
