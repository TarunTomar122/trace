"""
Build Newsletters for All Users - bulk generate newsletters for opted-in users.

Filters to subscribed users only, respects newsletterOptIn field,
skips users without a feed for the date.

Usage:
    python v1/flows/build_newsletters_for_all_users.py
    python v1/flows/build_newsletters_for_all_users.py --date 2026-01-28
    python v1/flows/build_newsletters_for_all_users.py --dry-run
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
from v1.flows.build_newsletter_for_user import build_newsletter_for_user


def _get_today_ist_date() -> str:
    """Get today's date in IST timezone."""
    ist_tz = timezone(timedelta(hours=5, minutes=30))
    return datetime.now(ist_tz).strftime("%Y-%m-%d")


def build_newsletters_for_all_users(
    date: str | None = None,
    dry_run: bool = False,
) -> dict:
    """
    Build newsletters for all eligible users.

    Args:
        date: Date string (YYYY-MM-DD), defaults to today IST
        dry_run: If True, only report which users would get newsletters

    Returns:
        Summary dict with success/fail counts and details
    """
    store = FirestoreStore()

    if not date:
        date = _get_today_ist_date()

    print(f"Building newsletters for date: {date}")
    print(f"Dry run: {dry_run}")
    print("-" * 40)

    # Get opted-in users — paid first, then free teaser (capped to 100 to respect Brevo)
    paid_users = store.get_newsletter_opted_in_users()
    print(f"Found {len(paid_users)} opted-in subscribed users")
    free_users = store.get_free_opted_in_users(limit=100)
    print(f"Found {len(free_users)} free opted-in users (capped teaser)")
    # Paid first, free second; dedupe by uid
    seen = {u.get("uid") for u in paid_users}
    users = paid_users + [u for u in free_users if u.get("uid") not in seen]

    results = {
        "date": date,
        "total_eligible": len(users),
        "success": 0,
        "failed": 0,
        "skipped": 0,
        "details": [],
    }

    for user in users:
        user_id = user.get("uid")
        email = user.get("email", "unknown")

        print(f"\nProcessing: {email}")

        # Check if user has a feed for this date
        feed_doc = (
            store.db.collection("user_feeds")
            .document(user_id)
            .collection("daily")
            .document(date)
            .get()
        )

        if not feed_doc.exists:
            print(f"  Skipped: No feed for date")
            results["skipped"] += 1
            results["details"].append({
                "user_id": user_id,
                "email": email,
                "status": "skipped",
                "reason": "no_feed",
            })
            continue

        # Check if newsletter already exists
        existing = store.get_user_newsletter(user_id, date)
        if existing:
            print(f"  Skipped: Newsletter already exists (status: {existing.get('status')})")
            results["skipped"] += 1
            results["details"].append({
                "user_id": user_id,
                "email": email,
                "status": "skipped",
                "reason": "already_exists",
            })
            continue

        if dry_run:
            print(f"  Would build newsletter (dry run)")
            results["details"].append({
                "user_id": user_id,
                "email": email,
                "status": "dry_run",
            })
            continue

        # Build newsletter
        try:
            result = build_newsletter_for_user(user_id, date)

            if result.get("success"):
                print(f"  Success: {result.get('item_count', 0)} items")
                results["success"] += 1
                results["details"].append({
                    "user_id": user_id,
                    "email": email,
                    "status": "success",
                    "item_count": result.get("item_count", 0),
                })
            else:
                print(f"  Failed: {result.get('error')}")
                results["failed"] += 1
                results["details"].append({
                    "user_id": user_id,
                    "email": email,
                    "status": "failed",
                    "error": result.get("error"),
                })

        except Exception as e:
            print(f"  Error: {str(e)}")
            results["failed"] += 1
            results["details"].append({
                "user_id": user_id,
                "email": email,
                "status": "failed",
                "error": str(e),
            })

    print("\n" + "=" * 40)
    print(f"SUMMARY for {date}")
    print(f"  Total eligible: {results['total_eligible']}")
    print(f"  Success: {results['success']}")
    print(f"  Failed: {results['failed']}")
    print(f"  Skipped: {results['skipped']}")

    return results


def main():
    parser = argparse.ArgumentParser(description="Build newsletters for all users")
    parser.add_argument("--date", help="Date (YYYY-MM-DD), defaults to today IST")
    parser.add_argument("--dry-run", action="store_true", help="Only report, don't build")
    args = parser.parse_args()

    build_newsletters_for_all_users(args.date, args.dry_run)


if __name__ == "__main__":
    main()
