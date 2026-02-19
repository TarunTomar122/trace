"""
Migrate user profiles to canonical interest_ids / interest_queries schema.

Usage:
  python v1/scripts/migrate_interest_schema.py
  python v1/scripts/migrate_interest_schema.py --dry-run
  python v1/scripts/migrate_interest_schema.py --limit 10
  python v1/scripts/migrate_interest_schema.py --user-id USER_ID
"""

import argparse
import sys
from pathlib import Path

project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from dotenv import load_dotenv  # noqa: E402

load_dotenv(Path(__file__).parent.parent.parent / ".env")

from v1.storage import FirestoreStore  # noqa: E402
from v1.algorithm.interest_schema import (  # noqa: E402
    get_interest_ids,
    get_interest_queries,
    SUBTOPIC_LABELS,
)


def _clean_interest_queries(
    interest_queries: dict[str, list[str]],
    interest_ids: list[str],
) -> dict[str, list[str]]:
    if not interest_queries:
        return {}
    allowed = set(interest_ids)
    cleaned: dict[str, list[str]] = {}
    for key, values in interest_queries.items():
        if key not in allowed:
            continue
        subtopic_map = SUBTOPIC_LABELS.get(key, {})
        valid_ids = set(subtopic_map.keys())
        label_to_id = {label.lower(): sid for sid, label in subtopic_map.items()}
        deduped = []
        seen = set()
        for value in values[:2]:
            if not isinstance(value, str) or not value.strip():
                continue
            value = value.strip()
            normalized = value.lower()
            if normalized in label_to_id:
                value = label_to_id[normalized]
            if value not in valid_ids:
                continue
            if value in seen:
                continue
            seen.add(value)
            deduped.append(value)
        if deduped:
            cleaned[key] = deduped
    return cleaned


def migrate_user_profile(
    store: FirestoreStore,
    user_id: str,
    dry_run: bool = False,
) -> dict:
    profile = store.get_user_profile(user_id)
    if not profile:
        raise ValueError(f"User {user_id} not found")

    raw_interests = profile.get("interests", []) or []
    interest_ids = get_interest_ids(profile)
    interest_queries = _clean_interest_queries(
        get_interest_queries(profile),
        interest_ids,
    )

    updates: dict = {
        "interest_ids": interest_ids,
        "interest_queries": interest_queries,
        "interestQueries": interest_queries,
    }

    if raw_interests and raw_interests != interest_ids:
        updates["legacy_interests"] = raw_interests
        updates["interests"] = interest_ids
    elif interest_ids and not raw_interests:
        updates["interests"] = interest_ids

    if dry_run:
        return {
            "user_id": user_id,
            "updates": updates,
            "dry_run": True,
        }

    store.db.collection("user_profiles").document(user_id).update(updates)
    return {
        "user_id": user_id,
        "updates": updates,
        "dry_run": False,
    }


def migrate_all_users(
    limit: int | None = None,
    user_id: str | None = None,
    dry_run: bool = False,
) -> dict:
    store = FirestoreStore()
    if user_id:
        users = [{"uid": user_id}]
    else:
        users = store.get_all_user_profiles()
        if limit:
            users = users[:limit]

    total = len(users)
    updated = 0
    failed = 0

    for idx, user in enumerate(users, 1):
        uid = user.get("uid")
        if not uid:
            continue
        print(f"[{idx}/{total}] Migrating {uid}...")
        try:
            result = migrate_user_profile(store, uid, dry_run=dry_run)
            updated += 1
            if dry_run:
                print(f"  Dry run updates: {result.get('updates')}")
        except Exception as e:
            failed += 1
            print(f"  Error: {e}")

    return {
        "users_processed": total,
        "updated": updated,
        "failed": failed,
        "dry_run": dry_run,
    }


def main():
    parser = argparse.ArgumentParser(description="Migrate interest schema for users")
    parser.add_argument("--limit", type=int, help="Limit number of users to process")
    parser.add_argument("--user-id", help="Run for a single user")
    parser.add_argument("--dry-run", action="store_true", help="Preview updates without writing")
    args = parser.parse_args()

    result = migrate_all_users(
        limit=args.limit,
        user_id=args.user_id,
        dry_run=args.dry_run,
    )
    print(f"Done. Users processed: {result['users_processed']}")


if __name__ == "__main__":
    main()

