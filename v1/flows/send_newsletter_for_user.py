"""
Send Newsletter for User - generates HTML and sends newsletter via Brevo.

Generates HTML from newsletter items, sends email, updates status in Firestore.

Usage:
    python v1/flows/send_newsletter_for_user.py --user_id USER_ID
    python v1/flows/send_newsletter_for_user.py --user_id USER_ID --date 2026-01-28
"""
import argparse
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env")

from v1.storage import FirestoreStore
from v1.tools.brevo_client import send_newsletter_email


def _get_today_ist_date() -> str:
    """Get today's date in IST timezone."""
    ist_tz = timezone(timedelta(hours=5, minutes=30))
    return datetime.now(ist_tz).strftime("%Y-%m-%d")


def _load_template(template_name: str) -> str:
    """Load an HTML template from the templates directory."""
    template_path = Path(__file__).parent.parent / "templates" / template_name
    if template_path.exists():
        return template_path.read_text()
    raise FileNotFoundError(f"Template not found: {template_path}")


# Type colors for numbered pills and badges
TYPE_COLORS = {
    "blog": "#10b981",
    "discussion": "#f59e0b",
    "news": "#f97316",
    "repo": "#8b5cf6",
    "paper": "#3b82f6",
    "tweet": "#0ea5e9",
    "launch": "#d946ef",
}


FREE_TEASER_UPSELL_HTML = """
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 24px; background-color: #fffbeb; border: 1px solid #f59e0b; border-radius: 12px; overflow: hidden;">
  <tr><td style="padding: 20px 24px;">
    <p style="margin:0 0 6px 0; font-size: 14px; font-weight: 700; color: #92400e; font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">You're on the free teaser — 3 stories</p>
    <p style="margin:0 0 12px 0; font-size: 13px; color: #78350f; line-height: 1.6; font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Pro unlocks the full 8-story brief + archive + personalized feed. $2.99/month after 3-day trial — cancel anytime.</p>
    <a href="https://www.yourtrace.online/profile?tab=subscription&intent=checkout" style="display:inline-block; padding:10px 18px; background:#18181b; color:#fff; text-decoration:none; border-radius:999px; font-size:13px; font-weight:600; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Unlock full brief →</a>
    <p style="margin:10px 0 0 0; font-size:11px; color:#a16207; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Free teaser limited to latest 100 free users due to Brevo free tier — Pro is unlimited.</p>
  </td></tr>
</table>
"""
FREE_TEASER_UPSSELL_TEXT = """
---
Free teaser: you got 3 of 8 stories. Unlock the full brief + archive at https://www.yourtrace.online/profile?tab=subscription&intent=checkout ($2.99/mo after trial)
"""

def _generate_newsletter_html(
    items: list[dict],
    user_name: str,
    date: str,
    is_teaser: bool = False,
) -> str:
    """
    Generate HTML email content from newsletter items using templates.

    Templates are loaded from v1/templates/:
    - newsletter.html: Main email template
    - newsletter_item.html: Template for each item

    Args:
        items: List of newsletter items with title, url, summary, type
        user_name: User's name for personalization
        date: Date string for the newsletter

    Returns:
        HTML string for the email
    """
    # Load templates
    main_template = _load_template("newsletter.html")
    item_template = _load_template("newsletter_item.html")

    # Build items HTML
    items_html = ""
    for idx, item in enumerate(items, 1):
        item_type = item.get("type", "blog")
        type_color = TYPE_COLORS.get(item_type, "#71717a")
        type_label = item_type.upper()

        # Build image HTML (only if thumbnail exists)
        thumbnail = item.get("thumbnail", "")
        if thumbnail:
            image_html = (
                f'<a href="{item.get("url", "#")}" style="display: block; margin-bottom: 14px;">'
                f'<img src="{thumbnail}" alt="" width="576" style="display: block; width: 100%; max-width: 576px; height: auto; border-radius: 8px; border: 1px solid #e4e4e7;" />'
                f'</a>'
            )
        else:
            image_html = ""

        item_html = item_template
        item_html = item_html.replace("{{ITEM_TYPE_COLOR}}", type_color)
        item_html = item_html.replace("{{ITEM_TYPE_LABEL}}", type_label)
        item_html = item_html.replace("{{ITEM_URL}}", item.get("url", "#"))
        item_html = item_html.replace("{{ITEM_TITLE}}", item.get("title", "Untitled"))
        item_html = item_html.replace("{{ITEM_IMAGE_HTML}}", image_html)
        item_html = item_html.replace("{{ITEM_SUMMARY}}", item.get("summary", ""))

        items_html += item_html

    # Build user name greeting
    user_name_greeting = ""
    if user_name:
        first_name = user_name.split()[0]
        user_name_greeting = f", {first_name}"

    # Format date nicely (2026-02-05 → February 05, 2026)
    try:
        from datetime import datetime as dt
        date_obj = dt.strptime(date, "%Y-%m-%d")
        display_date = date_obj.strftime("%B %d, %Y")
    except Exception:
        display_date = date

    # Fill main template
    html = main_template
    html = html.replace("{{DATE}}", display_date)
    html = html.replace("{{USER_NAME_GREETING}}", user_name_greeting)
    html = html.replace("{{ITEM_COUNT}}", str(len(items)))
    if is_teaser:
        items_html += FREE_TEASER_UPSELL_HTML
    html = html.replace("{{ITEMS_HTML}}", items_html)

    return html


