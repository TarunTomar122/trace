"""
Build Free Newsletter - curates top AI/tech stories from today's subscribed
user feeds, scores them for broad appeal, then uses a single LLM call to
write a punchy subject line and editorial intro.

Usage:
    python v1/flows/build_free_newsletter.py --date 2026-02-05
    python v1/flows/build_free_newsletter.py  # defaults to today
"""
import argparse
import json
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

from openai import OpenAI
from v1.storage import FirestoreStore

MAX_FREE_ITEMS = 6
MIN_FREE_ITEMS = 4

# Topics that score highly — broadly appealing to a tech/curious audience
HIGH_VALUE_TAGS = {
    "artificial-intelligence", "ai", "machine-learning", "deep-learning",
    "large-language-models", "llm", "gpt", "generative-ai",
    "technology", "software", "programming", "developer", "open-source",
    "startup", "business", "productivity", "science", "research",
    "robotics", "automation", "data-science", "cybersecurity", "cloud",
}

MEDIUM_VALUE_TAGS = {
    "health", "psychology", "design", "career", "finance", "investing",
    "space", "biology", "climate", "education",
}

# Types we want (no videos — transcripts aren't ideal for email)
ALLOWED_TYPES = {"blog", "news", "discussion", "paper", "repo", "launch"}


def _get_today_ist_date() -> str:
    ist_tz = timezone(timedelta(hours=5, minutes=30))
    return datetime.now(ist_tz).strftime("%Y-%m-%d")


def _score_item(item: dict, url_user_counts: dict[str, int]) -> float:
    """
    Score an item for free newsletter inclusion.
    Higher = more broadly appealing.
    """
    score = 0.0
    tags = [t.lower() for t in (item.get("tags") or [])]
    item_type = item.get("type", "blog")

    # Topic relevance
    for tag in tags:
        if tag in HIGH_VALUE_TAGS:
            score += 3.0
            break
    for tag in tags:
        if tag in MEDIUM_VALUE_TAGS:
            score += 1.0
            break

    # Overlap: appeared in multiple users' feeds → broadly interesting
    url = item.get("url", "")
    overlap = url_user_counts.get(url, 1)
    score += min(overlap - 1, 4) * 1.5  # cap at 4 users bonus

    # Quality signals
    summary = item.get("summary", {}) or {}
    short = summary.get("short_article", {}) or {}
    if short.get("subtitle"):
        score += 0.5
    if short.get("outline"):
        score += 0.5
    if item.get("thumbnail"):
        score += 0.5
    if item_type in {"news", "paper", "launch"}:
        score += 1.0  # fresh/important content types

    return score


def _collect_and_score(
    store: FirestoreStore,
    date: str,
) -> list[dict]:
    """
    Collect all items with summaries from subscribed user feeds,
    deduplicate by URL, score each, and return sorted best-first.
    """
    users = store.get_newsletter_opted_in_users()
    print(f"  Scanning feeds from {len(users)} subscribed users")

    # Count how many users have each URL (overlap signal)
    url_user_counts: dict[str, int] = {}
    url_to_item: dict[str, dict] = {}

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
            if not url:
                continue

            item_type = item.get("type", "blog")
            if item_type not in ALLOWED_TYPES and item.get("source") != "youtube" is False:
                pass  # allow all non-video types

            # Must have a real summary
            summary = item.get("summary", {}) or {}
            short = summary.get("short_article", {}) or {}
            if not short.get("body"):
                continue

            url_user_counts[url] = url_user_counts.get(url, 0) + 1
            # Keep the item with the most complete data
            if url not in url_to_item:
                url_to_item[url] = item

    all_items = list(url_to_item.values())
    print(f"  Found {len(all_items)} unique items with summaries")

    # Score and sort
    scored = [(item, _score_item(item, url_user_counts)) for item in all_items]
    scored.sort(key=lambda x: x[1], reverse=True)

    return [item for item, _ in scored]


