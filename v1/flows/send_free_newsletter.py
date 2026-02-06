"""
Send Free Newsletter - sends the generic daily newsletter to all
free subscribers (landing page signups + unsubscribed users).

Uses the same templates as the paid newsletter.

Usage:
    python v1/flows/send_free_newsletter.py --date 2026-02-05
    python v1/flows/send_free_newsletter.py  # today
    python v1/flows/send_free_newsletter.py --dry-run
    python v1/flows/send_free_newsletter.py --force
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


TYPE_COLORS = {
    "blog": "#10b981",
    "discussion": "#f59e0b",
    "news": "#f97316",
    "repo": "#8b5cf6",
    "paper": "#3b82f6",
    "tweet": "#0ea5e9",
    "launch": "#d946ef",
}


def _get_today_ist_date() -> str:
    ist_tz = timezone(timedelta(hours=5, minutes=30))
    return datetime.now(ist_tz).strftime("%Y-%m-%d")


def _load_template(name: str) -> str:
    path = (
        Path(__file__).parent.parent / "templates" / name
    )
    if path.exists():
        return path.read_text()
    raise FileNotFoundError(f"Template not found: {path}")


def _generate_html(
    items: list[dict],
    date: str,
) -> str:
    """Generate HTML for the free newsletter."""
    main_tpl = _load_template("newsletter.html")
    item_tpl = _load_template("newsletter_item.html")

    items_html = ""
    for item in items:
        item_type = item.get("type", "blog")
        color = TYPE_COLORS.get(item_type, "#71717a")
        label = item_type.upper()

        html = item_tpl
        html = html.replace("{{ITEM_TYPE_COLOR}}", color)
        html = html.replace("{{ITEM_TYPE_LABEL}}", label)
        html = html.replace(
            "{{ITEM_URL}}", item.get("url", "#")
        )
        html = html.replace(
            "{{ITEM_TITLE}}", item.get("title", "Untitled")
        )
        html = html.replace(
            "{{ITEM_SUMMARY}}", item.get("summary", "")
        )
        items_html += html

    # Format date nicely
    try:
        from datetime import datetime as dt
        d = dt.strptime(date, "%Y-%m-%d")
        display_date = d.strftime("%B %d, %Y")
    except Exception:
        display_date = date

    out = main_tpl
    out = out.replace("{{DATE}}", display_date)
    # No personalized greeting for free newsletter
    out = out.replace("{{USER_NAME_GREETING}}", "")
    out = out.replace("{{ITEM_COUNT}}", str(len(items)))
    out = out.replace("{{ITEMS_HTML}}", items_html)

    return out


def _generate_text(
    items: list[dict],
    date: str,
) -> str:
    """Generate plain text for the free newsletter."""
    lines = [
        "TRACE",
        f"Daily Newsletter - {date}",
        "",
        "Hey! Here are today's top reads.",
        "",
        "=" * 40,
        "",
    ]
    for idx, item in enumerate(items, 1):
        t = item.get("type", "article").upper()
        lines.append(
            f"{idx}. [{t}] {item.get('title', 'Untitled')}"
        )
        lines.append(f"   Read: {item.get('url', '')}")
        lines.append("")

    lines.extend([
        "=" * 40,
        "",
        "Curated by AI, delivered by Trace",
        "https://yourtrace.online",
    ])
    return "\n".join(lines)


def send_free_newsletter(
    date: str | None = None,
    dry_run: bool = False,
    force: bool = False,
) -> dict[str, Any]:
    """
    Send the free newsletter to all free subscribers.
    """
    store = FirestoreStore()

    if not date:
        date = _get_today_ist_date()

    print(f"Sending free newsletter for {date}...")

    # Load newsletter
    newsletter = store.get_free_newsletter(date)
    if not newsletter:
        return {
            "success": False,
            "error": "No free newsletter found for date. "
                     "Run build_free_newsletter.py first.",
            "date": date,
        }

    if newsletter.get("status") == "sent" and not force:
        return {
            "success": False,
            "error": "Already sent (use --force to resend)",
            "date": date,
        }

    items = newsletter.get("items", [])
    if not items:
        return {
            "success": False,
            "error": "Newsletter has no items",
            "date": date,
        }

    # Get all free subscriber emails
    emails = store.get_all_free_newsletter_emails()
    print(f"  Recipients: {len(emails)} free subscribers")

    if not emails:
        return {
            "success": False,
            "error": "No free subscribers found",
            "date": date,
        }

    # Generate HTML and text
    html = _generate_html(items, date)
    text = _generate_text(items, date)
    subject = newsletter.get(
        "email_subject",
        f"Trace Daily — {len(items)} must-reads for {date}",
    )

    if dry_run:
        print(f"  [DRY RUN] Would send to {len(emails)} emails")
        for e in sorted(emails):
            print(f"    - {e}")
        return {
            "success": True,
            "date": date,
            "dry_run": True,
            "recipient_count": len(emails),
        }

    # Send to each subscriber
    sent = 0
    failed = 0
    errors: list[str] = []

    for email in sorted(emails):
        result = send_newsletter_email(
            to_email=email,
            to_name=None,
            subject=subject,
            html_content=html,
            text_content=text,
        )
        if result.get("success"):
            sent += 1
            print(f"    ✓ {email}")
        else:
            failed += 1
            err = result.get("error", "unknown")
            errors.append(f"{email}: {err}")
            print(f"    ✗ {email}: {err}")

    # Update status
    status = "sent" if sent > 0 else "failed"
    now_iso = datetime.now(timezone.utc).isoformat()

    store.db.collection("free_newsletters").document(date).update({
        "status": status,
        "sent_at": now_iso,
        "sent_count": sent,
        "failed_count": failed,
        "email_html": html,
        "email_text": text,
    })

    print(f"\n  Done: {sent} sent, {failed} failed")

    return {
        "success": True,
        "date": date,
        "sent": sent,
        "failed": failed,
        "errors": errors,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Send free newsletter to all free subscribers"
    )
    parser.add_argument(
        "--date",
        help="Date (YYYY-MM-DD), defaults to today IST",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only list recipients, don't send",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Resend even if already sent",
    )
    args = parser.parse_args()

    result = send_free_newsletter(
        args.date,
        dry_run=args.dry_run,
        force=args.force,
    )

    if result["success"]:
        if args.dry_run:
            ct = result["recipient_count"]
            print(f"\n[DRY RUN] Would send to {ct} recipients")
        else:
            print(f"\nSent: {result['sent']}, "
                  f"Failed: {result['failed']}")
    else:
        print(f"\nFailed: {result.get('error')}")


if __name__ == "__main__":
    main()

