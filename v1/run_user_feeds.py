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
from datetime import datetime
from pathlib import Path

project_root = str(Path(__file__).parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from v1.storage import FirestoreStore
from v1.generate_feed import generate_feed


def run_user_feeds(date: str | None = None, limit: int | None = None) -> dict:
    """
    Generate feeds for all onboarded users (both subscribed and unsubscribed).
    
    Feed content differs based on subscription:
    - Subscribed (trial/active): Full feeds with signals + top-up searches
    - Unsubscribed: Pool-only preview feeds
    
    Args:
        date: Optional date string (YYYY-MM-DD), defaults to today
        limit: Optional limit on number of users to process
    
    Returns:
        Stats dict with users_processed, success_count, error_count, duration
    """
    store = FirestoreStore()
    
    if not date:
        date = datetime.utcnow().strftime("%Y-%m-%d")
    
    start_time = time.time()
    
    # Query all onboarded users
    print("Loading onboarded users...")
    all_users = list(store.db.collection("user_profiles").where("onboarded", "==", True).stream())
    
    # Separate by subscription status for stats
    subscribed_users = []
    unsubscribed_users = []
    
    for user_doc in all_users:
        user_data = user_doc.to_dict()
        status = user_data.get("subscriptionStatus", "none")
        if status in ["trial", "active"]:
            subscribed_users.append(user_doc)
        else:
            unsubscribed_users.append(user_doc)
    
    users = all_users
    total_users = len(users)
    
    print(f"Found {total_users} onboarded users:")
    print(f"  - {len(subscribed_users)} subscribed (trial + active)")
    print(f"  - {len(unsubscribed_users)} unsubscribed")
    
    if limit:
        users = users[:limit]
        print(f"Processing {len(users)} users (limited)")
    
    if not users:
        print("No onboarded users found.")
        return {
            "users_processed": 0,
            "success_count": 0,
            "error_count": 0,
            "duration_seconds": 0
        }
    
    print(f"\nGenerating feeds for {len(users)} users on {date}...")
    print("-" * 50)
    
    success_count = 0
    error_count = 0
    errors = []
    
    for i, user_doc in enumerate(users, 1):
        user_id = user_doc.id
        user_data = user_doc.to_dict()
        user_name = user_data.get("name", user_data.get("displayName", "Unknown"))
        
        progress = f"[{i}/{len(users)}]"
        print(f"\n{progress} Generating feed for {user_name} ({user_id})...")
        
        try:
            result = generate_feed(user_id, date)
            item_count = len(result.get("items", []))
            print(f"  ✓ Generated {item_count} items")
            success_count += 1
        except Exception as e:
            print(f"  ✗ Error: {e}")
            errors.append({"user_id": user_id, "error": str(e)})
            error_count += 1
    
    # Summary
    duration = time.time() - start_time
    duration_str = f"{int(duration // 60)}m {int(duration % 60)}s"
    
    print("\n" + "=" * 50)
    print(f"Generated feeds for {success_count}/{len(users)} users in {duration_str}")
    
    if errors:
        print(f"\nErrors ({len(errors)}):")
        for err in errors[:5]:
            print(f"  - {err['user_id']}: {err['error']}")
        if len(errors) > 5:
            print(f"  ... and {len(errors) - 5} more")
    
    return {
        "users_processed": len(users),
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

