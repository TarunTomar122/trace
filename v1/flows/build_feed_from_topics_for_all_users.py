"""
Build topic-based feeds for all subscribed users (trial + active).

Usage:
  python v1/flows/build_feed_from_topics_for_all_users.py
  python v1/flows/build_feed_from_topics_for_all_users.py --limit 10 --skip-seen
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
    profiles = store.get_all_user_profiles()
    onboarded = [p for p in profiles if p.get("onboarded") is True]
    if mode == "unsubscribed":
        return [
            p for p in onboarded
            if p.get("subscriptionStatus") not in ["trial", "active"]
        ]
    subscribed = [
        p for p in onboarded
        if p.get("subscriptionStatus") in ["trial", "active"]
    ]
    unsubscribed = [
        p for p in onboarded
        if p.get("subscriptionStatus") not in ["trial", "active"]
    ]
    return subscribed + unsubscribed


def build_feeds_for_all_users(
    limit: int | None = None,
    skip_seen: bool = False,
    mode: str = "subscribed",
) -> dict:
    store = FirestoreStore()
    users = _get_users(store, mode)
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

    for i, user in enumerate(users, 1):
        user_id = user.get("uid")
        if not user_id:
            continue
        print(f"[{i}/{total}] Building feed for {user_id}...")
        try:
            build_feed_from_topics(user_id, skip_seen=skip_seen)
            success += 1
        except Exception as e:
            failed += 1
            print(f"  Error: {e}")
        time.sleep(0.2)

    return {
        "users_processed": total,
        "success": success,
        "failed": failed,
        "skip_seen": skip_seen,
        "mode": mode,
    }


def main():
    parser = argparse.ArgumentParser(description="Build topic feeds for users")
    parser.add_argument("--limit", type=int, help="Limit number of users to process")
    parser.add_argument("--skip-seen", action="store_true", help="Skip seen URL filtering and updates")
    parser.add_argument(
        "--mode",
        choices=["subscribed", "unsubscribed", "all"],
        default="subscribed",
        help="Which users to process (default: subscribed)",
    )
    args = parser.parse_args()

    result = build_feeds_for_all_users(
        limit=args.limit,
        skip_seen=args.skip_seen,
        mode=args.mode,
    )
    print(f"Done. Users processed: {result['users_processed']}")


if __name__ == "__main__":
    main()

