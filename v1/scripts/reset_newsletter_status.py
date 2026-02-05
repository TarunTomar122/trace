"""
Reset newsletter status from 'sent' or 'failed' back to 'draft' so they can be resent.

Usage:
    python v1/scripts/reset_newsletter_status.py --date 2026-02-04
    python v1/scripts/reset_newsletter_status.py --date 2026-02-04 --user_id USER_ID
    python v1/scripts/reset_newsletter_status.py --all-today  # Reset all for today
"""
import argparse
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env")

from v1.storage import FirestoreStore


def _get_today_ist_date() -> str:
    """Get today's date in IST timezone."""
    ist_tz = timezone(timedelta(hours=5, minutes=30))
    return datetime.now(ist_tz).strftime("%Y-%m-%d")


def reset_newsletter_status(user_id: str, date: str):
    """Reset a single newsletter status to draft."""
    store = FirestoreStore()
    
    doc_ref = store.db.collection("user_newsletters").document(user_id).collection("daily").document(date)
    doc = doc_ref.get()
    
    if not doc.exists:
        print(f"❌ Newsletter not found for user {user_id} on {date}")
        return False
    
    data = doc.to_dict()
    current_status = data.get("status", "unknown")
    
    print(f"User {user_id} - {date}: {current_status} → draft")
    
    doc_ref.update({
        "status": "draft",
        "sent_at": None,
        "error": None,
    })
    
    return True


def reset_all_newsletters(date: str, from_status: str = None):
    """Reset all newsletters for a given date."""
    store = FirestoreStore()
    
    # Get all user profiles
    profiles = store.db.collection("user_profiles").stream()
    
    reset_count = 0
    skip_count = 0
    
    for profile_doc in profiles:
        user_id = profile_doc.id
        
        # Check if newsletter exists for this date
        newsletter_ref = store.db.collection("user_newsletters").document(user_id).collection("daily").document(date)
        newsletter_doc = newsletter_ref.get()
        
        if not newsletter_doc.exists:
            continue
        
        data = newsletter_doc.to_dict()
        current_status = data.get("status", "unknown")
        
        # Skip if status filter is set and doesn't match
        if from_status and current_status != from_status:
            skip_count += 1
            continue
        
        # Reset to draft
        print(f"  {user_id}: {current_status} → draft")
        newsletter_ref.update({
            "status": "draft",
            "sent_at": None,
            "error": None,
        })
        reset_count += 1
    
    print(f"\n✅ Reset {reset_count} newsletters to draft")
    if skip_count > 0:
        print(f"⏭️  Skipped {skip_count} newsletters")


def main():
    parser = argparse.ArgumentParser(description="Reset newsletter status to draft for resending")
    parser.add_argument("--date", help="Date (YYYY-MM-DD)")
    parser.add_argument("--user_id", help="Specific user ID (optional)")
    parser.add_argument("--all-today", action="store_true", help="Reset all newsletters for today")
    parser.add_argument("--from-status", choices=["sent", "failed"], help="Only reset newsletters with this status")
    
    args = parser.parse_args()
    
    if args.all_today:
        date = _get_today_ist_date()
        print(f"Resetting all newsletters for today: {date}\n")
        reset_all_newsletters(date, args.from_status)
    elif args.date:
        if args.user_id:
            print(f"Resetting newsletter for user {args.user_id} on {args.date}\n")
            reset_newsletter_status(args.user_id, args.date)
        else:
            print(f"Resetting all newsletters for {args.date}\n")
            reset_all_newsletters(args.date, args.from_status)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()


