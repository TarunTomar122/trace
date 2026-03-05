#!/usr/bin/env python3
"""
Send one unified newsletter to all newsletter recipients.

Recipients = paid/active opted-in + free newsletter recipients.
"""

from __future__ import annotations

import argparse
import json
import re
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

TYPE_COLORS = {
    "blog": "#10b981",
    "discussion": "#f59e0b",
    "news": "#f97316",
    "repo": "#8b5cf6",
    "paper": "#3b82f6",
    "tweet": "#0ea5e9",
    "launch": "#d946ef",
}


def _markdown_inline_to_html(text: str) -> str:
    out = escape(text or "")
    out = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", out)
    out = re.sub(r"\*(.+?)\*", r"<em>\1</em>", out)
    return out


def _today_ist() -> str:
    ist = timezone(timedelta(hours=5, minutes=30))
    return datetime.now(ist).strftime("%Y-%m-%d")


def _load_template(name: str) -> str:
    path = REPO_ROOT / "v1" / "templates" / name
    if not path.exists():
        raise FileNotFoundError(f"Template not found: {path}")
    return path.read_text()


def _build_recipients(store: FirestoreStore) -> list[str]:
    paid = {
        (u.get("email") or "").strip().lower()
        for u in store.get_newsletter_opted_in_users()
        if u.get("email")
    }
    free = set(store.get_all_free_newsletter_emails())
    recipients = sorted((paid | free) - {""})
    return recipients


def _build_all_signup_recipients(store: FirestoreStore) -> list[str]:
    """All emails we've ever collected:
    - every user_profiles email
    - free newsletter subscribers
    """
    profile_emails = {
        (u.get("email") or "").strip().lower()
        for u in store.get_all_user_profiles()
        if u.get("email")
    }
    free_emails = set(store.get_all_free_newsletter_emails())
    recipients = sorted((profile_emails | free_emails) - {""})
    return recipients


def _generate_topic_html(top_topics: list[dict[str, Any]]) -> str:
    blocks = ""
    for idx, topic in enumerate(top_topics, start=1):
        topic_name = escape(str(topic.get("topic_name", f"Topic {idx}")))
        overview = _markdown_inline_to_html(
            str(topic.get("overview", "")).strip() or "Trending now."
        )
        image_url = escape(str(topic.get("image_url", "")).strip())
        article_count = int(topic.get("article_count", 0) or 0)
        key_points_raw = topic.get("key_points", [])
        key_points: list[str] = []
        if isinstance(key_points_raw, list):
            for point in key_points_raw:
                if isinstance(point, str) and point.strip():
                    key_points.append(point.strip())
                elif isinstance(point, dict):
                    title = str(point.get("title", "")).strip()
                    if title:
                        key_points.append(title)

        image_html = ""
        if image_url:
            image_html = (
                f'<img src="{image_url}" alt="" width="576" '
                'style="display: block; width: 100%; max-width: 576px; '
                'height: auto; border-radius: 8px; border: 1px solid #e4e4e7; margin: 0 0 14px 0;" />'
            )

        key_points_html = ""
        for point in key_points[:6]:
            key_points_html += (
                '<tr><td style="padding: 0 0 10px 0;">'
                '<table cellpadding="0" cellspacing="0" border="0"><tr>'
                '<td style="vertical-align: top; width: 14px; padding-top: 7px;">'
                '<span style="display: inline-block; width: 6px; height: 6px; border-radius: 999px; background: #d4d4d8;"></span>'
                '</td>'
                f'<td style="font-size: 15px; line-height: 1.6; color: #3f3f46; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif;">{_markdown_inline_to_html(point)}</td>'
                '</tr></table>'
                '</td></tr>'
            )

        count_html = ""
        if article_count > 0:
            count_html = (
                f'<p style="margin: 0 0 10px 0; font-size: 12px; color: #a1a1aa; '
                f'font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif;">{article_count} related updates today</p>'
            )

        blocks += (
            '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 0;">'
            '<tr><td style="padding: 0 0 24px 0;"><div style="border-top: 1px solid #e4e4e7;"></div></td></tr>'
            '<tr><td>'
            f'<p style="margin: 0 0 8px 0; font-size: 10px; font-weight: 700; color: #f97316; text-transform: uppercase; letter-spacing: 1.2px; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif;">Topic {idx}</p>'
            f'<p style="margin: 0 0 10px 0; font-size: 22px; font-family: Georgia, \'Times New Roman\', serif; font-weight: 700; color: #18181b; line-height: 1.3;">{topic_name}</p>'
            f"{count_html}"
            f"{image_html}"
            f'<p style="margin: 0 0 16px 0; font-size: 15px; color: #3f3f46; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif; line-height: 1.65;">{overview}</p>'
            '<p style="margin: 0 0 10px 0; font-size: 11px; color: #71717a; text-transform: uppercase; letter-spacing: 1.1px; font-weight: 700; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif;">Key Points</p>'
            f'<table width="100%" cellpadding="0" cellspacing="0" border="0">{key_points_html}</table>'
            '</td></tr>'
            '<tr><td style="height: 18px;"></td></tr>'
            '</table>'
        )
    return blocks