def _select_diverse_items(
    items: list[dict],
    max_items: int = MAX_FREE_ITEMS,
) -> list[dict]:
    """
    Select items ensuring:
    - At least 2-3 AI/tech items (top priority)
    - No more than 2 items from the same broad category
    - Prefer items with thumbnails for visual appeal
    """
    selected: list[dict] = []
    seen_urls: set[str] = set()
    category_counts: dict[str, int] = {}

    def get_broad_category(item: dict) -> str:
        tags = [t.lower() for t in (item.get("tags") or [])]
        for tag in tags:
            if tag in HIGH_VALUE_TAGS:
                return "tech"
        for tag in tags:
            if tag in MEDIUM_VALUE_TAGS:
                return tag
        return "other"

    # First pass: take top AI/tech items (up to 3)
    for item in items:
        if len(selected) >= 3:
            break
        url = item.get("url", "")
        if url in seen_urls:
            continue
        cat = get_broad_category(item)
        if cat == "tech":
            selected.append(item)
            seen_urls.add(url)
            category_counts["tech"] = category_counts.get("tech", 0) + 1

    # Second pass: fill remaining slots with diverse items
    for item in items:
        if len(selected) >= max_items:
            break
        url = item.get("url", "")
        if url in seen_urls:
            continue
        cat = get_broad_category(item)
        if category_counts.get(cat, 0) >= 2:
            continue  # don't over-represent any category
        selected.append(item)
        seen_urls.add(url)
        category_counts[cat] = category_counts.get(cat, 0) + 1

    # Last resort: fill any remaining slots ignoring category cap
    for item in items:
        if len(selected) >= max_items:
            break
        url = item.get("url", "")
        if url not in seen_urls:
            selected.append(item)
            seen_urls.add(url)

    return selected