def _generate_newsletter_text(
    items: list[dict],
    user_name: str,
    date: str,
    is_teaser: bool = False,
) -> str:
    """Generate plain text version of the newsletter."""
    user_greeting = f", {user_name.split()[0]}" if user_name else ""

    lines = [
        "YOURTRACE",
        f"Daily Newsletter - {date}",
        "",
        f"Good morning{user_greeting}!",
        f"Here are {len(items)} hand-picked reads for you today.",
        "",
        "=" * 40,
        "",
    ]

    for idx, item in enumerate(items, 1):
        lines.append(f"{idx}. [{item.get('type', 'article').upper()}] {item.get('title', 'Untitled')}")
        lines.append(f"   {item.get('summary', '')}")
        lines.append(f"   Read: {item.get('url', '')}")
        lines.append("")

    lines.extend([
        "=" * 40,
        "",
        "Curated by AI, delivered by Trace",
        "Manage preferences: https://yourtrace.online/profile",
        "",
        "---",
        "You're receiving this because you subscribed to YourTrace.",
        "Unsubscribe: https://yourtrace.online/profile",
    ])

    return "\n".join(lines)


def send_newsletter_for_user(
    user_id: str,
    date: str | None = None,
    force: bool = False,
) -> dict[str, Any]:
    """
    Send a newsletter for a single user.

    Args:
        user_id: User ID
        date: Date string (YYYY-MM-DD), defaults to today IST

    Returns:
        Result dict with success status and details
    """
    store = FirestoreStore()

    if not date:
        date = _get_today_ist_date()

    print(f"Sending newsletter for user {user_id} on {date}...")

    # Get user profile
    profile = store.get_user_profile(user_id)
    if not profile:
        return {
            "success": False,
            "error": "User not found",
            "user_id": user_id,
            "date": date,
        }

    user_email = profile.get("email")
    user_name = profile.get("name", profile.get("displayName", ""))

    if not user_email:
        return {
            "success": False,
            "error": "User has no email",
            "user_id": user_id,
            "date": date,
        }

    # Get newsletter for date
    newsletter = store.get_user_newsletter(user_id, date)
    if not newsletter:
        return {
            "success": False,
            "error": "No newsletter found for date",
            "user_id": user_id,
            "date": date,
        }

    # Check if already sent (skip with --force)
    if newsletter.get("status") == "sent" and not force:
        return {
            "success": False,
            "error": "Newsletter already sent (use --force to resend)",
            "user_id": user_id,
            "date": date,
        }

    items = newsletter.get("items", [])
    if not items:
        return {
            "success": False,
            "error": "Newsletter has no items",
            "user_id": user_id,
            "date": date,
        }

    # Generate email content
    html_content = _generate_newsletter_html(items, user_name, date)
    text_content = _generate_newsletter_text(items, user_name, date)
    subject = newsletter.get("email_subject", f"Your Daily Trace - {date}")

    print(f"  Sending to: {user_email}")
    print(f"  Items: {len(items)}")

    # Send email
    result = send_newsletter_email(
        to_email=user_email,
        to_name=user_name,
        subject=subject,
        html_content=html_content,
        text_content=text_content,
    )

    # Update newsletter status
    now_iso = datetime.now(timezone.utc).isoformat()

    if result.get("success"):
        store.update_newsletter_status(
            user_id=user_id,
            date=date,
            status="sent",
            sent_at=now_iso,
        )

        # Also update the HTML/text in the document for reference
        store.db.collection("user_newsletters").document(user_id).collection("daily").document(date).update({
            "email_html": html_content,
            "email_text": text_content,
        })

        print(f"  Success! Message ID: {result.get('message_id')}")

        return {
            "success": True,
            "user_id": user_id,
            "date": date,
            "email": user_email,
            "message_id": result.get("message_id"),
            "item_count": len(items),
        }
    else:
        store.update_newsletter_status(
            user_id=user_id,
            date=date,
            status="failed",
            error=result.get("error"),
        )

        print(f"  Failed: {result.get('error')}")

        return {
            "success": False,
            "error": result.get("error"),
            "user_id": user_id,
            "date": date,
        }


