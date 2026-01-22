"""
Append suggested items to feeds for all subscribed users.

Usage:
  python v1/flows/build_suggested_items_for_all_users.py
  python v1/flows/build_suggested_items_for_all_users.py --limit 10
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
from v1.flows.build_suggested_items_for_user import build_suggested_items_for_user


def build_suggested_items_for_all_users(limit: int | None = None) -> dict:
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
        print(f"[{i}/{total}] Adding suggested items for {user_id}...")
        try:
            result = build_suggested_items_for_user(user_id)
            print(f"  Items added: {result.get('items_added', 0)}")
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
    parser = argparse.ArgumentParser(description="Append suggested items for subscribed users")
    parser.add_argument("--limit", type=int, help="Limit number of users to process")
    args = parser.parse_args()

    result = build_suggested_items_for_all_users(limit=args.limit)
    print(f"Done. Users processed: {result['users_processed']}")


if __name__ == "__main__":
    main()

