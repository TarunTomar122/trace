"""
Build Newsletter for User - generates a daily newsletter for a single user.

Uses existing AI summaries from the feed (no additional LLM calls).

Orchestrates:
1. Load user's feed for the date
2. Filter to items with existing summaries (max 8)
3. Extract core insight, details, and relevance from summary
4. Store newsletter in Firestore

Usage:
    python v1/flows/build_newsletter_for_user.py --user_id USER_ID
    python v1/flows/build_newsletter_for_user.py --user_id USER_ID --date 2026-01-28
"""
import argparse
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env")

from v1.storage import FirestoreStore


# Maximum items to include in newsletter
MAX_NEWSLETTER_ITEMS_PRO = 8
MAX_NEWSLETTER_ITEMS_FREE = 3
# Cap free-tier sends to respect Brevo free tier
FREE_NEWSLETTER_RECIPIENT_LIMIT = 100


def _get_today_ist_date() -> str:
    """Get today's date in IST timezone."""
    ist_tz = timezone(timedelta(hours=5, minutes=30))
    return datetime.now(ist_tz).strftime("%Y-%m-%d")


def _get_user_feed(
    store: FirestoreStore,
    user_id: str,
    date: str,
) -> list[dict]:
    """Get user's feed items for the given date, excluding videos."""
    feed_doc = (
        store.db.collection("user_feeds")
        .document(user_id)
        .collection("daily")
        .document(date)
        .get()
    )
    if not feed_doc.exists:
        return []

    feed_data = feed_doc.to_dict() or {}
    items = feed_data.get("items", []) or []

    # Filter out videos
    non_video_items = [
        item for item in items
        if item.get("type") != "video"
        and item.get("source") != "video"
    ]

    return non_video_items


def _extract_section(body: str, headings: list[str]) -> Optional[str]:
    """
    Extract content under any matching ## heading from markdown body.

    Returns the text between the heading and the next ## heading
    (or end of body), stripped of markdown formatting.
    """
    if not body:
        return None

    for heading in headings:
        pattern = (
            rf"##\s*{re.escape(heading)}"
            r"(.*?)(?=\n##\s|\Z)"
        )
        match = re.search(pattern, body, re.DOTALL | re.IGNORECASE)
        if not match:
            continue

        content = match.group(1).strip()
        if not content:
            continue

        # Clean up markdown formatting for email
        # Remove ### sub-headings but keep text
        content = re.sub(r"###\s*", "", content)
        # Remove bold markers
        content = re.sub(r"\*\*(.*?)\*\*", r"\1", content)
        # Remove italic markers
        content = re.sub(r"\*(.*?)\*", r"\1", content)
        # Convert markdown bullet lists to plain text
        content = re.sub(r"^\s*[-*]\s+", "• ", content, flags=re.MULTILINE)

        return content.strip()

    return None


def _extract_first_section(body: str) -> Optional[str]:
    """
    Extract the first section of the body (content after first heading).
    Used as a lede fallback when no subtitle exists.
    """
    if not body:
        return None

    # Take content from the first section up to the next heading
    lines = body.strip().split("\n")
    result_lines = []
    found_first_heading = False

    for line in lines:
        if line.strip().startswith("## "):
            if not found_first_heading:
                found_first_heading = True
                continue  # Skip the first heading
            else:
                break  # Stop at the next heading
        result_lines.append(line)

    content = "\n".join(result_lines).strip()
    if not content:
        return None

    # Clean markdown
    content = re.sub(r"###\s*", "", content)
    content = re.sub(r"\*\*(.*?)\*\*", r"\1", content)
    content = re.sub(r"\*(.*?)\*", r"\1", content)

    return content.strip()


def _build_newsletter_summary(item: dict) -> str:
    """
    Build a newsletter-friendly summary from an item's existing
    AI summary. Extracts the core insight, key details, and relevance.

    Structure:
    - Lede paragraph from subtitle or first section
    - Optional bullets from outline
    - Optional personalization paragraph
    """
    summary = item.get("summary", {}) or {}
    short_article = summary.get("short_article", {}) or {}

    subtitle = short_article.get("subtitle", "")
    outline = short_article.get("outline", []) or []
    body = short_article.get("body", "")

    parts = []

    # Lede: use subtitle or the first body section
    insight_text = subtitle
    first_section = _extract_first_section(body)
    if first_section:
        # Take first 2-3 sentences from the core insight
        sentences = re.split(r"(?<=[.!?])\s+", first_section)
        excerpt = " ".join(sentences[:3]).strip()
        if excerpt:
            insight_text = excerpt

    if insight_text:
        parts.append(
            f"<p style=\"margin: 0 0 10px 0;\">{insight_text}</p>"
        )

    # Detail bullets from outline
    if outline:
        bullets = "".join(
            f"<li style=\"margin-bottom: 4px;\">{b}</li>"
            for b in outline[:4]
        )
        parts.append(
            f"<ul style=\"margin: 0 0 10px 18px; padding-left: 16px;\">"
            f"{bullets}</ul>"
        )

    if not parts:
        # Ultimate fallback: just use subtitle
        return subtitle or ""

    return "".join(parts)


def _select_items_with_summaries(
    items: list[dict],
    max_items: int = MAX_NEWSLETTER_ITEMS,
) -> list[dict]:
    """
    Select items that have AI summaries.
    Preserves feed order (already ranked by relevance).
    Ensures type diversity.
    """
    selected = []
    type_counts: dict[str, int] = {}

    for item in items:
        if len(selected) >= max_items:
            break

        # Must have a summary with body
        summary = item.get("summary", {}) or {}
        short_article = summary.get("short_article", {}) or {}
        if not short_article.get("body"):
            continue

        # Ensure type diversity (max 4 of same type)
        item_type = item.get("type", "blog")
        if type_counts.get(item_type, 0) >= 4:
            continue

        selected.append(item)
        type_counts[item_type] = type_counts.get(item_type, 0) + 1

    return selected


