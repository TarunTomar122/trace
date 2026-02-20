#!/usr/bin/env python3
"""
Append learning items to existing user feeds without replacing any content.
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
load_dotenv(REPO_ROOT / ".env")

from v1.algorithm.interest_schema import get_interest_ids  # noqa: E402
from v1.storage import FirestoreStore  # noqa: E402
from v2.flows.generate_daily_subscribed_feeds_from_pool import (  # noqa: E402
    _build_learning_feed_item,
    _get_user_seen_urls,
    _load_learning_items_for_user,
    _load_user_feed,
)


def _today_ist() -> str:
    from datetime import timedelta
    return (
        datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)
    ).strftime("%Y-%m-%d")


def _log(msg: str) -> None:
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{stamp}] [append-learning] {msg}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Append learning items to existing feeds.",
    )
    parser.add_argument(
        "--date", default="",
        help="Target date (YYYY-MM-DD). Defaults to today IST.",
    )
    parser.add_argument(
        "--learning-items", type=int, default=3,
        help="Max learning items per user.",
    )
    parser.add_argument(
        "--user-id", default="",
        help="Process single user only.",
    )
    args = parser.parse_args()

    target_date = args.date.strip() or _today_ist()
    store = FirestoreStore()

    users = store.get_onboarded_users()
    _log(f"Users loaded: {len(users)}, date={target_date}")
    if args.user_id:
        users = [u for u in users if u.get("uid") == args.user_id]
        _log(f"Filtered to user_id={args.user_id}: {len(users)}")

    total_added = 0
    users_processed = 0

    for profile in users:
        user_id = profile.get("uid", "")
        if not user_id:
            continue

        interest_ids = set(get_interest_ids(profile))
        if not interest_ids:
            _log(f"user={user_id} no interests, skipping")
            continue

        _, feed_data, feed_items = _load_user_feed(
            store, user_id, target_date,
        )
        if not feed_data:
            _log(f"user={user_id} no feed for {target_date}, skipping")
            continue

        existing_learn = [
            i for i in feed_items
            if isinstance(i, dict)
            and (
                i.get("feed_category") == "learn"
                or (isinstance(i.get("metadata"), dict)
                    and i["metadata"].get("feed_category") == "learn")
                or str(i.get("id", "")).startswith("learn_")
            )
        ]
        if existing_learn:
            _log(
                f"user={user_id} already has {len(existing_learn)} "
                f"learning items, skipping"
            )
            continue

        seen_urls = _get_user_seen_urls(store, user_id)
        existing_feed_urls = {
            i.get("url", "")
            for i in feed_items
            if isinstance(i, dict) and i.get("url")
        }

        learning_pool_items = _load_learning_items_for_user(
            store=store,
            interest_ids=interest_ids,
            seen_urls=seen_urls,
            existing_urls=existing_feed_urls,
            limit=args.learning_items,
        )
        if not learning_pool_items:
            _log(f"user={user_id} no matching learning items in pool")
            continue

        learning_feed_items = [
            _build_learning_feed_item(li)
            for li in learning_pool_items
        ]

        feed_items.extend(learning_feed_items)
        feed_data["items"] = feed_items
        feed_data["generated_at"] = (
            datetime.now(timezone.utc).isoformat()
        )
        meta = feed_data.get("metadata", {})
        if isinstance(meta, dict):
            meta["learning_items_added"] = len(learning_feed_items)
            feed_data["metadata"] = meta

        (
            store.db.collection("user_feeds")
            .document(user_id)
            .collection("daily")
            .document(target_date)
            .set(feed_data, merge=True)
        )

        added = len(learning_feed_items)
        total_added += added
        users_processed += 1
        _log(f"user={user_id} appended {added} learning items")

    _log(
        f"Done. users_processed={users_processed}, "
        f"total_learning_added={total_added}"
    )


if __name__ == "__main__":
    main()
