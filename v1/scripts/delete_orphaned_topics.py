"""
Delete orphaned topics that are no longer referenced by any user.

Run this AFTER cleanup_user_interests.py to remove topics that
no user references anymore.

Usage:
    python v1/scripts/delete_orphaned_topics.py --dry-run
    python v1/scripts/delete_orphaned_topics.py
"""
import argparse
import sys
from pathlib import Path

project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env")

from v1.storage import FirestoreStore
from v1.algorithm.interest_schema import get_interest_ids


def _normalize_topic_id(name: str) -> str:
    """Basic string normalization for topic IDs."""
    return (
        name.lower()
        .strip()
        .replace(" ", "-")
        .replace("&", "and")
        .replace("/", "-")
        .replace("\\", "-")
        .replace("(", "")
        .replace(")", "")
        .replace(".", "")
        .replace(",", "")
    )


def get_user_referenced_topics(store: FirestoreStore) -> set[str]:
    """Get all topic IDs that users reference in their interests/hobbies."""
    docs = store.db.collection("user_profiles").stream()
    referenced = set()
    for doc in docs:
        data = doc.to_dict() or {}
        interests = get_interest_ids(data)
        hobbies = data.get("hobbies", []) or []
        for i in interests:
            if isinstance(i, str):
                referenced.add(_normalize_topic_id(i))
        for h in hobbies:
            if isinstance(h, str):
                referenced.add(_normalize_topic_id(h))
    return referenced


def get_all_topics(store: FirestoreStore) -> list[dict]:
    """Get all topics from the topics collection."""
    docs = store.db.collection("topics").stream()
    topics = []
    for doc in docs:
        data = doc.to_dict() or {}
        topics.append({
            "topic_id": doc.id,
            "display_name": data.get("display_name", doc.id),
            "topic_kind": data.get("topic_kind"),
        })
    return topics


def delete_orphaned_topics(dry_run: bool = False, force: bool = False) -> dict:
    """
    Delete topics that no user references.

    Args:
        dry_run: If True, don't actually delete, just show what would be deleted

    Returns:
        Summary dict
    """
    store = FirestoreStore()

    print("=" * 60)
    print("DELETE ORPHANED TOPICS")
    print("=" * 60)
    if dry_run:
        print("DRY RUN - no changes will be made\n")

    # Get referenced topics from users
    print("Scanning user profiles for referenced topics...")
    referenced = get_user_referenced_topics(store)
    print(f"Found {len(referenced)} unique topics referenced by users\n")

    # Get all topics
    print("Fetching all topics...")
    all_topics = get_all_topics(store)
    print(f"Found {len(all_topics)} total topics\n")

    # Find orphaned
    orphaned = [t for t in all_topics if t["topic_id"] not in referenced]

    if not orphaned:
        print("No orphaned topics found. All topics are referenced by at least one user.")
        return {"deleted": 0, "total": len(all_topics)}

    print(f"Found {len(orphaned)} orphaned topics:\n")
    for t in orphaned:
        print(f"  - {t['topic_id']} ({t['display_name']})")

    if dry_run:
        print(f"\nDRY RUN: Would delete {len(orphaned)} topics")
        return {"deleted": 0, "would_delete": len(orphaned), "total": len(all_topics)}

    # Confirm deletion
    if not force:
        print(f"\nAbout to delete {len(orphaned)} topics.")
        confirm = input("Type 'yes' to confirm: ")
        if confirm.lower() != "yes":
            print("Aborted.")
            return {"deleted": 0, "total": len(all_topics)}

    # Delete
    print("\nDeleting orphaned topics...")
    deleted = 0
    for t in orphaned:
        try:
            store.db.collection("topics").document(t["topic_id"]).delete()
            print(f"  Deleted: {t['topic_id']}")
            deleted += 1
        except Exception as e:
            print(f"  Error deleting {t['topic_id']}: {e}")

    print(f"\nDeleted {deleted} orphaned topics.")
    return {"deleted": deleted, "total": len(all_topics)}


def main():
    parser = argparse.ArgumentParser(
        description="Delete orphaned topics not referenced by any user"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Don't actually delete, just show what would be deleted",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Skip confirmation prompt",
    )

    args = parser.parse_args()
    delete_orphaned_topics(dry_run=args.dry_run, force=args.force)


if __name__ == "__main__":
    main()
