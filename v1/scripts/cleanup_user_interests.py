"""
Cleanup script to normalize interests for all existing users.

This script:
1. Fetches all user profiles with interests/hobbies
2. Normalizes their interests using LLM semantic matching
3. Updates their profiles with normalized interests
4. Optionally identifies orphaned topics for cleanup

Usage:
    python v1/scripts/cleanup_user_interests.py
    python v1/scripts/cleanup_user_interests.py --dry-run
    python v1/scripts/cleanup_user_interests.py --limit 5
    python v1/scripts/cleanup_user_interests.py --show-orphans
"""
import argparse
import sys
import time
from collections import Counter
from pathlib import Path

project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env")

from v1.storage import FirestoreStore
from v1.flows.normalize_user_interests import (
    normalize_user_interests,
    update_user_profile_interests,
    get_existing_topics,
)


def get_all_users_with_interests(store: FirestoreStore) -> list[dict]:
    """Fetch all user profiles that have interests or hobbies."""
    docs = store.db.collection("user_profiles").stream()
    users = []
    for doc in docs:
        data = doc.to_dict() or {}
        interests = data.get("interests", []) or []
        hobbies = data.get("hobbies", []) or []
        if interests or hobbies:
            users.append({
                "uid": doc.id,
                "interests": interests,
                "hobbies": hobbies,
                "name": data.get("name", "Unknown"),
            })
    return users


def get_all_topic_ids(store: FirestoreStore) -> set[str]:
    """Get all topic IDs from the topics collection."""
    docs = store.db.collection("topics").stream()
    return {doc.id for doc in docs}


def find_orphaned_topics(
    store: FirestoreStore,
    normalized_topic_ids: set[str],
) -> list[str]:
    """
    Find topics that no user references after normalization.

    Args:
        store: FirestoreStore instance
        normalized_topic_ids: Set of topic IDs that users now reference

    Returns:
        List of orphaned topic IDs
    """
    all_topics = get_all_topic_ids(store)
    orphaned = all_topics - normalized_topic_ids
    return sorted(orphaned)


def cleanup_user_interests(
    dry_run: bool = False,
    limit: int | None = None,
    show_orphans: bool = False,
) -> dict:
    """
    Normalize interests for all existing users.

    Args:
        dry_run: If True, don't actually update profiles
        limit: Max number of users to process
        show_orphans: If True, show orphaned topics at the end

    Returns:
        Summary dict
    """
    store = FirestoreStore()

    print("=" * 60)
    print("CLEANUP USER INTERESTS")
    print("=" * 60)
    if dry_run:
        print("DRY RUN - no changes will be made\n")

    # Get all users with interests
    print("Fetching users with interests/hobbies...")
    users = get_all_users_with_interests(store)
    print(f"Found {len(users)} users with interests/hobbies\n")

    # Fetch existing topics ONCE
    print("Fetching existing topics...")
    existing_topics = get_existing_topics(store)
    print(f"Found {len(existing_topics)} existing topics\n")

    if limit:
        users = users[:limit]
        print(f"Processing first {limit} users\n")

    # Track stats
    users_processed = 0
    users_updated = 0
    users_skipped = 0
    total_interests_before = 0
    total_interests_after = 0
    all_normalized_topic_ids: set[str] = set()
    topic_usage: Counter = Counter()

    for i, user in enumerate(users, 1):
        uid = user["uid"]
        name = user["name"]
        interests = user["interests"]
        hobbies = user["hobbies"]

        print(f"[{i}/{len(users)}] Processing {name} ({uid})")
        print(f"  Current: {len(interests)} interests, {len(hobbies)} hobbies")

        total_interests_before += len(interests) + len(hobbies)

        try:
            # Normalize (pass pre-fetched topics to avoid repeated DB calls)
            normalized = normalize_user_interests(
                interests=interests,
                hobbies=hobbies,
                store=store,
                existing_topics=existing_topics,
            )

            new_interests = normalized["interests"]
            new_hobbies = normalized["hobbies"]

            # Track topic IDs for orphan detection
            for m in normalized["interest_mappings"]:
                tid = m.get("normalized_id")
                if tid:
                    all_normalized_topic_ids.add(tid)
                    topic_usage[tid] += 1
            for m in normalized["hobby_mappings"]:
                tid = m.get("normalized_id")
                if tid:
                    all_normalized_topic_ids.add(tid)
                    topic_usage[tid] += 1

            total_interests_after += len(new_interests) + len(new_hobbies)

            # Check if anything changed
            if set(interests) == set(new_interests) and set(hobbies) == set(new_hobbies):
                print("  No changes needed")
                users_skipped += 1
            else:
                print(f"  Normalized: {len(new_interests)} interests, {len(new_hobbies)} hobbies")

                if not dry_run:
                    update_user_profile_interests(
                        user_id=uid,
                        normalized_interests=new_interests,
                        normalized_hobbies=new_hobbies,
                        store=store,
                    )
                users_updated += 1

            users_processed += 1

        except Exception as e:
            print(f"  Error: {e}")

        # Small delay to avoid rate limits
        time.sleep(0.5)
        print()

    # Summary
    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Users processed: {users_processed}")
    print(f"Users updated: {users_updated}")
    print(f"Users skipped (no changes): {users_skipped}")
    print(f"Total interests before: {total_interests_before}")
    print(f"Total interests after: {total_interests_after}")
    print(f"Unique topics after normalization: {len(all_normalized_topic_ids)}")

    # Show most used topics
    print("\nTop 20 topics by usage:")
    for topic_id, count in topic_usage.most_common(20):
        print(f"  {topic_id}: {count} users")

    # Show orphaned topics
    if show_orphans:
        print("\n" + "=" * 60)
        print("ORPHANED TOPICS (no longer referenced by any user)")
        print("=" * 60)
        orphaned = find_orphaned_topics(store, all_normalized_topic_ids)
        if orphaned:
            print(f"Found {len(orphaned)} orphaned topics:")
            for tid in orphaned:
                print(f"  - {tid}")
            print("\nTo delete these, run:")
            print("  python v1/scripts/delete_orphaned_topics.py")
        else:
            print("No orphaned topics found.")

    return {
        "users_processed": users_processed,
        "users_updated": users_updated,
        "users_skipped": users_skipped,
        "interests_before": total_interests_before,
        "interests_after": total_interests_after,
        "unique_topics": len(all_normalized_topic_ids),
        "orphaned_topics": len(find_orphaned_topics(store, all_normalized_topic_ids)) if show_orphans else 0,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Normalize interests for all existing users"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Don't actually update profiles, just show what would change",
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Limit number of users to process",
    )
    parser.add_argument(
        "--show-orphans",
        action="store_true",
        help="Show orphaned topics at the end",
    )

    args = parser.parse_args()

    cleanup_user_interests(
        dry_run=args.dry_run,
        limit=args.limit,
        show_orphans=args.show_orphans,
    )


if __name__ == "__main__":
    main()
