"""
Migrate existing users to v1 schema.

Runs init_umbrellas.py first, then map_users_to_queries.py,
and finally generates initial feeds for all existing users.

This script is idempotent - safe to run multiple times.

Usage:
    python v1/scripts/migrate_existing_users.py
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

from v1.scripts.init_umbrellas import init_umbrellas
from v1.scripts.map_users_to_queries import map_users_to_queries
from v1.run_user_feeds import run_user_feeds
from v1.storage import FirestoreStore


def migrate_existing_users(skip_feeds: bool = False, limit: int | None = None) -> dict:
    """
    Migrate all existing users to v1 schema.
    
    Steps:
    1. Initialize umbrellas from user interests
    2. Map users to queries
    3. Generate initial feeds for all users
    
    Args:
        skip_feeds: If True, skip feed generation (faster for testing)
        limit: Optional limit on number of users to generate feeds for
    
    Returns:
        Stats dict with migration results
    """
    store = FirestoreStore()
    start_time = time.time()
    
    print("=" * 60)
    print("MIGRATING EXISTING USERS TO V1 SCHEMA")
    print("=" * 60)
    
    # Count users
    users_ref = store.db.collection("user_profiles").where("onboarded", "==", True)
    total_users = len(list(users_ref.stream()))
    print(f"\nFound {total_users} onboarded users to migrate")
    
    # Step 1: Initialize umbrellas
    print("\n" + "-" * 60)
    print("STEP 1: Initializing umbrellas from user interests")
    print("-" * 60)
    
    umbrellas_created = init_umbrellas()
    
    # Step 2: Map users to queries
    print("\n" + "-" * 60)
    print("STEP 2: Mapping users to queries")
    print("-" * 60)
    
    mapping_stats = map_users_to_queries()
    
    # Step 3: Generate feeds
    feeds_stats = {"users_processed": 0, "success_count": 0, "error_count": 0}
    
    if not skip_feeds:
        print("\n" + "-" * 60)
        print("STEP 3: Generating initial feeds for all users")
        print("-" * 60)
        
        feeds_stats = run_user_feeds(limit=limit)
    else:
        print("\n[Skipping feed generation (--skip-feeds)]")
    
    # Summary
    duration = time.time() - start_time
    duration_str = f"{int(duration // 60)}m {int(duration % 60)}s"
    
    print("\n" + "=" * 60)
    print("MIGRATION COMPLETE")
    print("=" * 60)
    print(f"\nMigrated {total_users} existing users to v1 schema")
    print(f"  - Umbrellas created: {len(umbrellas_created)}")
    print(f"  - Users mapped: {mapping_stats.get('users_mapped', 0)}")
    print(f"  - Active queries: {mapping_stats.get('queries_active', 0)}")
    print(f"  - Feeds generated: {feeds_stats.get('success_count', 0)}/{feeds_stats.get('users_processed', 0)}")
    print(f"  - Total time: {duration_str}")
    
    return {
        "total_users": total_users,
        "umbrellas_created": len(umbrellas_created),
        "users_mapped": mapping_stats.get("users_mapped", 0),
        "queries_active": mapping_stats.get("queries_active", 0),
        "feeds_generated": feeds_stats.get("success_count", 0),
        "feeds_errors": feeds_stats.get("error_count", 0),
        "duration_seconds": duration
    }


def main():
    parser = argparse.ArgumentParser(description="Migrate existing users to v1 schema")
    parser.add_argument("--skip-feeds", action="store_true", help="Skip feed generation")
    parser.add_argument("--limit", type=int, help="Limit number of users for feed generation")
    args = parser.parse_args()
    
    migrate_existing_users(skip_feeds=args.skip_feeds, limit=args.limit)


if __name__ == "__main__":
    main()

