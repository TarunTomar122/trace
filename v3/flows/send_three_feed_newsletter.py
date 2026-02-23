#!/usr/bin/env python3
"""
Send personalized newsletter emails built from v3 three-feed docs.

By default, sends to one user with --user-id. For broader sends, use --audience.
No extra OpenAI calls: this reuses existing summaries in v3_user_feeds.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timedelta, timezone
from html import escape
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from dotenv import load_dotenv
from google.cloud import firestore

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
load_dotenv(REPO_ROOT / ".env")

from v1.storage import FirestoreStore  # noqa: E402
from v1.tools.brevo_client import send_newsletter_email  # noqa: E402
from v3.lib.store import V3Store  # noqa: E402

SECTION_SPECS = [
    ("trending", "Trending Now", 3, "#f97316"),
    ("for_you", "For You", 4, "#f59e0b"),
    ("deep_dives", "Deep Dives", 2, "#0ea5e9"),
]


def _today_ist() -> str:
    ist = timezone(timedelta(hours=5, minutes=30))
    return datetime.now(ist).strftime("%Y-%m-%d")


def _load_template(name: str) -> str:
    path = REPO_ROOT / "v1" / "templates" / name
    if not path.exists():
        raise FileNotFoundError(f"Template not found: {path}")
    return path.read_text()


def _display_date(date: str) -> str:
    try:
        return datetime.strptime(date, "%Y-%m-%d").strftime("%B %d, %Y")
    except ValueError:
        return date


def _pick_items(feed: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    selected: dict[str, list[dict[str, Any]]] = {}
    used_urls: set[str] = set()

    for key, _label, cap, _color in SECTION_SPECS:
        rows = feed.get(key, []) if isinstance(feed.get(key), list) else []
        out: list[dict[str, Any]] = []
        for row in rows:
            if not isinstance(row, dict):
                continue
            url = str(row.get("url", "")).strip()
            if not url or url in used_urls:
                continue
            out.append(row)
            used_urls.add(url)
            if len(out) >= cap:
                break
        selected[key] = out

    return selected


def _source_name(item: dict[str, Any]) -> str:
    source = str(item.get("source_name", "")).strip()
    if source:
        return source
    url = str(item.get("url", "")).strip()
    host = (urlparse(url).hostname or "").lower().replace("www.", "")
    return host or "Source"


def _summary_line(item: dict[str, Any]) -> str:
    summary = item.get("summary", {})
    if isinstance(summary, dict):
        short = summary.get("short_article", {})
        if isinstance(short, dict):
            subtitle = str(short.get("subtitle", "")).strip()
            if subtitle:
                return subtitle
    return str(item.get("description", "")).strip()


def _render_item(item: dict[str, Any], color: str) -> str:
    title = escape(str(item.get("title", "Untitled")))
    url = escape(str(item.get("url", "#")))
    source = escape(_source_name(item))
    snippet = escape(_summary_line(item))

    return (
        '<table width="100%" cellpadding="0" cellspacing="0" border="0" '
        'style="margin: 0 0 14px 0;">'
        "<tr><td style=\"padding: 14px; border: 1px solid #e4e4e7; border-radius: 10px;\">"
        f'<p style="margin: 0 0 6px 0; font-size: 12px; color: #71717a; '
        f'font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif;">{source}</p>'
        f'<a href="{url}" style="display: block; margin: 0 0 8px 0; font-size: 18px; '
        "font-family: Georgia, 'Times New Roman', serif; font-weight: 700; "
        f'color: #18181b; text-decoration: none; line-height: 1.35;">{title}</a>'
        f'<p style="margin: 0 0 8px 0; font-size: 14px; color: #52525b; '
        f'line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif;">{snippet}</p>'
        f'<a href="{url}" style="font-size: 13px; font-weight: 600; color: {color}; '
        f'font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif; text-decoration: none;">Read more &rarr;</a>'
        "</td></tr></table>"
    )


def _generate_html(
    feed: dict[str, Any],
    date: str,
    user_name: str,
) -> tuple[str, str]:
    tpl = _load_template("three_feed_newsletter.html")
    selected = _pick_items(feed)

    intro_html = (
        '<p style="margin: 0; font-size: 15px; color: #52525b; line-height: 1.7; '
        "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;\">"
        "Three quick sections from your Trace feed so you can skim fast and go deeper only where it matters."
        "</p>"
    )

    sections_html = ""
    for key, label, _cap, color in SECTION_SPECS:
        items = selected.get(key, [])
        if not items:
            continue
        section_block = (
            '<div style="margin: 0 0 16px 0;">'
            f'<p style="margin: 0 0 10px 0; font-size: 13px; font-weight: 700; letter-spacing: 0.8px; '
            f'text-transform: uppercase; color: {color}; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif;">'
            f"{escape(label)}</p>"
            + "".join(_render_item(item, color) for item in items)
            + "</div>"
        )
        sections_html += section_block

    user_suffix = f", {escape(user_name.split(' ')[0])}" if user_name else ""
    html = tpl.replace("{{DATE}}", _display_date(date))
    html = html.replace("{{USER_NAME_SUFFIX}}", user_suffix)
    html = html.replace("{{INTRO_HTML}}", intro_html)
    html = html.replace("{{SECTIONS_HTML}}", sections_html)

    subject = f"Your Trace Brief for {_display_date(date)}"
    return subject, html


def _generate_text(feed: dict[str, Any], date: str) -> str:
    selected = _pick_items(feed)
    lines = [
        "TRACE",
        f"Daily Brief - {date}",
        "",
        "Trending + For You + Deep Dives in one place.",
        "",
    ]
    for _key, label, _cap, _color in SECTION_SPECS:
        items = selected.get(_key, [])
        if not items:
            continue
        lines.append(label)
        lines.append("-" * len(label))
        for idx, item in enumerate(items, start=1):
            lines.append(f"{idx}. {item.get('title', 'Untitled')}")
            lines.append(f"   {_summary_line(item)}")
            lines.append(f"   {item.get('url', '')}")
            lines.append("")
    return "\n".join(lines)


def _load_user_feed(store: FirestoreStore, uid: str, date: str) -> dict[str, Any]:
    doc = (
        store.db.collection("v3_user_feeds")
        .document(uid)
        .collection("daily")
        .document(date)
        .get()
    )
    if doc.exists:
        return doc.to_dict() or {}

    latest_docs = (
        store.db.collection("v3_user_feeds")
        .document(uid)
        .collection("daily")
        .order_by("__name__", direction=firestore.Query.DESCENDING)
        .limit(1)
        .stream()
    )
    for latest in latest_docs:
        return latest.to_dict() or {}
    return {}


def _resolve_recipients(
    store: FirestoreStore,
    v3_store: V3Store,
    user_id: str,
    audience: str,
) -> list[dict[str, str]]:
    if user_id:
        profile = store.get_user_profile(user_id) or {}
        email = str(profile.get("email", "")).strip().lower()
        if not email:
            return []
        name = str(profile.get("name", "")).strip() or str(profile.get("displayName", "")).strip()
        return [{"uid": user_id, "email": email, "name": name}]

    users = v3_store.get_onboarded_users(audience)
    out: list[dict[str, str]] = []
    for profile in users:
        uid = str(profile.get("uid", "")).strip()
        email = str(profile.get("email", "")).strip().lower()
        if not uid or not email:
            continue
        name = str(profile.get("name", "")).strip() or str(profile.get("displayName", "")).strip()
        out.append({"uid": uid, "email": email, "name": name})
    return out


def send_three_feed_newsletter(
    *,
    date: str,
    user_id: str,
    audience: str,
    dry_run: bool,
) -> dict[str, Any]:
    store = FirestoreStore()
    v3_store = V3Store()
    target_date = date.strip() or _today_ist()
    recipients = _resolve_recipients(store, v3_store, user_id, audience)
    if not recipients:
        return {"success": False, "error": "no recipients found", "date": target_date}

    sent = 0
    failed = 0
    skipped = 0
    errors: list[str] = []

    for row in recipients:
        uid = row["uid"]
        feed = _load_user_feed(store, uid, target_date)
        if not feed:
            skipped += 1
            continue

        if not any(isinstance(feed.get(k), list) and feed.get(k) for k in ("trending", "for_you", "deep_dives")):
            skipped += 1
            continue

        subject, html = _generate_html(feed, target_date, row.get("name", ""))
        text = _generate_text(feed, target_date)

        if dry_run:
            sent += 1
            continue

        res = send_newsletter_email(
            to_email=row["email"],
            to_name=row.get("name") or None,
            subject=subject,
            html_content=html,
            text_content=text,
        )
        if res.get("success"):
            sent += 1
        else:
            failed += 1
            errors.append(f"{uid}<{row['email']}>: {res.get('error', 'unknown')}")

    return {
        "success": sent > 0 and failed == 0,
        "date": target_date,
        "dry_run": dry_run,
        "recipient_count": len(recipients),
        "sent": sent,
        "failed": failed,
        "skipped": skipped,
        "errors": errors,
    }


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Send v3 three-feed newsletters.")
    p.add_argument("--date", default="", help="YYYY-MM-DD (defaults to today IST)")
    p.add_argument("--user-id", default="", help="Send only to one uid")
    p.add_argument(
        "--audience",
        choices=["subscribed", "unsubscribed", "all"],
        default="subscribed",
        help="Audience when --user-id is not provided",
    )
    p.add_argument("--dry-run", action="store_true", help="Build but do not send")
    return p.parse_args()


def main() -> None:
    args = _parse_args()
    result = send_three_feed_newsletter(
        date=args.date,
        user_id=args.user_id,
        audience=args.audience,
        dry_run=args.dry_run,
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
