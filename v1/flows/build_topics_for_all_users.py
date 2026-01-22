"""
Build topic pools for all subscribed users (trial + active).

Usage:
  python v1/flows/build_topics_for_all_users.py
  python v1/flows/build_topics_for_all_users.py --limit 10
"""

import argparse
import sys
from datetime import datetime, timedelta
import time
from pathlib import Path

project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent.parent / ".env")

from v1.storage import FirestoreStore
from v1.flows.build_topics_for_user import build_topics_for_user


def _should_run(store: FirestoreStore, min_days: int = 5) -> bool:
    doc_ref = store.db.collection("job_runs").document("topics_build")
    doc = doc_ref.get()
    if not doc.exists:
        return True
    last_run = (doc.to_dict() or {}).get("last_run")
    if not last_run:
        return True
    try:
        last_dt = datetime.fromisoformat(last_run.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return True
    return datetime.utcnow() - last_dt >= timedelta(days=min_days)


def _mark_run(store: FirestoreStore) -> None:
    doc_ref = store.db.collection("job_runs").document("topics_build")
    doc_ref.set({"last_run": datetime.utcnow().isoformat()}, merge=True)


def build_topics_for_all_users(limit: int | None = None) -> dict:
    store = FirestoreStore()
    if not _should_run(store):
        print("Skipping topics build (last run < 5 days ago).")
        return {"users_processed": 0, "success": 0, "failed": 0, "skipped": True}

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
            build_topics_for_user(user_id)
            success += 1
        except Exception as e:
            failed += 1
            print(f"  Error: {e}")
        time.sleep(0.2)

    _mark_run(store)

    return {
        "users_processed": total,
        "success": success,
        "failed": failed,
        "skipped": False,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Build topics for all subscribed users"
    )
    parser.add_argument("--limit", type=int, help="Limit number of users to process")
    args = parser.parse_args()

    result = build_topics_for_all_users(limit=args.limit)
    print(f"Done. Users processed: {result['users_processed']}")


if __name__ == "__main__":
    main()
