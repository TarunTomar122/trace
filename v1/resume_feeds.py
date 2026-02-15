"""
Resume feed generation for users who didn't get feeds today.

Identifies users who are onboarded but don't have today's feed,
then generates feeds for them.

Usage:
    python v1/resume_feeds.py
    python v1/resume_feeds.py --date 2026-01-21
"""
import argparse
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

project_root = str(Path(__file__).parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from v1.storage import FirestoreStore
from v1.generate_feed import generate_feed


def get_users_without_feed(store: FirestoreStore, date: str) -> list[dict]:
    """Get onboarded users who don't have a feed for the specified date."""
    print(f"Checking for users without feeds on {date}...")
    
    # Get all onboarded users
    all_users = list(store.db.collection("user_profiles").where("onboarded", "==", True).stream())
    print(f"Found {len(all_users)} onboarded users")
    
    users_without_feed = []
    users_with_feed = []
    
    for user_doc in all_users:
        user_id = user_doc.id
        user_data = user_doc.to_dict()
        user_name = user_data.get("name", user_data.get("displayName", "Unknown"))
        
        # Check if feed exists for this date
        feed_doc = store.db.collection("user_feeds").document(user_id).collection("daily").document(date).get()
        
        if not feed_doc.exists:
            users_without_feed.append({
                "id": user_id,
                "name": user_name,
                "email": user_data.get("email", ""),
                "status": user_data.get("subscriptionStatus", "none"),
                "appStatus": user_data.get("appSubscriptionStatus", "none")
            })
        else:
            feed_data = feed_doc.to_dict()
            item_count = len(feed_data.get("items", []))
            users_with_feed.append({
                "id": user_id,
                "name": user_name,
                "items": item_count
            })
    
    print(f"\n✓ {len(users_with_feed)} users have feeds")
    print(f"✗ {len(users_without_feed)} users missing feeds\n")
    
    if users_with_feed:
        print("Users with feeds (sample):")
        for user in users_with_feed[:5]:
            print(f"  ✓ {user['name']} - {user['items']} items")
        if len(users_with_feed) > 5:
            print(f"  ... and {len(users_with_feed) - 5} more")
    
    if users_without_feed:
        print("\nUsers missing feeds:")
        for user in users_without_feed:
            status_emoji = "🔵" if user["status"] in ["trial", "active"] else "⚪"
            print(f"  {status_emoji} {user['name']} ({user['id']}) - {user['status']}")
    
    return users_without_feed


def resume_feeds(date: str | None = None) -> dict:
    """Generate feeds for users who don't have one yet."""
    store = FirestoreStore()
    
    if not date:
        # Use IST (UTC+5:30) for date
        ist_tz = timezone(timedelta(hours=5, minutes=30))
        date = datetime.now(ist_tz).strftime("%Y-%m-%d")
    
    print("=" * 60)
    print(f"RESUMING FEED GENERATION FOR {date}")
    print("=" * 60)
    
    users_without_feed = get_users_without_feed(store, date)
    
    if not users_without_feed:
        print("\n✓ All onboarded users already have feeds!")
        return {
            "users_processed": 0,
            "success_count": 0,
            "error_count": 0
        }
    
    print(f"\n" + "-" * 60)
    print(f"Generating feeds for {len(users_without_feed)} users...")
    print("-" * 60)
    
    success_count = 0
    error_count = 0
    errors = []
    
    for i, user in enumerate(users_without_feed, 1):
        user_id = user["id"]
        user_name = user["name"]
        
        print(f"\n[{i}/{len(users_without_feed)}] Generating feed for {user_name} ({user_id})...")
        
        try:
            result = generate_feed(user_id, date)
            item_count = len(result.get("items", []))
            print(f"  ✓ Generated {item_count} items")
            success_count += 1
        except Exception as e:
            print(f"  ✗ Error: {e}")
            errors.append({"user_id": user_id, "user_name": user_name, "error": str(e)})
            error_count += 1
    
    # Summary
    print("\n" + "=" * 60)
    print("RESUME COMPLETE")
    print("=" * 60)
    print(f"✓ Success: {success_count}/{len(users_without_feed)}")
    print(f"✗ Failed: {error_count}/{len(users_without_feed)}")
    
    if errors:
        print(f"\nErrors:")
        for err in errors:
            print(f"  - {err['user_name']} ({err['user_id']}): {err['error']}")
    
    return {
        "users_processed": len(users_without_feed),
        "success_count": success_count,
        "error_count": error_count,
        "errors": errors
    }


def main():
    parser = argparse.ArgumentParser(description="Resume feed generation for users without feeds")
    parser.add_argument("--date", help="Date string (YYYY-MM-DD), defaults to today in IST")
    args = parser.parse_args()
    
    resume_feeds(date=args.date)


if __name__ == "__main__":
    main()