def _generate_html(
    items: list[dict[str, Any]],
    date: str,
    intro_html: str,
    top_topics: list[dict[str, Any]] | None = None,
) -> str:
    main_tpl = _load_template("free_newsletter.html")

    if top_topics:
        items_html = _generate_topic_html(top_topics)
    else:
        item_tpl = _load_template("newsletter_item.html")
        items_html = ""
        for item in items:
            item_type = item.get("type", "news")
            color = TYPE_COLORS.get(item_type, "#71717a")
            label = item_type.upper()
            thumb = item.get("thumbnail", "")
            if thumb:
                image_html = (
                    f'<a href="{item.get("url", "#")}" '
                    'style="display: block; margin-bottom: 14px;">'
                    f'<img src="{thumb}" alt="" width="576" '
                    'style="display: block; width: 100%; max-width: 576px; '
                    "height: auto; border-radius: 8px; border: 1px solid "
                    '#e4e4e7;" />'
                    "</a>"
                )
            else:
                image_html = ""

            html = item_tpl
            html = html.replace("{{ITEM_TYPE_COLOR}}", color)
            html = html.replace("{{ITEM_TYPE_LABEL}}", label)
            html = html.replace("{{ITEM_URL}}", item.get("url", "#"))
            html = html.replace("{{ITEM_TITLE}}", item.get("title", "Untitled"))
            html = html.replace("{{ITEM_IMAGE_HTML}}", image_html)
            html = html.replace("{{ITEM_SUMMARY}}", item.get("summary", ""))
            items_html += html

    try:
        display_date = datetime.strptime(date, "%Y-%m-%d").strftime("%B %d, %Y")
    except ValueError:
        display_date = date

    out = main_tpl
    out = out.replace("{{DATE}}", display_date)
    out = out.replace("{{USER_NAME_GREETING}}", "")
    out = out.replace("{{INTRO_HTML}}", intro_html or "")
    out = out.replace("{{ITEMS_HTML}}", items_html)
    return out


def _generate_text(
    items: list[dict[str, Any]],
    date: str,
    intro_html: str,
    top_topics: list[dict[str, Any]] | None = None,
) -> str:
    intro = re.sub(r"<[^>]+>", "", intro_html or "").strip()
    if not intro:
        intro = "Here are today's top trending stories."
    lines = [
        "TRACE",
        f"Daily Newsletter - {date}",
        "",
        intro,
        "",
        "=" * 40,
        "",
    ]
    if top_topics:
        for idx, topic in enumerate(top_topics, start=1):
            lines.append(f"{idx}. [TOPIC] {topic.get('topic_name', f'Topic {idx}')}")
            lines.append(f"   Overview: {topic.get('overview', 'Trending now.')}")
            key_points = topic.get("key_points", []) if isinstance(topic.get("key_points"), list) else []
            if key_points:
                lines.append("   Key Points:")
            for point in key_points:
                if isinstance(point, str):
                    text = point.strip()
                elif isinstance(point, dict):
                    text = str(point.get("title", "")).strip()
                else:
                    text = ""
                if text:
                    lines.append(f"   - {text}")
            lines.append("")
    else:
        for idx, item in enumerate(items, start=1):
            lines.append(f"{idx}. [NEWS] {item.get('title', 'Untitled')}")
            lines.append(f"   {item.get('summary', '')}")
            lines.append(f"   Read: {item.get('url', '')}")
            lines.append("")
    lines.extend(
        [
            "=" * 40,
            "",
            "Curated by AI, delivered by Trace",
            "https://yourtrace.online",
        ]
    )
    return "\n".join(lines)


def send_unified_newsletter(
    date: str | None = None,
    dry_run: bool = False,
    force: bool = False,
    user_id: str = "",
    recipient_mode: str = "newsletter",
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

    items = data.get("items", []) or []
    top_topics = data.get("top_topics", []) if isinstance(data.get("top_topics"), list) else []
    if not items and not top_topics:
        return {
            "success": False,
            "error": "newsletter has no content",
            "date": target_date,
        }

    if user_id:
        profile = store.get_user_profile(user_id) or {}
        email = (profile.get("email") or "").strip().lower()
        recipients = [email] if email else []
    elif recipient_mode == "all_signups":
        recipients = _build_all_signup_recipients(store)
    else:
        recipients = _build_recipients(store)
    if not recipients:
        return {
            "success": False,
            "error": "no recipients found",
            "date": target_date,
        }

    subject = data.get(
        "email_subject",
        f"Trace Trends: Top {len(top_topics) if top_topics else len(items)} stories for {target_date}",
    )
    intro_html = data.get("intro_html", "")
    html = _generate_html(items, target_date, intro_html, top_topics=top_topics)
    text = _generate_text(items, target_date, intro_html, top_topics=top_topics)

    if dry_run:
        return {
            "success": True,
            "dry_run": True,
            "date": target_date,
            "recipient_count": len(recipients),
            "top_topic_count": len(top_topics),
        }

    sent = 0
    failed = 0
    errors: list[str] = []
    for email in recipients:
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
        "top_topic_count": len(top_topics),
        "errors": errors,
    }


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Send unified newsletter to all recipients."
    )
    parser.add_argument("--date", default="", help="YYYY-MM-DD")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--user-id", default="", help="Send only to one uid")
    parser.add_argument(
        "--recipient-mode",
        choices=["newsletter", "all_signups"],
        default="newsletter",
        help="newsletter=opted-in + free list, all_signups=all known signed-up emails",
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
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
