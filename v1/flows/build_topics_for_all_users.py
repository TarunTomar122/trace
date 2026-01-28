"""
Build topic pools for all subscribed users (trial + active).
Skips any topic refreshed within the last N days.

Usage:
  python v1/flows/build_topics_for_all_users.py
  python v1/flows/build_topics_for_all_users.py --limit 10
  python v1/flows/build_topics_for_all_users.py --min-refresh-days 5
"""

import argparse
import sys
import time
from pathlib import Path

project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from dotenv import load_dotenv  # noqa: E402

load_dotenv(Path(__file__).parent.parent.parent / ".env")

from v1.storage import FirestoreStore  # noqa: E402
from v1.flows.build_topics_for_user import (  # noqa: E402
    build_topics_for_user,
)


def build_topics_for_all_users(
    limit: int | None = None,
    min_refresh_days: int = 4,
) -> dict:
    store = FirestoreStore()
    users = store.get_onboarded_users()
    if limit:
        users = users[:limit]

    total = len(users)
    if total == 0:
        print("No subscribed users found.")
        return {"users_processed": 0, "success": 0, "failed": 0}

    success = 0
    failed = 0

    for i, user in enumerate(users, 1):
        user_id = user.get("uid")
        if not user_id:
            continue
        print(f"[{i}/{total}] Building topics for {user_id}...")
        try:
            result = build_topics_for_user(
                user_id,
                min_refresh_days=min_refresh_days,
            )
            print(
                "  Result: "
                f"built={result.get('topics_written', 0)}, "
                f"skipped={result.get('topics_skipped', 0)}"
            )
            success += 1
        except Exception as e:
            failed += 1
            print(f"  Error: {e}")
        time.sleep(0.2)

    return {
        "users_processed": total,
        "success": success,
        "failed": failed,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Build topics for all subscribed users"
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Limit number of users to process",
    )
    parser.add_argument(
        "--min-refresh-days",
        type=int,
        default=5,
        help="Skip topics refreshed within this many days",
    )
    args = parser.parse_args()

    result = build_topics_for_all_users(
        limit=args.limit,
        min_refresh_days=args.min_refresh_days,
    )
    print(f"Done. Users processed: {result['users_processed']}")


if __name__ == "__main__":
    main()