def send_newsletters_for_all_users(
    date: str | None = None,
    dry_run: bool = False,
) -> dict:
    """
    Send newsletters for all users who have newsletters in 'draft' status.

    Args:
        date: Date string (YYYY-MM-DD), defaults to today IST
        dry_run: If True, only report which would be sent

    Returns:
        Summary dict with success/fail counts
    """
    store = FirestoreStore()

    if not date:
        date = _get_today_ist_date()

    print(f"Sending newsletters for date: {date}")
    print(f"Dry run: {dry_run}")
    print("-" * 40)

    # Get opted-in users — paid + free teaser (capped 100)
    paid_users = store.get_newsletter_opted_in_users()
    free_users = store.get_free_opted_in_users(limit=100)
    seen = {u.get("uid") for u in paid_users}
    users = paid_users + [u for u in free_users if u.get("uid") not in seen]
    print(f"Recipients: {len(paid_users)} paid + {len(free_users)} free teaser (capped)")

    results = {
        "date": date,
        "total": 0,
        "sent": 0,
        "failed": 0,
        "skipped": 0,
        "details": [],
    }

    for user in users:
        user_id = user.get("uid")
        email = user.get("email", "unknown")

        # Check if newsletter exists and is in draft status
        newsletter = store.get_user_newsletter(user_id, date)

        if not newsletter:
            continue

        results["total"] += 1

        status = newsletter.get("status")
        if status == "sent":
            results["skipped"] += 1
            results["details"].append({
                "user_id": user_id,
                "email": email,
                "status": "skipped",
                "reason": "already_sent",
            })
            continue

        if status == "failed":
            # Could retry failed ones, but skip for now
            results["skipped"] += 1
            results["details"].append({
                "user_id": user_id,
                "email": email,
                "status": "skipped",
                "reason": "previously_failed",
            })
            continue

        print(f"\nSending to: {email}")

        if dry_run:
            print(f"  Would send (dry run)")
            results["details"].append({
                "user_id": user_id,
                "email": email,
                "status": "dry_run",
            })
            continue

        result = send_newsletter_for_user(user_id, date)

        if result.get("success"):
            results["sent"] += 1
            results["details"].append({
                "user_id": user_id,
                "email": email,
                "status": "sent",
                "message_id": result.get("message_id"),
            })
        else:
            results["failed"] += 1
            results["details"].append({
                "user_id": user_id,
                "email": email,
                "status": "failed",
                "error": result.get("error"),
            })

    print("\n" + "=" * 40)
    print(f"SUMMARY for {date}")
    print(f"  Total newsletters: {results['total']}")
    print(f"  Sent: {results['sent']}")
    print(f"  Failed: {results['failed']}")
    print(f"  Skipped: {results['skipped']}")

    return results


def main():
    parser = argparse.ArgumentParser(description="Send newsletter for user(s)")
    parser.add_argument("--user_id", help="User ID (if not specified, sends to all)")
    parser.add_argument("--date", help="Date (YYYY-MM-DD), defaults to today IST")
    parser.add_argument("--dry-run", action="store_true", help="Only report, don't send")
    parser.add_argument("--all", action="store_true", help="Send to all users with draft newsletters")
    parser.add_argument("--force", action="store_true", help="Resend even if already sent")
    args = parser.parse_args()

    if args.all or not args.user_id:
        send_newsletters_for_all_users(args.date, args.dry_run)
    else:
        result = send_newsletter_for_user(
            args.user_id, args.date, force=args.force,
        )
        if result["success"]:
            print(f"\nNewsletter sent to {result['email']}")
        else:
            print(f"\nFailed: {result.get('error')}")


if __name__ == "__main__":
    main()
