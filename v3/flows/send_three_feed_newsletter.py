#!/usr/bin/env python3
"""Send the shared Trace feed as an editorial newsletter."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from html import escape
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from dotenv import load_dotenv
from google.cloud import firestore
from openai import OpenAI

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
load_dotenv(REPO_ROOT / ".env")

from v1.storage import FirestoreStore  # noqa: E402
from v1.newsletter_preferences import is_newsletter_enabled  # noqa: E402
from v1.tools.brevo_client import send_newsletter_email  # noqa: E402
from v3.lib.store import V3Store  # noqa: E402

NEWSLETTER_INTERESTS = ("ai", "startups", "engineering")
NEWS_STORY_COUNTS = {"ai": 3, "startups": 1, "engineering": 1}
PULSE_COUNTS = {"tools": 2, "discussions": 1, "blogs": 1}
EDITORIAL_VERSION = "builder_digest_v1"
EDITORIAL_MODEL = os.getenv("NEWSLETTER_WRITE_MODEL", "gpt-4o-mini")
ACCENT = "#2f5bd5"

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


def _candidate_stories(feed: dict[str, Any]) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    used_urls: set[str] = set()

    topics = feed.get("trending_topics", [])
    if isinstance(topics, list):
        for topic in topics:
            if not isinstance(topic, dict) or topic.get("interest_id") not in NEWSLETTER_INTERESTS:
                continue
            articles = topic.get("articles", [])
            article = next(
                (
                    row for row in articles
                    if isinstance(row, dict) and str(row.get("url", "")).strip()
                ),
                None,
            ) if isinstance(articles, list) else None
            if not article:
                continue
            story = dict(article)
            story.update({
                "title": topic.get("title") or article.get("title"),
                "description": topic.get("summary") or article.get("description", ""),
                "interest_id": topic.get("interest_id"),
                "thumbnail": topic.get("thumbnail") or article.get("thumbnail", ""),
            })
            url = str(story.get("url", "")).strip()
            candidates.append(story)
            used_urls.add(url)

    rows = feed.get("trending", [])
    if isinstance(rows, list):
        for row in rows:
            if not isinstance(row, dict) or row.get("interest_id") not in NEWSLETTER_INTERESTS:
                continue
            url = str(row.get("url", "")).strip()
            if url and url not in used_urls:
                candidates.append(row)
                used_urls.add(url)
    return candidates


def _pick_items(feed: dict[str, Any]) -> list[dict[str, Any]]:
    eligible = _candidate_stories(feed)
    selected: list[dict[str, Any]] = []
    used_urls: set[str] = set()

    for interest, limit in NEWS_STORY_COUNTS.items():
        for row in eligible:
            if row.get("interest_id") != interest:
                continue
            url = str(row.get("url", "")).strip()
            if not url or url in used_urls:
                continue
            selected.append({**row, "newsletter_group": "top_stories"})
            used_urls.add(url)
            if sum(item.get("interest_id") == interest for item in selected) >= limit:
                break

    pulse = (feed.get("daily_pulse_roles") or {}).get("developer", {})
    if isinstance(pulse, dict):
        for section, limit in PULSE_COUNTS.items():
            rows = pulse.get(section, [])
            if not isinstance(rows, list):
                continue
            group = {
                "tools": "builds",
                "discussions": "conversation",
                "blogs": "briefing",
            }[section]
            added = 0
            for row in rows:
                if not isinstance(row, dict):
                    continue
                url = str(row.get("url", "")).strip()
                if not url or url in used_urls:
                    continue
                selected.append({**row, "newsletter_group": group})
                used_urls.add(url)
                added += 1
                if added >= limit:
                    break

    return selected


def _has_required_mix(items: list[dict[str, Any]]) -> bool:
    return (
        all(
            sum(item.get("interest_id") == interest for item in items) == count
            for interest, count in NEWS_STORY_COUNTS.items()
        )
        and 1 <= sum(item.get("newsletter_group") == "builds" for item in items) <= 2
        and sum(item.get("newsletter_group") == "conversation" for item in items) == 1
        and sum(item.get("newsletter_group") == "briefing" for item in items) == 1
    )


def _source_name(item: dict[str, Any]) -> str:
    source = str(item.get("source_name", "")).strip()
    if source:
        return source
    source = item.get("source")
    if isinstance(source, str) and source.strip():
        return source.strip()
    url = str(item.get("url", "")).strip()
    host = (urlparse(url).hostname or "").lower().replace("www.", "")
    return host or "Source"


def _plain_text(value: Any) -> str:
    return re.sub(r"[*_`]+", "", str(value or "")).strip()


def _summary_body(item: dict[str, Any]) -> str:
    if item.get("editorial_body"):
        return _plain_text(item["editorial_body"])
    summary = item.get("summary", {})
    if isinstance(summary, dict):
        short = summary.get("short_article", {})
        if isinstance(short, dict) and short.get("body"):
            return _plain_text(short["body"])
    return _plain_text(item.get("description", ""))


def _key_takeaways(item: dict[str, Any]) -> list[str]:
    editorial = item.get("editorial_takeaways")
    if isinstance(editorial, list):
        return [_plain_text(value) for value in editorial if _plain_text(value)][:3]

    summary = item.get("summary", {})
    short = summary.get("short_article", {}) if isinstance(summary, dict) else {}
    if not isinstance(short, dict):
        return []

    takeaways: list[str] = []
    for value in list(short.get("key_takeaways", []) or []) + list(short.get("slides", []) or []):
        cleaned = re.sub(r"^Slide \d+:\s*", "", _plain_text(value), flags=re.IGNORECASE)
        if cleaned and cleaned not in takeaways:
            takeaways.append(cleaned)
        if len(takeaways) >= 3:
            break
    return takeaways


def _editorial_briefing(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "section": item.get("newsletter_group", ""),
            "category": item.get("interest_id", ""),
            "title": item.get("title", ""),
            "source": _source_name(item),
            "url": item.get("url", ""),
            "facts": _summary_body(item),
            "takeaways": _key_takeaways(item),
        }
        for item in items
    ]


def _build_editorial_edition(
    store: FirestoreStore,
    feed: dict[str, Any],
    date: str,
    *,
    force: bool = False,
    persist: bool = True,
) -> dict[str, Any]:
    items = _pick_items(feed)
    if not _has_required_mix(items):
        return {}

    briefing = _editorial_briefing(items)
    fingerprint = hashlib.sha256(
        json.dumps(briefing, ensure_ascii=False, sort_keys=True).encode()
    ).hexdigest()
    doc_ref = store.db.collection("newsletter_editions").document(date)
    existing = doc_ref.get()
    if existing.exists and not force:
        cached = existing.to_dict() or {}
        if (
            cached.get("version") == EDITORIAL_VERSION
            and cached.get("fingerprint") == fingerprint
            and cached.get("stories")
        ):
            return cached

    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key or not items:
        return {}

    prompt = (
        "Turn this factual briefing into a self-contained Trace newsletter edition.\n\n"
        "The reader should understand every item without opening a link. This is an editorial "
        "rewrite, not a new summary: use only the supplied facts and never add facts, numbers, "
        "quotes, opinions, or implications that are not supported by the briefing.\n\n"
        "Write like a sharp, calm technology editor. Make the edition flow naturally and make "
        "technical material easy to read without dumbing it down. Avoid hype, filler, greetings, "
        "marketing language, and phrases such as 'the key takeaway'.\n\n"
        "Rules:\n"
        "- Write a 35-60 word intro that gives the shape of the day.\n"
        "- Keep every supplied story, in the same order and section.\n"
        "- Preserve each title and URL exactly.\n"
        "- For news and briefings, target 90-130 words across two short paragraphs when the "
        "supplied facts support it.\n"
        "- For builds and conversations, write a concise 35-70 word note.\n"
        "- Add 2-3 factual takeaways only when the supplied material supports them.\n"
        "- Never pad thin material or invent detail to reach a length target.\n"
        "- The subject must be concrete, plain, and under 55 characters.\n\n"
        f"Briefing:\n{json.dumps(briefing, ensure_ascii=False)}\n\n"
        "Return only JSON with this shape:\n"
        '{"subject":"...","intro":"...","stories":['
        '{"title":"exact title","url":"exact url","body":"two short paragraphs separated by \\n\\n",'
        '"takeaways":["...","..."]}]}'
    )

    try:
        response = OpenAI(api_key=api_key).chat.completions.create(
            model=EDITORIAL_MODEL,
            temperature=0.4,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You edit Trace, a daily briefing for builders. Accuracy is absolute. "
                        "Use only the supplied briefing."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
        )
        written = json.loads(response.choices[0].message.content or "{}")
    except Exception as exc:
        print(f"[newsletter] editorial rewrite failed, using stored summaries: {exc}")
        return {}

    drafts = {
        str(story.get("url", "")).strip(): story
        for story in written.get("stories", [])
        if isinstance(story, dict) and str(story.get("url", "")).strip()
    }
    stories = []
    for item in items:
        url = str(item.get("url", "")).strip()
        draft = drafts.get(url, {})
        body = _plain_text(draft.get("body", ""))
        takeaways = draft.get("takeaways", [])
        if not body or not isinstance(takeaways, list):
            body = _summary_body(item)
            takeaways = _key_takeaways(item)
        stories.append(
            {
                "url": url,
                "body": body,
                "takeaways": [_plain_text(value) for value in takeaways if _plain_text(value)][:3],
            }
        )

    edition = {
        "version": EDITORIAL_VERSION,
        "date": date,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "model": EDITORIAL_MODEL,
        "fingerprint": fingerprint,
        "subject": _plain_text(written.get("subject", "")),
        "intro": _plain_text(written.get("intro", "")),
        "stories": stories,
    }
    if persist:
        doc_ref.set(edition)
    return edition


def _apply_editorial(
    items: list[dict[str, Any]],
    edition: dict[str, Any],
) -> list[dict[str, Any]]:
    drafts = {
        str(story.get("url", "")).strip(): story
        for story in edition.get("stories", [])
        if isinstance(story, dict)
    }
    out = []
    for item in items:
        draft = drafts.get(str(item.get("url", "")).strip(), {})
        out.append(
            {
                **item,
                "editorial_body": draft.get("body", ""),
                "editorial_takeaways": draft.get("takeaways", []),
            }
        )
    return out


def _image_url(item: dict[str, Any]) -> str:
    for key in ("thumbnail", "image_url", "imageUrl", "urlToImage", "image"):
        value = str(item.get(key, "")).strip()
        if value.startswith(("https://", "http://")):
            return value
    return "https://www.yourtrace.online/trace.png"


def _paragraph_html(text: str) -> str:
    paragraphs = [escape(part.strip()) for part in re.split(r"\n\s*\n", text) if part.strip()]
    return "".join(
        f'<p style="margin: 0 0 12px 0; font-size: 15px; color: #4f4c45; '
        f'line-height: 1.7; font-family: -apple-system, BlinkMacSystemFont, '
        f'\'Segoe UI\', sans-serif;">{paragraph}</p>'
        for paragraph in paragraphs
    )


def _render_item(item: dict[str, Any]) -> str:
    title = escape(str(item.get("title", "Untitled")).removeprefix("Article: ").strip())
    url = escape(str(item.get("url", "#")))
    source = escape(_source_name(item))
    summary_html = _paragraph_html(_summary_body(item))
    image_url = escape(_image_url(item))
    group = str(item.get("newsletter_group", "top_stories"))
    label = (
        str(item.get("interest_id", "tech")).replace("-", " ").upper()
        if group == "top_stories"
        else group.replace("_", " ").upper()
    )
    label = escape(label)
    takeaway_html = "".join(
        '<tr><td style="width: 16px; padding: 0 8px 8px 0; color: #2f5bd5; '
        'font-size: 16px; line-height: 1.45; vertical-align: top;">&bull;</td>'
        f'<td style="padding: 0 0 8px 0; color: #4f4c45; font-size: 14px; '
        "line-height: 1.55; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', "
        f'sans-serif; vertical-align: top;">{escape(takeaway)}</td></tr>'
        for takeaway in _key_takeaways(item)
    )
    takeaways_block = (
        '<p style="margin: 18px 0 10px 0; color: #2f5bd5; font-size: 11px; '
        'font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 800; '
        'letter-spacing: 1.2px; text-transform: uppercase;">Key takeaways</p>'
        f'<table width="100%" cellpadding="0" cellspacing="0" border="0">{takeaway_html}</table>'
    ) if takeaway_html else ""

    return (
        '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0;">'
        f'<tr><td><a href="{url}" style="text-decoration: none;">'
        f'<img src="{image_url}" alt="" width="624" style="display: block; width: 100%; height: auto; '
        'border: 0; border-radius: 8px;" /></a></td></tr>'
        '<tr><td style="padding: 18px 0 30px 0; border-bottom: 1px solid #e8e4dc;">'
        f'<p style="margin: 0 0 9px 0; font-size: 11px; color: #777268; letter-spacing: 1.1px; '
        f'font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 700;">{label} &nbsp;&middot;&nbsp; {source}</p>'
        f'<a href="{url}" style="display: block; margin: 0 0 10px 0; font-size: 25px; '
        "font-family: Georgia, 'Times New Roman', serif; font-weight: 700; "
        f'color: #171714; text-decoration: none; line-height: 1.2;">{title}</a>'
        f"{summary_html}"
        f"{takeaways_block}"
        f'<a href="{url}" style="display: inline-block; margin-top: 7px; font-size: 13px; font-weight: 700; color: {ACCENT}; '
        'font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif; '
        'text-decoration: none;">Open original source &rarr;</a>'
        "</td></tr></table>"
    )


def _generate_html(
    feed: dict[str, Any],
    date: str,
    user_name: str,
    edition: dict[str, Any] | None = None,
) -> tuple[str, str]:
    tpl = _load_template("three_feed_newsletter.html")
    edition = edition or {}
    selected = _apply_editorial(_pick_items(feed), edition)

    intro_html = (
        '<p style="margin: 0; font-size: 15px; color: #625f57; line-height: 1.7; '
        "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;\">"
        f"{escape(str(edition.get('intro') or 'The top AI, startup, and engineering stories from today, plus what builders are making and discussing.'))}"
        "</p>"
    )

    stories_html = ""
    for group, label in (
        ("top_stories", "Top stories"),
        ("builds", "Builds"),
        ("conversation", "Conversation"),
        ("briefing", "Briefing"),
    ):
        rows = [item for item in selected if item.get("newsletter_group") == group]
        if not rows:
            continue
        stories_html += (
            '<p style="margin: 24px 0 14px 0; color: #2f5bd5; font-size: 11px; '
            'font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 800; '
            f'letter-spacing: 1.5px; text-transform: uppercase;">{escape(label)}</p>'
        )
        stories_html += "".join(_render_item(item) for item in rows)

    html = tpl.replace("{{DATE}}", _display_date(date))
    html = html.replace("{{STORY_COUNT}}", str(len(selected)))
    html = html.replace("{{INTRO_HTML}}", intro_html)
    html = html.replace("{{STORIES_HTML}}", stories_html)

    subject = str(edition.get("subject") or "").strip()
    if not subject:
        subject = f"{len(selected)} AI & tech stories worth knowing — {_display_date(date)}"
    return subject, html


def _generate_text(
    feed: dict[str, Any],
    date: str,
    edition: dict[str, Any] | None = None,
) -> str:
    edition = edition or {}
    selected = _apply_editorial(_pick_items(feed), edition)
    lines = [
        "TRACE",
        f"{len(selected)} things worth knowing - {date}",
        "",
        str(edition.get("intro") or "The top AI, startup, and engineering stories from today."),
        "",
    ]
    for idx, item in enumerate(selected, start=1):
        lines.append(f"{idx}. {item.get('title', 'Untitled')}")
        lines.append(f"   {_summary_body(item)}")
        for takeaway in _key_takeaways(item):
            lines.append(f"   - {takeaway}")
        lines.append(f"   {item.get('url', '')}")
        lines.append("")
    return "\n".join(lines)


def _load_daily_feed(store: FirestoreStore, owner: str, date: str) -> dict[str, Any]:
    doc = (
        store.db.collection("v3_user_feeds")
        .document(owner)
        .collection("daily")
        .document(date)
        .get()
    )
    if doc.exists:
        return doc.to_dict() or {}

    latest_docs = (
        store.db.collection("v3_user_feeds")
        .document(owner)
        .collection("daily")
        .order_by("__name__", direction=firestore.Query.DESCENDING)
        .limit(1)
        .stream()
    )
    for latest in latest_docs:
        return latest.to_dict() or {}
    return {}


def _load_newsletter_feed(store: FirestoreStore, date: str) -> dict[str, Any]:
    return _load_daily_feed(store, "_global", date)


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

    feed = _load_newsletter_feed(store, target_date)
    items = _pick_items(feed) if feed else []
    if not _has_required_mix(items):
        return {"success": False, "error": "incomplete newsletter content mix", "date": target_date}

    sent = 0
    failed = 0
    skipped = len(recipients)
    errors: list[str] = []
    eligible = []

    for row in recipients:
        # Missing preference is not consent. Legacy newsletterOptIn=true remains valid.
        profile = store.get_user_profile(row["uid"]) or {}
        if is_newsletter_enabled(profile):
            eligible.append(row)

    skipped -= len(eligible)
    edition = _build_editorial_edition(
        store,
        feed,
        target_date,
        persist=not dry_run,
    ) if eligible else {}

    for row in eligible:
        uid = row["uid"]
        subject, html = _generate_html(feed, target_date, row.get("name", ""), edition)
        text = _generate_text(feed, target_date, edition)

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
