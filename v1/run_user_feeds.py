"""
Bulk feed generator - generates feeds for ALL onboarded users.

Runs for all users who completed onboarding, regardless of subscription.
- Subscribed users get full personalized feeds (pool + signals + top-up)
- Unsubscribed users get pool-only preview feeds
Runs after daily batch (5 AM) to create personalized feeds for each user.

Usage:
    python v1/run_user_feeds.py
"""
import argparse
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path

project_root = str(Path(__file__).parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from v1.storage import FirestoreStore
from v1.flows.build_feed_from_topics_for_all_users import build_feeds_for_all_users
from v1.flows.build_unsubscribed_feeds_for_all_users import build_unsubscribed_feeds
from v1.flows.build_suggested_items_for_all_users import build_suggested_items_for_all_users


def run_user_feeds(date: str | None = None, limit: int | None = None) -> dict:
    """
    Generate feeds for all onboarded users (both subscribed and unsubscribed).
    
    Feed content differs based on subscription:
    - Subscribed (trial/active): Full feeds with signals + top-up searches
    - Unsubscribed: Pool-only preview feeds
    
    Args:
        date: Optional date string (YYYY-MM-DD), defaults to today in IST
        limit: Optional limit on number of users to process
    
    Returns:
        Stats dict with users_processed, success_count, error_count, duration
    """
    store = FirestoreStore()
    
    if not date:
        # Use IST (UTC+5:30) for feed dates since pipeline runs at 10:30 PM UTC
        # which is 4:00 AM IST (next day)
        ist_tz = timezone(timedelta(hours=5, minutes=30))
        date = datetime.now(ist_tz).strftime("%Y-%m-%d")
    
    start_time = time.time()
    
    # Stats only
    print("Loading onboarded users...")
    all_users = list(store.db.collection("user_profiles").where("onboarded", "==", True).stream())
    subscribed_users = [u for u in all_users if u.to_dict().get("subscriptionStatus") in ["trial", "active"]]
    unsubscribed_users = [u for u in all_users if u.to_dict().get("subscriptionStatus") not in ["trial", "active"]]

    print(f"Found {len(all_users)} onboarded users:")
    print(f"  - {len(subscribed_users)} subscribed (trial + active)")
    print(f"  - {len(unsubscribed_users)} unsubscribed")

    if not all_users:
        print("No onboarded users found.")
        return {
            "users_processed": 0,
            "success_count": 0,
            "error_count": 0,
            "duration_seconds": 0
        }

    print(f"\nGenerating feeds for subscribed users on {date}...")
    subscribed_result = build_feeds_for_all_users(limit=limit, skip_seen=False, mode="subscribed")

    print(f"\nGenerating feeds for unsubscribed users on {date}...")
    unsubscribed_result = build_unsubscribed_feeds(limit=limit, skip_seen=False)

    print("\nAdding suggested items for subscribed users...")
    suggested_result = build_suggested_items_for_all_users(limit=limit)

    success_count = subscribed_result.get("success", 0) + unsubscribed_result.get("success", 0)
    error_count = subscribed_result.get("failed", 0) + unsubscribed_result.get("failed", 0)
    
    # Summary
    duration = time.time() - start_time
    duration_str = f"{int(duration // 60)}m {int(duration % 60)}s"
    
    print("\n" + "=" * 50)
    print(f"Generated feeds for {success_count}/{len(users)} users in {duration_str}")
    
    print(f"\nSuggested items added for subscribed users: {suggested_result.get('success', 0)}")
    
    return {
        "users_processed": len(all_users),
        "success_count": success_count,
        "error_count": error_count,
        "duration_seconds": duration,
        "date": date
    }


def main():
    parser = argparse.ArgumentParser(description="Generate feeds for all onboarded users (subscribed and unsubscribed)")
    parser.add_argument("--date", help="Date string (YYYY-MM-DD), defaults to today")
    parser.add_argument("--limit", type=int, help="Limit number of users to process")
    args = parser.parse_args()
    
    run_user_feeds(date=args.date, limit=args.limit)


if __name__ == "__main__":
    main()