def _generate_editorial(
    client: OpenAI,
    items: list[dict],
    date: str,
) -> tuple[str, str]:
    """
    Single LLM call to produce:
    - A punchy email subject line
    - A 2-3 sentence editorial intro paragraph

    Returns (subject, intro_html)
    """
    item_summaries = []
    for item in items:
        short = (item.get("summary", {}) or {}).get("short_article", {}) or {}
        item_summaries.append({
            "title": item.get("title", ""),
            "subtitle": short.get("subtitle", ""),
            "tags": item.get("tags", []),
            "type": item.get("type", "blog"),
        })

    prompt = f"""You are the editor of Trace, a daily AI & tech newsletter. 
Today is {date}. Here are the {len(items)} stories in today's free newsletter:

{json.dumps(item_summaries, indent=2)}

Write two things:

1. SUBJECT: A punchy email subject line (max 60 chars). Be specific — mention the actual topics/trends, not generic. Examples of good subject lines: "OpenAI's new model + 4 AI stories you missed", "Why big tech is betting on edge AI — and 5 more reads". No emojis.

2. INTRO: A 2-3 sentence editorial intro paragraph for the email body. Write as a smart, opinionated editor. Set the theme of today's edition. Sound human and engaged, not corporate. Reference 1-2 specific stories. End with a line that makes them want to read.

Return JSON only:
{{
  "subject": "...",
  "intro": "..."
}}"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.8,
            max_tokens=300,
        )
        data = json.loads(response.choices[0].message.content or "{}")
        subject = data.get("subject", "").strip()
        intro = data.get("intro", "").strip()

        if not subject:
            subject = f"Today in AI & tech — {len(items)} reads worth your time"
        if not intro:
            intro = "Here are today's top stories from across AI, tech, and beyond."

        # Wrap intro in HTML
        intro_html = f'<p style="margin: 0; font-size: 15px; color: #52525b; line-height: 1.7; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif;">{intro}</p>'
        return subject, intro_html

    except Exception as e:
        print(f"  Warning: editorial LLM call failed: {e}")
        subject = f"Today in AI & tech — {len(items)} reads worth your time"
        intro_html = '<p style="margin: 0; font-size: 15px; color: #52525b; line-height: 1.7;">Here are today\'s top stories from across AI, tech, and beyond.</p>'
        return subject, intro_html


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


def _build_item_summary_html(item: dict) -> str:
    """
    Build the HTML summary for a single newsletter item.
    Uses subtitle + first 3 sentences + up to 4 outline bullets.
    """
    summary = item.get("summary", {}) or {}
    short = summary.get("short_article", {}) or {}
    subtitle = short.get("subtitle", "")
    outline = short.get("outline", []) or []
    body = short.get("body", "")

    parts = []

    # Lede: first 3 sentences of first section, fallback to subtitle
    insight = subtitle
    first_section = _extract_first_section(body)
    if first_section:
        sentences = re.split(r"(?<=[.!?])\s+", first_section)
        excerpt = " ".join(sentences[:3]).strip()
        if excerpt:
            insight = excerpt
    if insight:
        parts.append(f'<p style="margin: 0 0 10px 0;">{insight}</p>')

    # Bullets
    if outline:
        bullets = "".join(
            f'<li style="margin-bottom: 5px;">{b}</li>'
            for b in outline[:4]
        )
        parts.append(
            '<ul style="margin: 0 0 10px 18px; padding-left: 16px;">'
            f'{bullets}</ul>'
        )

    if not parts:
        return subtitle or ""
    return "".join(parts)


def build_free_newsletter(
    date: Optional[str] = None,
    force: bool = False,
) -> dict[str, Any]:
    """
    Build a high-quality free newsletter focused on AI & tech.
    Uses one LLM call for editorial subject + intro.
    """
    store = FirestoreStore()
    client = OpenAI()

    if not date:
        date = _get_today_ist_date()

    print(f"Building free newsletter for {date}...")

    # Check existing
    existing = store.get_free_newsletter(date)
    if existing and not force:
        return {
            "success": False,
            "error": "Free newsletter already exists (use --force to rebuild)",
            "date": date,
        }

    # Collect and score items
    all_items = _collect_and_score(store, date)

    if len(all_items) < MIN_FREE_ITEMS:
        return {
            "success": False,
            "error": f"Not enough items ({len(all_items)} < {MIN_FREE_ITEMS})",
            "date": date,
        }

    # Select diverse, high-quality set
    selected = _select_diverse_items(all_items)
    print(f"  Selected {len(selected)} items for free newsletter")

    # Single LLM call for subject + intro
    print("  Generating editorial subject + intro...")
    subject, intro_html = _generate_editorial(client, selected, date)
    print(f"  Subject: {subject}")

    # Build newsletter items
    newsletter_items = []
    for item in selected:
        nl_item = {
            "id": item.get("id"),
            "title": item.get("title", ""),
            "url": item.get("url", ""),
            "summary": _build_item_summary_html(item),
            "type": item.get("type", "blog"),
            "source": item.get("source", ""),
            "tags": item.get("tags", []),
        }
        thumbnail = item.get("thumbnail", "")
        if thumbnail and isinstance(thumbnail, str) and thumbnail.lower().startswith(("http://", "https://")):
            nl_item["thumbnail"] = thumbnail
        if item.get("summary"):
            nl_item["full_summary"] = item["summary"]
        newsletter_items.append(nl_item)

    newsletter_data = {
        "date": date,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "items": newsletter_items,
        "item_count": len(newsletter_items),
        "email_subject": subject,
        "intro_html": intro_html,
        "status": "draft",
    }

    store.save_free_newsletter(date, newsletter_data)

    print(f"  Free newsletter saved: {len(newsletter_items)} items")
    for item in newsletter_items:
        print(f"    - [{item['type']}] {item['title'][:60]}...")

    return {
        "success": True,
        "date": date,
        "item_count": len(newsletter_items),
        "subject": subject,
        "items": [{"id": i["id"], "title": i["title"]} for i in newsletter_items],
    }


def main():
    parser = argparse.ArgumentParser(
        description="Build free newsletter from top AI/tech summaries"
    )
    parser.add_argument("--date", help="Date (YYYY-MM-DD), defaults to today IST")
    parser.add_argument("--force", action="store_true", help="Rebuild even if already exists")
    args = parser.parse_args()

    result = build_free_newsletter(args.date, force=args.force)

    if result["success"]:
        print(f"\nDone! {result['item_count']} items — \"{result['subject']}\"")
    else:
        print(f"\nFailed: {result.get('error')}")


if __name__ == "__main__":
    main()
