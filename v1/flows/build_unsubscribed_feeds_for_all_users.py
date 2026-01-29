"""
Build topic-based feeds for all unsubscribed onboarded users using LLM matching.

Usage:
  python v1/flows/build_unsubscribed_feeds_for_all_users.py
  python v1/flows/build_unsubscribed_feeds_for_all_users.py --limit 10 --skip-seen
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
from v1.flows.build_unsubscribed_feed_from_topics import build_unsubscribed_feed


def build_unsubscribed_feeds(
    limit: int | None = None,
    skip_seen: bool = False,
    start_index: int = 0,
    start_after: str | None = None,
) -> dict:
    store = FirestoreStore()
    profiles = store.get_all_user_profiles()
    users = [
        p for p in profiles
        if p.get("onboarded") is True
        and p.get("subscriptionStatus") not in ["trial", "active"]
    ]
    users = sorted(users, key=lambda u: u.get("uid", ""))

    if start_after:
        start_idx = next(
            (
                i + 1
                for i, u in enumerate(users)
                if u.get("uid") == start_after
            ),
            0,
        )
    else:
        start_idx = max(0, start_index)

    if start_idx:
        users = users[start_idx:]

    if limit:
        users = users[:limit]

    total = len(users)
    if total == 0:
        print("No onboarded unsubscribed users found.")
        return {"users_processed": 0, "success": 0, "failed": 0}

    success = 0
    failed = 0
    skipped = 0

    for i, user in enumerate(users, 1):
        user_id = user.get("uid")
        if not user_id:
            continue
        print(f"[{i}/{total}] Building unsubscribed feed for {user_id}...")
        try:
            result = build_unsubscribed_feed(user_id, skip_seen=skip_seen)
            if result.get("skipped"):
                skipped += 1
                print(f"  Skipped (feed already exists)")
            else:
                print(f"  Items written: {result.get('items_written', 0)}")
                success += 1
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
        "start_index": start_idx,
    }


def main():
    parser = argparse.ArgumentParser(description="Build feeds for unsubscribed users")
    parser.add_argument("--limit", type=int, help="Limit number of users to process")
    parser.add_argument(
        "--start-index",
        type=int,
        default=0,
        help="Start processing from this index (0-based) after sorting by uid",
    )
    parser.add_argument(
        "--start-after",
        help="Start after this user_id (after sorting by uid)",
    )
    parser.add_argument(
        "--skip-seen",
        action="store_true",
        help="Skip seen URL filtering and updates",
    )
    args = parser.parse_args()

    result = build_unsubscribed_feeds(
        limit=args.limit,
        skip_seen=args.skip_seen,
        start_index=args.start_index,
        start_after=args.start_after,
    )
    print(f"Done. Users processed: {result['users_processed']}")


if __name__ == "__main__":
    main()

