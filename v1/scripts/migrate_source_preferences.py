"""
Migrate user sourcePreferences from 0-100 scale to 0-10 scale.

This script updates all existing users' sourcePreferences values by dividing by 10
to convert from the old percentage scale (0-100) to the new preference level scale (0-10).

Usage:
    python v1/scripts/migrate_source_preferences.py [--dry-run]
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


def migrate_source_preferences(dry_run: bool = False) -> dict:
    """
    Migrate all users' sourcePreferences from 0-100 to 0-10 scale.
    
    Args:
        dry_run: If True, only print what would be changed without saving
    
    Returns:
        Dict with migration stats
    """
    store = FirestoreStore()
    
    print("=" * 80)
    print("MIGRATE SOURCE PREFERENCES: 0-100 → 0-10 Scale")
    print("=" * 80)
    print()
    
    if dry_run:
        print("🔍 DRY RUN MODE - No changes will be saved")
        print()
    
    stats = {
        "total_users": 0,
        "users_migrated": 0,
        "users_skipped": 0,
        "users_with_new_scale": 0,
        "errors": 0
    }
    
    # Get all users
    users_ref = store.db.collection("user_profiles")
    users_docs = users_ref.stream()
    
    for user_doc in users_docs:
        stats["total_users"] += 1
        user_id = user_doc.id
        user_data = user_doc.to_dict()
        
        source_prefs = user_data.get("sourcePreferences")
        
        # Skip if no sourcePreferences
        if not source_prefs:
            stats["users_skipped"] += 1
            continue
        
        # Check if already on new scale (all values <= 10)
        max_value = max(source_prefs.values())
        if max_value <= 10:
            print(f"✓ {user_data.get('name', 'Unknown')} ({user_id[:8]}...): Already on 0-10 scale")
            stats["users_with_new_scale"] += 1
            continue
        
        # Migrate: divide all values by 10 and round
        old_prefs = source_prefs.copy()
        new_prefs = {
            key: round(value / 10)
            for key, value in source_prefs.items()
        }
        
        print(f"📝 {user_data.get('name', 'Unknown')} ({user_id[:8]}...):")
        print(f"   OLD: {old_prefs}")
        print(f"   NEW: {new_prefs}")
        
        if not dry_run:
            try:
                users_ref.document(user_id).update({
                    "sourcePreferences": new_prefs
                })
                print(f"   ✓ Saved")
                stats["users_migrated"] += 1
            except Exception as e:
                print(f"   ✗ Error: {e}")
                stats["errors"] += 1
        else:
            print(f"   (would save)")
            stats["users_migrated"] += 1
        
        print()
    
    # Print summary
    print()
    print("=" * 80)
    print("MIGRATION SUMMARY")
    print("=" * 80)
    print(f"Total users:                {stats['total_users']}")
    print(f"Users migrated:             {stats['users_migrated']}")
    print(f"Users already on 0-10:      {stats['users_with_new_scale']}")
    print(f"Users skipped (no prefs):   {stats['users_skipped']}")
    print(f"Errors:                     {stats['errors']}")
    print()
    
    if dry_run:
        print("🔍 This was a DRY RUN - no changes were saved")
        print("   Run without --dry-run to apply changes")
    else:
        print("✅ Migration complete!")
    
    print()
    
    return stats


def main():
    parser = argparse.ArgumentParser(
        description="Migrate sourcePreferences from 0-100 to 0-10 scale"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be changed without saving"
    )
    
    args = parser.parse_args()
    
    try:
        stats = migrate_source_preferences(dry_run=args.dry_run)
        
        if stats["errors"] > 0:
            sys.exit(1)
        
    except KeyboardInterrupt:
        print("\n\n⚠️  Migration interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