def build_newsletter_for_user(
    user_id: str,
    date: Optional[str] = None,
    force: bool = False,
) -> dict[str, Any]:
    """
    Build a newsletter for a single user using existing summaries.

    No LLM calls - uses AI summaries already generated for the feed.

    Args:
        user_id: User ID
        date: Date string (YYYY-MM-DD), defaults to today IST
        force: Rebuild even if newsletter already exists

    Returns:
        Result dict with item_count, success status, etc.
    """
    store = FirestoreStore()

    if not date:
        date = _get_today_ist_date()

    print(f"Building newsletter for user {user_id} on {date}...")

    # Check if newsletter already exists
    existing = store.get_user_newsletter(user_id, date)
    if existing and not force:
        return {
            "success": False,
            "error": "Newsletter already exists "
                     "(use --force to rebuild)",
            "user_id": user_id,
            "date": date,
        }

    # Get user profile
    profile = store.get_user_profile(user_id)
    if not profile:
        return {
            "success": False,
            "error": "User not found",
            "user_id": user_id,
            "date": date,
        }

    # Check if user has newsletter opt-in (explicit flag)
    from v1.newsletter_preferences import is_newsletter_enabled
    from v1.storage import is_user_subscribed

    if not is_newsletter_enabled(profile):
        return {
            "success": False,
            "error": "User has opted out of newsletter",
            "user_id": user_id,
            "date": date,
        }

    is_pro = is_user_subscribed(profile)
    max_items = MAX_NEWSLETTER_ITEMS_PRO if is_pro else MAX_NEWSLETTER_ITEMS_FREE
    if not is_pro:
        print(f"  Free tier — teaser limit {max_items} items (pro would get {MAX_NEWSLETTER_ITEMS_PRO})")

    # Get user's feed
    feed_items = _get_user_feed(store, user_id, date)
    if not feed_items:
        return {
            "success": False,
            "error": "No feed items for date",
            "user_id": user_id,
            "date": date,
        }

    print(f"  Found {len(feed_items)} non-video feed items")

    # Select items that have summaries (no LLM needed) — free gets teaser
    selected_items = _select_items_with_summaries(feed_items, max_items=max_items)

    if not selected_items:
        return {
            "success": False,
            "error": "No items with summaries found",
            "user_id": user_id,
            "date": date,
        }

    print(f"  Selected {len(selected_items)} items with summaries")

    # Build newsletter items from existing summaries
    newsletter_items = []
    for item in selected_items:
        newsletter_summary = _build_newsletter_summary(item)

        newsletter_item = {
            "id": item.get("id"),
            "title": item.get("title", ""),
            "url": item.get("url", ""),
            "summary": newsletter_summary,
            "source": item.get("source", ""),
            "type": item.get("type", ""),
            "tags": item.get("tags", []),
            "metadata": {
                "why_relevant": (
                    item.get("metadata", {}).get("why_relevant", "")
                ),
                "has_summary": True,
            },
        }
        # Only include thumbnail if it's a valid HTTP/HTTPS URL
        thumbnail = item.get("thumbnail", "")
        if thumbnail and isinstance(thumbnail, str):
            thumbnail_lower = thumbnail.lower()
            if thumbnail_lower.startswith(("http://", "https://")):
                newsletter_item["thumbnail"] = thumbnail

        newsletter_items.append(newsletter_item)

    # Generate email subject — teaser signals upsell for free
    if is_pro:
        email_subject = f"Your Daily Trace - {len(newsletter_items)} picks for {date}"
    else:
        remaining = MAX_NEWSLETTER_ITEMS_PRO - len(newsletter_items)
        email_subject = f"Your Daily Trace — {len(newsletter_items)} free + {remaining} Pro-only for {date}"

    # Build newsletter document — flag free teaser for template upsell
    newsletter_data = {
        "date": date,
        "user_id": user_id,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "send_time_ist": "10:00",
        "items": newsletter_items,
        "email_subject": email_subject,
        "email_html": "",  # Generated when sending
        "email_text": "",  # Generated when sending
        "status": "draft",
        "error": None,
        "is_pro": is_pro,
        "teaser": not is_pro,
    }

    # Save to Firestore
    store.save_user_newsletter(user_id, date, newsletter_data)

    print(f"  Newsletter saved with {len(newsletter_items)} items")

    return {
        "success": True,
        "user_id": user_id,
        "date": date,
        "item_count": len(newsletter_items),
        "items": [
            {"id": item["id"], "title": item["title"]}
            for item in newsletter_items
        ],
    }


def main():
    parser = argparse.ArgumentParser(
        description="Build newsletter for a user"
    )
    parser.add_argument("--user_id", required=True, help="User ID")
    parser.add_argument(
        "--date",
        help="Date (YYYY-MM-DD), defaults to today IST",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Rebuild even if newsletter already exists",
    )
    args = parser.parse_args()

    result = build_newsletter_for_user(
        args.user_id, args.date, force=args.force,
    )

    if result["success"]:
        print(f"\nSuccess! Newsletter has {result['item_count']} items")
        for item in result.get("items", []):
            print(f"  - {item['title'][:60]}...")
    else:
        print(f"\nFailed: {result.get('error')}")


if __name__ == "__main__":
    main()
