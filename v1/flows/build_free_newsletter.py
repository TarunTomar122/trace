"""
Build Free Newsletter - picks top items from today's subscribed
users' summaries and creates a generic newsletter for free users.

No LLM calls. Picks 5-7 diverse items across topics from the
best summaries already generated for paid users.

Usage:
    python v1/flows/build_free_newsletter.py --date 2026-02-05
    python v1/flows/build_free_newsletter.py  # defaults to today
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

MAX_FREE_ITEMS = 7
MIN_FREE_ITEMS = 5


def _get_today_ist_date() -> str:
    ist_tz = timezone(timedelta(hours=5, minutes=30))
    return datetime.now(ist_tz).strftime("%Y-%m-%d")


def _collect_all_summaries(
    store: FirestoreStore,
    date: str,
) -> list[dict]:
    """
    Collect all feed items with summaries across all
    subscribed users for the given date.
    Returns deduplicated items (by URL).
    """
    users = store.get_newsletter_opted_in_users()
    print(f"  Scanning feeds from {len(users)} subscribed users")

    seen_urls: set[str] = set()
    all_items: list[dict] = []

    for user in users:
        uid = user.get("uid", "")
        feed_doc = (
            store.db.collection("user_feeds")
            .document(uid)
            .collection("daily")
            .document(date)
            .get()
        )
        if not feed_doc.exists:
            continue

        feed_data = feed_doc.to_dict() or {}
        items = feed_data.get("items", []) or []

        for item in items:
            url = item.get("url", "")
            summary = item.get("summary", {}) or {}
            short = summary.get("short_article", {}) or {}
            body = short.get("body", "")

            # Must have summary and not be a video
            if (
                not body
                or item.get("type") == "video"
                or url in seen_urls
            ):
                continue

            seen_urls.add(url)
            all_items.append(item)

    return all_items


def _extract_first_section(body: str) -> Optional[str]:
    """Extract first section content (after first heading)."""
    if not body:
        return None
    lines = body.strip().split("\n")
    result_lines = []
    found_first = False
    for line in lines:
        if line.strip().startswith("## "):
            if not found_first:
                found_first = True
                continue
            else:
                break
        result_lines.append(line)
    content = "\n".join(result_lines).strip()
    if not content:
        return None
    content = re.sub(r"###\s*", "", content)
    content = re.sub(r"\*\*(.*?)\*\*", r"\1", content)
    content = re.sub(r"\*(.*?)\*", r"\1", content)
    return content.strip()


def _build_free_summary(item: dict) -> str:
    """
    Build a generic (non-personalized) summary for the free
    newsletter. Same structure as paid but skips the
    'Why it matters' personalized section.
    """
    summary = item.get("summary", {}) or {}
    short = summary.get("short_article", {}) or {}
    subtitle = short.get("subtitle", "")
    outline = short.get("outline", []) or []
    body = short.get("body", "")

    parts = []

    # Lede paragraph
    insight = subtitle
    first_section = _extract_first_section(body)
    if first_section:
        sentences = re.split(r"(?<=[.!?])\s+", first_section)
        excerpt = " ".join(sentences[:3]).strip()
        if excerpt:
            insight = excerpt
    if insight:
        parts.append(
            f"<p style=\"margin: 0 0 10px 0;\">{insight}</p>"
        )

    # Detail bullets
    if outline:
        bullets = "".join(
            f'<li style="margin-bottom: 4px;">{b}</li>'
            for b in outline[:4]
        )
        parts.append(
            '<ul style="margin: 0 0 10px 18px; padding-left: 16px;">'
            f'{bullets}</ul>'
        )

    if not parts:
        return subtitle or ""

    return "".join(parts)


def _select_diverse_items(
    items: list[dict],
    max_items: int = MAX_FREE_ITEMS,
) -> list[dict]:
    """
    Select diverse items — one per topic/type first, then
    fill remaining slots with highest-quality items.
    """
    # Group by type
    by_type: dict[str, list[dict]] = {}
    for item in items:
        t = item.get("type", "blog")
        by_type.setdefault(t, []).append(item)

    selected: list[dict] = []
    seen_urls: set[str] = set()

    # Round-robin: pick one from each type
    for t, t_items in by_type.items():
        if len(selected) >= max_items:
            break
        item = t_items[0]
        url = item.get("url", "")
        if url not in seen_urls:
            selected.append(item)
            seen_urls.add(url)

    # Fill remaining from all items
    for item in items:
        if len(selected) >= max_items:
            break
        url = item.get("url", "")
        if url not in seen_urls:
            selected.append(item)
            seen_urls.add(url)

    return selected


def build_free_newsletter(
    date: Optional[str] = None,
    force: bool = False,
) -> dict[str, Any]:
    """
    Build a generic free newsletter from today's best summaries.
    """
    store = FirestoreStore()

    if not date:
        date = _get_today_ist_date()

    print(f"Building free newsletter for {date}...")

    # Check existing
    existing = store.get_free_newsletter(date)
    if existing and not force:
        return {
            "success": False,
            "error": "Free newsletter already exists "
                     "(use --force to rebuild)",
            "date": date,
        }

    # Collect all summaries from subscribed users
    all_items = _collect_all_summaries(store, date)
    print(f"  Found {len(all_items)} unique items with summaries")

    if len(all_items) < MIN_FREE_ITEMS:
        return {
            "success": False,
            "error": f"Not enough items ({len(all_items)}"
                     f" < {MIN_FREE_ITEMS})",
            "date": date,
        }

    # Select diverse set
    selected = _select_diverse_items(all_items)
    print(f"  Selected {len(selected)} items for free newsletter")

    # Build newsletter items
    newsletter_items = []
    for item in selected:
        nl_item = {
            "id": item.get("id"),
            "title": item.get("title", ""),
            "url": item.get("url", ""),
            "summary": _build_free_summary(item),
            "type": item.get("type", "blog"),
            "source": item.get("source", ""),
            "tags": item.get("tags", []),
        }
        # Only include thumbnail if it's a valid HTTP/HTTPS URL
        thumbnail = item.get("thumbnail", "")
        if thumbnail and isinstance(thumbnail, str):
            thumbnail_lower = thumbnail.lower()
            if thumbnail_lower.startswith(("http://", "https://")):
                nl_item["thumbnail"] = thumbnail
        # Store full AI summary for /trending page rendering
        if item.get("summary"):
            nl_item["full_summary"] = item["summary"]
        newsletter_items.append(nl_item)

    email_subject = (
        f"Trace Daily — {len(newsletter_items)} "
        f"must-reads for {date}"
    )

    newsletter_data = {
        "date": date,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "items": newsletter_items,
        "item_count": len(newsletter_items),
        "email_subject": email_subject,
        "status": "draft",
    }

    store.save_free_newsletter(date, newsletter_data)

    print(f"  Free newsletter saved: {len(newsletter_items)} items")
    for item in newsletter_items:
        print(f"    - [{item['type']}] {item['title'][:55]}...")

    return {
        "success": True,
        "date": date,
        "item_count": len(newsletter_items),
        "items": [
            {"id": i["id"], "title": i["title"]}
            for i in newsletter_items
        ],
    }


def main():
    parser = argparse.ArgumentParser(
        description="Build free newsletter from top summaries"
    )
    parser.add_argument(
        "--date",
        help="Date (YYYY-MM-DD), defaults to today IST",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Rebuild even if already exists",
    )
    args = parser.parse_args()

    result = build_free_newsletter(args.date, force=args.force)

    if result["success"]:
        print(f"\nDone! {result['item_count']} items selected.")
    else:
        print(f"\nFailed: {result.get('error')}")


if __name__ == "__main__":
    main()
