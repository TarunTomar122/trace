"""
Build topic-based feeds for all subscribed users (trial + active).

Usage:
  python v1/flows/build_feed_from_topics_for_all_users.py
  python v1/flows/build_feed_from_topics_for_all_users.py --limit 10 --skip-seen
  python v1/flows/build_feed_from_topics_for_all_users.py --user-id USER_ID
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
from v1.flows.build_feed_from_topics import build_feed_from_topics


def _get_users(store: FirestoreStore, mode: str) -> list[dict]:
    if mode == "subscribed":
        return store.get_onboarded_users()
    from v1.storage import is_user_subscribed
    profiles = store.get_all_user_profiles()
    onboarded = [p for p in profiles if p.get("onboarded") is True]
    if mode == "unsubscribed":
        return [p for p in onboarded if not is_user_subscribed(p)]
    subscribed = [p for p in onboarded if is_user_subscribed(p)]
    unsubscribed = [p for p in onboarded if not is_user_subscribed(p)]
    return subscribed + unsubscribed


def build_feeds_for_all_users(
    limit: int | None = None,
    skip_seen: bool = False,
    mode: str = "subscribed",
    user_id: str | None = None,
    force: bool = False,
) -> dict:
    store = FirestoreStore()
    users = [{"uid": user_id}] if user_id else _get_users(store, mode)
    if limit:
        users = users[:limit]

    total = len(users)
    if total == 0:
        if mode == "unsubscribed":
            print("No onboarded unsubscribed users found.")
        elif mode == "all":
            print("No onboarded users found.")
        else:
            print("No subscribed users found.")
        return {"users_processed": 0, "success": 0, "failed": 0}

    success = 0
    failed = 0
    skipped = 0

    for i, user in enumerate(users, 1):
        user_id = user.get("uid")
        if not user_id:
            continue
        print(f"[{i}/{total}] Building feed for {user_id}...")
        try:
            result = build_feed_from_topics(user_id, skip_seen=skip_seen, force=force)
            if result.get("skipped"):
                skipped += 1
                print(f"  Skipped (feed already exists)")
            else:
                items_written = result.get("items_written", 0)
                success += 1
                print(f"  ✓ {items_written} items written")
        except Exception as e:
            failed += 1
            print(f"  Error: {e}")
        time.sleep(0.2)

    return {
        "users_processed": total,
        "success": success,
        "failed": failed,
        "skipped": skipped,
        "skip_seen": skip_seen,
        "mode": mode,
    }


def main():
    parser = argparse.ArgumentParser(description="Build topic feeds for users")
    parser.add_argument("--limit", type=int, help="Limit number of users to process")
    parser.add_argument("--skip-seen", action="store_true", help="Skip seen URL filtering and updates")
    parser.add_argument("--force", action="store_true", help="Force regenerate feeds even if they exist for today")
    parser.add_argument(
        "--mode",
        choices=["subscribed", "unsubscribed", "all"],
        default="subscribed",
        help="Which users to process (default: subscribed)",
    )
    parser.add_argument(
        "--user-id",
        help="Run for a single user instead of all users",
    )
    args = parser.parse_args()

    result = build_feeds_for_all_users(
        limit=args.limit,
        skip_seen=args.skip_seen,
        mode=args.mode,
        user_id=args.user_id,
        force=args.force,
    )
    print(f"Done. Users processed: {result['users_processed']}")


if __name__ == "__main__":
    main()

