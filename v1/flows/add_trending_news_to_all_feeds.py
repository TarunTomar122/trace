"""
Append trending news items to feeds for all users with feeds.

Two-step process:
1. Run build_trending_news_for_day.py first (caches news)
2. Run this script to add news to all user feeds

Usage:
  python v1/flows/add_trending_news_to_all_feeds.py
  python v1/flows/add_trending_news_to_all_feeds.py --limit 10
  python v1/flows/add_trending_news_to_all_feeds.py --date 2026-01-28
"""
import argparse
import sys
import time
from pathlib import Path

project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env")

from v1.storage import FirestoreStore
from v1.flows.add_trending_news_to_feed import (
    add_trending_news_to_feed,
    _get_today_ist_date,
)


def add_trending_news_to_all_feeds(
    date: str | None = None,
    limit: int | None = None,
    subscribed_only: bool = False,
) -> dict:
    """
    Add trending news to feeds for all users.

    Args:
        date: Date string (YYYY-MM-DD), defaults to today IST
        limit: Max number of users to process
        subscribed_only: If True, only process subscribed users

    Returns:
        Summary dict with counts
    """
    store = FirestoreStore()

    if not date:
        date = _get_today_ist_date()

    # Get users with feeds for this date
    if subscribed_only:
        users = store.get_onboarded_users()
        user_ids = [u.get("uid") for u in users if u.get("uid")]
    else:
        # Get all users who have a feed for this date
        all_profiles = store.get_all_user_profiles()
        user_ids = [p.get("uid") for p in all_profiles if p.get("uid")]

    if limit:
        user_ids = user_ids[:limit]

    total = len(user_ids)
    if total == 0:
        print("No users found.")
        return {"users_processed": 0, "success": 0, "failed": 0, "items_added": 0}

    print(f"Processing {total} users for date {date}...")

    success = 0
    failed = 0
    total_items = 0

    for i, user_id in enumerate(user_ids, 1):
        print(f"[{i}/{total}] Adding trending news for {user_id}...")
        try:
            result = add_trending_news_to_feed(user_id, date)
            items_added = result.get("items_added", 0)
            total_items += items_added
            if items_added > 0:
                success += 1
            else:
                # No items but no error
                success += 1
        except Exception as e:
            failed += 1
            print(f"  Error: {e}")
        time.sleep(0.1)

    print(f"\nSummary:")
    print(f"  Users processed: {total}")
    print(f"  Success: {success}")
    print(f"  Failed: {failed}")
    print(f"  Total items added: {total_items}")

    return {
        "date": date,
        "users_processed": total,
        "success": success,
        "failed": failed,
        "items_added": total_items,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Add trending news to all user feeds"
    )
    parser.add_argument(
        "--date",
        help="Date string (YYYY-MM-DD), defaults to today IST",
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Limit number of users to process",
    )
    parser.add_argument(
        "--subscribed-only",
        action="store_true",
        help="Only process subscribed users",
    )

    args = parser.parse_args()

    result = add_trending_news_to_all_feeds(
        date=args.date,
        limit=args.limit,
        subscribed_only=args.subscribed_only,
    )
    print(f"\nDone. Total items added: {result['items_added']}")


if __name__ == "__main__":
    main()
