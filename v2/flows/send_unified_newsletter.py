#!/usr/bin/env python3
"""
Send the unified newsletter for a given date.

Reads the LLM-written draft from unified_newsletters/{date} and sends it to:
- paid/trial opted-in recipients
- free newsletter signups (email-only)

No personalization, no content filtering.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timedelta, timezone
from html import escape
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
load_dotenv(REPO_ROOT / ".env")

from v1.storage import FirestoreStore  # noqa: E402
from v1.tools.brevo_client import send_newsletter_email  # noqa: E402


def _today_ist() -> str:
    ist = timezone(timedelta(hours=5, minutes=30))
    return datetime.now(ist).strftime("%Y-%m-%d")


def _load_template(name: str) -> str:
    path = REPO_ROOT / "v1" / "templates" / name
    if not path.exists():
        raise FileNotFoundError(f"Template not found: {path}")
    return path.read_text()


def _build_recipient_profiles(store: FirestoreStore) -> list[dict[str, Any]]:
    recipients: list[dict[str, Any]] = []
    for profile in store.get_newsletter_opted_in_users():
        email = (profile.get("email") or "").strip().lower()
        if not email:
            continue
        recipients.append(profile)
    return recipients


def _build_default_recipients(store: FirestoreStore) -> list[dict[str, Any]]:
    """Default audience: paid opted-in users + free email signups."""
    by_email: dict[str, dict[str, Any]] = {}

    for profile in _build_recipient_profiles(store):
        email = (profile.get("email") or "").strip().lower()
        if email:
            by_email[email] = profile

    for email in store.get_all_free_newsletter_emails():
        normalized = str(email or "").strip().lower()
        if not normalized or normalized in by_email:
            continue
        by_email[normalized] = {
            "email": normalized,
            "source": "free_newsletter_signup",
        }

    return list(by_email.values())


def _build_all_signup_recipients(store: FirestoreStore) -> list[str]:
    profile_emails = {
        (u.get("email") or "").strip().lower()
        for u in store.get_all_user_profiles()
        if u.get("email")
    }
    free_emails = set(store.get_all_free_newsletter_emails())
    return sorted((profile_emails | free_emails) - {""})


def _paragraphs_to_html(text: str) -> str:
    """Split plain text on blank lines and wrap each block in a styled <p>."""
    raw = (text or "").strip()
    if not raw:
        return ""
    blocks = [b.strip() for b in raw.split("\n\n") if b.strip()]
    html_parts: list[str] = []
    for block in blocks:
        html_parts.append(
            '<p style="margin: 0 0 14px 0; font-size: 16px; line-height: 1.7; '
            "color: #27272a; font-family: -apple-system, BlinkMacSystemFont, "
            "'Segoe UI', Roboto, Helvetica, Arial, sans-serif;\">"
            f"{escape(block)}</p>"
        )
    return "".join(html_parts)


def _render_intro_html(intro: str) -> str:
    return _paragraphs_to_html(intro)


def _render_stories_html(stories: list[dict[str, Any]], sign_off: str) -> str:
    parts: list[str] = []
    for idx, story in enumerate(stories, start=1):
        title = str(story.get("title") or "").strip() or f"Story {idx}"
        url = str(story.get("url") or "").strip()
        body = str(story.get("body") or "").strip()
        image_url = str(story.get("image_url") or "").strip()

        title_safe = escape(title)
        if url:
            title_html = (
                f'<a href="{escape(url)}" style="color: #18181b; text-decoration: none;">'
                f"{title_safe}</a>"
            )
        else:
            title_html = title_safe

        body_html = _paragraphs_to_html(body)

        image_html = ""
        if image_url:
            img_tag = (
                f'<img src="{escape(image_url)}" alt="" width="576" '
                'style="display: block; width: 100%; max-width: 576px; '
                'height: auto; border-radius: 8px; border: 1px solid #e4e4e7; margin: 0 0 14px 0;" />'
            )
            if url:
                image_html = (
                f'<a href="{escape(url)}" '
                f'style="display: block; text-decoration: none;">'
                f"{img_tag}</a>"
                )
            else:
                image_html = img_tag

        parts.append(
            '<table width="100%" cellpadding="0" cellspacing="0" '
            'border="0" style="margin: 0 0 8px 0;">'
            '<tr><td style="padding: 0 0 20px 0;"><div '
            'style="border-top: 1px solid #e4e4e7;"></div></td></tr>'
            '<tr><td>'
            f'<p style="margin: 0 0 12px 0; font-size: 22px; line-height: 1.35; '
            "font-family: Georgia, 'Times New Roman', serif; font-weight: 700; color: #18181b;\">"
            f"{idx}. {title_html}</p>"
            f"{image_html}"
            f"{body_html}"
            "</td></tr>"
            '<tr><td style="height: 14px;"></td></tr>'
            "</table>"
        )

    if sign_off:
        parts.append(
            '<table width="100%" cellpadding="0" cellspacing="0" '
            'border="0" style="margin: 8px 0 0 0;">'
            '<tr><td style="padding: 16px 0 0 0; '
            'border-top: 1px solid #e4e4e7;">'
            f'<p style="margin: 0; font-size: 15px; line-height: 1.6; color: #52525b; '
            "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-style: italic;\">"
            f"{escape(sign_off.strip())}</p>"
            "</td></tr></table>"
        )

    return "".join(parts)


def _generate_html(
    date: str,
    intro: str,
    stories: list[dict[str, Any]],
    sign_off: str,
) -> str:
    template = _load_template("free_newsletter.html")
    try:
        display_date = datetime.strptime(
            date, "%Y-%m-%d"
        ).strftime("%B %d, %Y")
    except ValueError:
        display_date = date

    intro_html = _render_intro_html(intro)
    items_html = _render_stories_html(stories, sign_off)

    out = template
    out = out.replace("{{DATE}}", display_date)
    out = out.replace("{{USER_NAME_GREETING}}", "")
    out = out.replace("{{INTRO_HTML}}", intro_html)
    out = out.replace("{{ITEMS_HTML}}", items_html)
    return out


def _generate_text(
    date: str,
    intro: str,
    stories: list[dict[str, Any]],
    sign_off: str,
) -> str:
    lines: list[str] = [
        "TRACE",
        f"Daily Newsletter — {date}",
        "",
    ]
    if intro.strip():
        lines.append(intro.strip())
        lines.append("")
    lines.append("=" * 40)
    lines.append("")
    for idx, story in enumerate(stories, start=1):
        title = str(story.get("title") or "").strip() or f"Story {idx}"
        url = str(story.get("url") or "").strip()
        body = str(story.get("body") or "").strip()
        lines.append(f"{idx}. {title}")
        if body:
            lines.append(body)
        if url:
            lines.append(f"Read: {url}")
        lines.append("")
    if sign_off.strip():
        lines.append(sign_off.strip())
        lines.append("")
    lines.append("=" * 40)
    lines.append("Curated by AI, delivered by Trace")
    lines.append("https://yourtrace.online")
    return "\n".join(lines)


def send_unified_newsletter(
    date: str | None = None,
    dry_run: bool = False,
    force: bool = False,
    user_id: str = "",
    recipient_mode: str = "newsletter",
    to_email: str = "",
) -> dict[str, Any]:
    store = FirestoreStore()
    target_date = (date or "").strip() or _today_ist()
    doc_ref = store.db.collection("unified_newsletters").document(target_date)
    doc = doc_ref.get()
    if not doc.exists:
        return {
            "success": False,
            "error": "no unified newsletter found for date",
            "date": target_date,
        }
    data = doc.to_dict() or {}
    if data.get("status") == "sent" and not force:
        return {
            "success": False,
            "error": "already sent (use --force)",
            "date": target_date,
        }

    stories = data.get("stories") or []
    if not isinstance(stories, list) or not stories:
        return {
            "success": False,
            "error": "newsletter has no stories",
            "date": target_date,
        }

    intro = str(data.get("intro") or "").strip()
    sign_off = str(data.get("sign_off") or "").strip()
    subject = (
        str(data.get("email_subject") or "").strip()
        or f"Trace — {target_date}"
    )

    direct_email = (to_email or "").strip().lower()
    if direct_email:
        recipients = [{"email": direct_email}]
    elif user_id:
        profile = store.get_user_profile(user_id) or {}
        recipients = [profile] if (profile.get("email") or "").strip() else []
    elif recipient_mode == "all_signups":
        recipients = [
            {"email": email}
            for email in _build_all_signup_recipients(store)
            if email
        ]
    else:
        recipients = _build_default_recipients(store)
    if not recipients:
        return {
            "success": False,
            "error": "no recipients found",
            "date": target_date,
        }

    if dry_run:
        return {
            "success": True,
            "dry_run": True,
            "date": target_date,
            "recipient_count": len(recipients),
            "story_count": len(stories),
            "subject": subject,
        }

    html = _generate_html(target_date, intro, stories, sign_off)
    text = _generate_text(target_date, intro, stories, sign_off)

    sent = 0
    failed = 0
    errors: list[str] = []
    for recipient in recipients:
        email = (recipient.get("email") or "").strip().lower()
        if not email:
            continue
        res = send_newsletter_email(
            to_email=email,
            to_name=None,
            subject=subject,
            html_content=html,
            text_content=text,
        )
        if res.get("success"):
            sent += 1
        else:
            failed += 1
            errors.append(f"{email}: {res.get('error', 'unknown')}")

    status = "sent" if sent > 0 else "failed"
    doc_ref.set(
        {
            "status": status,
            "sent_at": datetime.now(timezone.utc).isoformat(),
            "sent_count": sent,
            "failed_count": failed,
            "recipient_count": len(recipients),
            "email_subject": subject,
            "email_html": html,
            "email_text": text,
        },
        merge=True,
    )
    return {
        "success": sent > 0,
        "date": target_date,
        "sent": sent,
        "failed": failed,
        "recipient_count": len(recipients),
        "story_count": len(stories),
        "errors": errors,
    }


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Send unified newsletter to recipients."
    )
    parser.add_argument("--date", default="", help="YYYY-MM-DD")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--user-id", default="", help="Send only to one uid")
    parser.add_argument(
        "--to-email",
        default="",
        help="Send only to one direct email address",
    )
    parser.add_argument(
        "--recipient-mode",
        choices=["newsletter", "all_signups"],
        default="newsletter",
        help="newsletter=subscribed opted-in users only, all_signups=all known signed-up emails",
    )
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    result = send_unified_newsletter(
        date=args.date,
        dry_run=args.dry_run,
        force=args.force,
        user_id=args.user_id,
        recipient_mode=args.recipient_mode,
        to_email=args.to_email,
    )
    print(json.dumps(result, indent=2))
    sys.exit(0 if result.get("success") else 1)


if __name__ == "__main__":
    main()
