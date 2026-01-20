"""
Daily Reflection Job - runs reflection for all subscribed users.

Processes the day's interactions to update tag scores and create personal signals.
Only runs for users with active subscriptions (trial or paid).
Typically runs at 11 PM after users have finished interacting with their feeds.

Usage:
    python v1/run_daily_reflection.py
    python v1/run_daily_reflection.py --date 2026-01-18
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
from v1.core_agents.reflection import run_reflection


def run_daily_reflection(date: str | None = None, limit: int | None = None) -> dict:
    """
    Run reflection for all subscribed users (trial or paid).
    
    Args:
        date: Optional date string (YYYY-MM-DD), defaults to today
        limit: Optional limit on number of users to process
    
    Returns:
        Stats dict with users_processed, total_tags_updated, total_signals_created, etc.
    """
    store = FirestoreStore()
    
    if not date:
        date = datetime.utcnow().strftime("%Y-%m-%d")
    
    start_time = time.time()
    
    # Query all users with active subscriptions
    print(f"Running reflection for {date}...")
    print("Loading subscribed users...")
    
    users = store.get_onboarded_users()  # Now returns users with trial/active subscriptions
    
    total_users = len(users)
    if limit:
        users = users[:limit]
        print(f"Found {total_users} subscribed users (trial + active), processing {len(users)} (limited)")
    else:
        print(f"Found {total_users} subscribed users (trial + active)")
    
    if not users:
        print("No subscribed users found.")
        return {
            "users_processed": 0,
            "success_count": 0,
            "error_count": 0,
            "total_tags_updated": 0,
            "total_signals_created": 0,
            "duration_seconds": 0
        }
    
    print(f"\nRunning reflection for {len(users)} users...")
    print("-" * 50)
    
    success_count = 0
    error_count = 0
    total_tags_updated = 0
    total_signals_created = 0
    total_exclude_tags_added = 0
    total_interactions = 0
    errors = []
    
    for i, user in enumerate(users, 1):
        user_id = user.get("uid", "")
        user_name = user.get("name", user.get("displayName", "Unknown"))
        
        # Progress log
        if len(users) > 10:
            if i % 10 == 0 or i == len(users):
                print(f"Running reflection for {len(users)} users... [{i}/{len(users)}]")
        
        try:
            result = run_reflection(user_id, date)
            
            if result.get("success"):
                success_count += 1
                total_tags_updated += result.get("tags_updated", 0)
                total_signals_created += result.get("signals_created", 0)
                total_exclude_tags_added += result.get("exclude_tags_added", 0)
                total_interactions += result.get("total_interactions", 0)
                
                # Only log if there were interactions
                if result.get("total_interactions", 0) > 0:
                    exclude_info = f", {result.get('exclude_tags_added', 0)} exclude tags" if result.get('exclude_tags_added', 0) > 0 else ""
                    print(f"  [{i}/{len(users)}] {user_name}: {result['tags_updated']} tags, {result['signals_created']} signals{exclude_info}")
            else:
                error_count += 1
                errors.append({"user_id": user_id, "error": result.get("message", "Unknown error")})
                
        except Exception as e:
            error_count += 1
            errors.append({"user_id": user_id, "error": str(e)})
    
    # Summary
    duration = time.time() - start_time
    duration_str = f"{int(duration)}s" if duration < 60 else f"{int(duration // 60)}m {int(duration % 60)}s"
    
    print("\n" + "=" * 50)
    print(f"Reflection complete for {success_count} users in {duration_str}")
    print(f"  Total interactions processed: {total_interactions}")
    print(f"  Total tags updated: {total_tags_updated}")
    print(f"  Total signals created: {total_signals_created}")
    print(f"  Total exclude tags added: {total_exclude_tags_added}")
    
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
        "total_tags_updated": total_tags_updated,
        "total_signals_created": total_signals_created,
        "total_exclude_tags_added": total_exclude_tags_added,
        "total_interactions": total_interactions,
        "duration_seconds": duration,
        "date": date
    }


def main():
    parser = argparse.ArgumentParser(description="Run daily reflection for all users")
    parser.add_argument("--date", help="Date string (YYYY-MM-DD), defaults to today")
    parser.add_argument("--limit", type=int, help="Limit number of users to process")
    args = parser.parse_args()
    
    run_daily_reflection(date=args.date, limit=args.limit)


if __name__ == "__main__":
    main()

