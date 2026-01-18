"""
Cleanup Expired Signals - removes expired personal signals from all users.

Queries user_patterns for all users and removes signals where expires_at < now.
Typically runs daily at 11:30 PM after reflection.

Usage:
    python v1/scripts/cleanup_expired_signals.py
"""
import argparse
import sys
import time
from datetime import datetime
from pathlib import Path

project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env")

from v1.storage import FirestoreStore


def cleanup_expired_signals(dry_run: bool = False) -> dict:
    """
    Remove expired personal signals from all users.
    
    Args:
        dry_run: If True, just report what would be cleaned without modifying
    
    Returns:
        Stats dict with users_processed, signals_removed, etc.
    """
    store = FirestoreStore()
    
    start_time = time.time()
    now = datetime.utcnow()
    
    print(f"Cleaning up expired signals (cutoff: {now.isoformat()})...")
    if dry_run:
        print("  DRY RUN - no changes will be made")
    
    # Query all user_patterns documents
    patterns_docs = store.db.collection("user_patterns").stream()
    
    users_processed = 0
    users_with_signals = 0
    users_updated = 0
    total_signals_before = 0
    total_signals_removed = 0
    
    for doc in patterns_docs:
        users_processed += 1
        user_id = doc.id
        data = doc.to_dict() or {}
        
        signals = data.get("personal_signals", [])
        if not signals:
            continue
        
        users_with_signals += 1
        total_signals_before += len(signals)
        
        # Filter out expired signals
        active_signals = []
        removed_count = 0
        
        for signal in signals:
            expires_at_str = signal.get("expires_at", "")
            if not expires_at_str:
                # Keep signals without expiry (shouldn't happen but safe)
                active_signals.append(signal)
                continue
            
            try:
                expires_at = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
                if expires_at.tzinfo:
                    expires_at = expires_at.replace(tzinfo=None)
                
                if expires_at > now:
                    active_signals.append(signal)
                else:
                    removed_count += 1
            except (ValueError, TypeError):
                # Keep signals with invalid dates
                active_signals.append(signal)
        
        if removed_count > 0:
            total_signals_removed += removed_count
            users_updated += 1
            
            if not dry_run:
                # Update user_patterns with cleaned signals
                store.db.collection("user_patterns").document(user_id).update({
                    "personal_signals": active_signals,
                    "signals_last_cleaned": now.isoformat()
                })
    
    duration = time.time() - start_time
    
    print(f"\nCleanup complete:")
    print(f"  Users processed: {users_processed}")
    print(f"  Users with signals: {users_with_signals}")
    print(f"  Users updated: {users_updated}")
    print(f"  Signals before: {total_signals_before}")
    print(f"  Signals removed: {total_signals_removed}")
    print(f"  Signals remaining: {total_signals_before - total_signals_removed}")
    print(f"  Duration: {duration:.2f}s")
    
    if dry_run:
        print("\n  (DRY RUN - no changes were made)")
    else:
        print(f"\nCleaned {total_signals_removed} expired signals from {users_updated} users")
    
    return {
        "users_processed": users_processed,
        "users_with_signals": users_with_signals,
        "users_updated": users_updated,
        "signals_before": total_signals_before,
        "signals_removed": total_signals_removed,
        "signals_remaining": total_signals_before - total_signals_removed,
        "duration_seconds": duration,
        "dry_run": dry_run
    }


def main():
    parser = argparse.ArgumentParser(description="Cleanup expired personal signals")
    parser.add_argument("--dry-run", action="store_true", help="Report what would be cleaned without modifying")
    args = parser.parse_args()
    
    cleanup_expired_signals(dry_run=args.dry_run)


if __name__ == "__main__":
    main()

