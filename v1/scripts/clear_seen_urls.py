"""
Clear seen URLs for users - useful for fixing deduplication issues.

Usage:
    python v1/scripts/clear_seen_urls.py --user_id USER_ID
    python v1/scripts/clear_seen_urls.py --all  # Clear for all users
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


def clear_user_seen_urls(store: FirestoreStore, user_id: str):
    """Clear seen URLs for a specific user."""
    try:
        doc_ref = store.db.collection("user_seen_urls").document(user_id)
        doc_ref.delete()
        print(f"✓ Cleared seen URLs for {user_id}")
    except Exception as e:
        print(f"✗ Error clearing seen URLs for {user_id}: {e}")


def main():
    parser = argparse.ArgumentParser(description="Clear seen URLs for users")
    parser.add_argument("--user_id", help="User ID to clear seen URLs for")
    parser.add_argument("--all", action="store_true", help="Clear for all users")
    args = parser.parse_args()
    
    if not args.user_id and not args.all:
        print("Error: Must specify --user_id or --all")
        sys.exit(1)
    
    store = FirestoreStore()
    
    if args.all:
        print("Clearing seen URLs for all users...")
        docs = store.db.collection("user_seen_urls").stream()
        count = 0
        for doc in docs:
            clear_user_seen_urls(store, doc.id)
            count += 1
        print(f"\n✓ Cleared seen URLs for {count} users")
    else:
        print(f"Clearing seen URLs for user {args.user_id}...")
        clear_user_seen_urls(store, args.user_id)


if __name__ == "__main__":
    main()

