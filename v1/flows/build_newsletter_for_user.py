"""
Build Newsletter for User - generates a daily newsletter for a single user.

Orchestrates:
1. Load user's feed for the date
2. Use Gemini to select up to 8 best non-video items
3. Fetch article content for each item
4. Summarize each item using Gemini
5. Store newsletter in Firestore

Usage:
    python v1/flows/build_newsletter_for_user.py --user_id USER_ID
    python v1/flows/build_newsletter_for_user.py --user_id USER_ID --date 2026-01-28
"""
import argparse
import json
import os
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
from v1.tools.fetch_article_content import fetch_article_content


# Maximum items to include in newsletter
MAX_NEWSLETTER_ITEMS = 8


def _get_today_ist_date() -> str:
    """Get today's date in IST timezone."""
    ist_tz = timezone(timedelta(hours=5, minutes=30))
    return datetime.now(ist_tz).strftime("%Y-%m-%d")


def _get_user_feed(store: FirestoreStore, user_id: str, date: str) -> list[dict]:
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
        if item.get("type") != "video" and item.get("source") != "video"
    ]

    return non_video_items


def _select_items_with_gemini(
    items: list[dict],
    user_profile: dict,
    max_items: int = MAX_NEWSLETTER_ITEMS,
) -> list[str]:
    """
    Use Gemini to select the best items for the newsletter.

    Args:
        items: List of feed items
        user_profile: User profile with interests, goals, etc.
        max_items: Maximum number of items to select

    Returns:
        List of selected item IDs
    """
    if not items:
        return []

    try:
        from google import genai

        client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

        # Build compact item list for the prompt
        item_list = []
        for item in items[:30]:  # Limit to 30 items to avoid token limits
            item_list.append({
                "id": item.get("id"),
                "title": item.get("title", "")[:100],
                "type": item.get("type", ""),
                "tags": item.get("tags", [])[:3],
                "why_relevant": item.get("metadata", {}).get("why_relevant", "")[:100],
            })

        # Build user context
        user_context = {
            "role": user_profile.get("role", ""),
            "interests": user_profile.get("interests", [])[:5],
            "goals_short_term": user_profile.get("goals", {}).get("shortTerm", ""),
            "learning_style": user_profile.get("learningStyle", ""),
            "content_depth": user_profile.get("contentDepth", ""),
        }

        prompt = f"""Select the {max_items} BEST items for this user's daily newsletter.

USER PROFILE:
{json.dumps(user_context, indent=2)}

AVAILABLE ITEMS:
{json.dumps(item_list, indent=2)}

SELECTION CRITERIA:
1. Relevance to user's interests and goals
2. Diversity of topics (don't pick too many similar items)
3. Quality indicators (clear titles, good tags)

INSTRUCTIONS:
- Return ONLY a JSON array of item IDs
- Order by relevance (best first)
- Select up to {max_items} items

EXAMPLE OUTPUT:
["topic_ai-agents_blog_0_2026-01-29", "topic_python_discussion_1_2026-01-29", "trending_tech_0_2026-01-29"]

YOUR RESPONSE (valid JSON array only):"""

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config={
                "temperature": 0.2,
                "max_output_tokens": 500,
                "response_mime_type": "application/json",
            }
        )

        selected_ids = json.loads(response.text.strip())

        # Validate IDs exist in items
        valid_ids = {item.get("id") for item in items}
        selected_ids = [id for id in selected_ids if id in valid_ids]

        return selected_ids[:max_items]

    except Exception as e:
        print(f"  Warning: Gemini selection failed: {e}")
        return []


def _fallback_select_items(
    items: list[dict],
    max_items: int = MAX_NEWSLETTER_ITEMS,
) -> list[str]:
    """
    Fallback selection when Gemini fails.
    Selects items based on feed order and type diversity.
    """
    if not items:
        return []

    selected = []
    selected_tags = set()
    selected_types = {}

    for item in items:
        if len(selected) >= max_items:
            break

        item_id = item.get("id")
        item_type = item.get("type", "blog")
        item_tags = set(item.get("tags", []))

        # Skip if we already have 3 items of this type
        if selected_types.get(item_type, 0) >= 3:
            continue

        # Prefer items with new tags
        if item_tags and item_tags.issubset(selected_tags) and len(selected) > 3:
            continue

        selected.append(item_id)
        selected_tags.update(item_tags)
        selected_types[item_type] = selected_types.get(item_type, 0) + 1

    return selected


def _fetch_and_cache_content(
    store: FirestoreStore,
    url: str,
) -> Optional[str]:
    """Fetch article content, using cache if available."""
    # Check cache first
    cached = store.get_cached_content(url)
    if cached and cached.get("content"):
        return cached["content"]

    # Fetch fresh content
    result = fetch_article_content(url)

    # Cache the result (even failures)
    store.save_cached_content(
        url=url,
        content=result.get("content", ""),
        is_paywalled=result.get("is_paywalled", False),
        error=result.get("error"),
    )

    if result.get("success"):
        return result["content"]
    return None


def _summarize_items_batch(
    items_with_content: list[dict],
    user_profile: dict,
) -> dict[str, str]:
    """
    Batch summarize multiple items using Gemini.

    Args:
        items_with_content: List of dicts with 'id', 'title', 'content'
        user_profile: User profile for context

    Returns:
        Dict mapping item ID to summary
    """
    if not items_with_content:
        return {}

    try:
        from google import genai

        client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

        # Build items for summarization
        items_for_prompt = []
        for item in items_with_content:
            content = item.get("content", "") or item.get("description", "")
            # Truncate content to avoid token limits
            if len(content) > 3000:
                content = content[:3000] + "..."

            items_for_prompt.append({
                "id": item["id"],
                "title": item.get("title", ""),
                "content": content,
            })

        user_context = f"""User role: {user_profile.get('role', 'professional')}
User interests: {', '.join(user_profile.get('interests', [])[:3])}
User goals: {user_profile.get('goals', {}).get('shortTerm', '')}"""

        prompt = f"""Summarize each article for a daily newsletter.

{user_context}

ARTICLES TO SUMMARIZE:
{json.dumps(items_for_prompt, indent=2)}

INSTRUCTIONS:
- Each summary: 2-3 engaging sentences (NO bullet points)
- Focus on key insights and why it matters
- Return a JSON object mapping item ID to summary string

EXAMPLE OUTPUT:
{{"topic_ai_blog_0_2026-01-29": "New research shows AI agents can now autonomously debug code with 90% accuracy. This could dramatically reduce developer time spent on bug fixes.", "topic_python_discussion_1_2026-01-29": "The Python community debates async vs sync patterns for web APIs. Key takeaway: async shines for I/O-bound workloads but adds complexity."}}

YOUR RESPONSE (valid JSON object only):"""

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config={
                "temperature": 0.3,
                "max_output_tokens": 2000,
                "response_mime_type": "application/json",
            }
        )

        summaries = json.loads(response.text.strip())
        return summaries

    except Exception as e:
        print(f"  Warning: Batch summarization failed: {e}")
        return {}


def _summarize_single_item(
    item: dict,
    user_profile: dict,
) -> Optional[str]:
    """Fallback: summarize a single item."""
    try:
        from google import genai

        client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

        content = item.get("content", "") or item.get("description", "")
        if len(content) > 3000:
            content = content[:3000] + "..."

        prompt = f"""Summarize this article in 2-3 sentences for a newsletter. No bullets, just flowing text.

Title: {item.get('title', '')}
Content: {content}

Write an engaging summary that highlights key insights."""

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )

        return response.text.strip()

    except Exception as e:
        print(f"  Warning: Single summarization failed: {e}")
        return None


def build_newsletter_for_user(
    user_id: str,
    date: Optional[str] = None,
) -> dict[str, Any]:
    """
    Build a newsletter for a single user.

    Args:
        user_id: User ID
        date: Date string (YYYY-MM-DD), defaults to today IST

    Returns:
        Result dict with item_count, success status, etc.
    """
    store = FirestoreStore()

    if not date:
        date = _get_today_ist_date()

    print(f"Building newsletter for user {user_id} on {date}...")

    # Get user profile
    profile = store.get_user_profile(user_id)
    if not profile:
        return {
            "success": False,
            "error": "User not found",
            "user_id": user_id,
            "date": date,
        }

    # Check if user has newsletter opt-in (default True)
    if not profile.get("newsletterOptIn", True):
        return {
            "success": False,
            "error": "User has opted out of newsletter",
            "user_id": user_id,
            "date": date,
        }

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

    # Select items using Gemini (with fallback)
    selected_ids = _select_items_with_gemini(feed_items, profile)
    if not selected_ids:
        print("  Using fallback selection")
        selected_ids = _fallback_select_items(feed_items)

    if not selected_ids:
        return {
            "success": False,
            "error": "Could not select any items",
            "user_id": user_id,
            "date": date,
        }

    print(f"  Selected {len(selected_ids)} items")

    # Get full item data for selected items
    id_to_item = {item.get("id"): item for item in feed_items}
    selected_items = [id_to_item[id] for id in selected_ids if id in id_to_item]

    # Fetch content for each item
    items_with_content = []
    for item in selected_items:
        url = item.get("url")
        if not url:
            continue

        content = _fetch_and_cache_content(store, url)
        item_copy = dict(item)
        item_copy["content"] = content
        items_with_content.append(item_copy)

    print(f"  Fetched content for {len(items_with_content)} items")

    # Summarize items (batch first, then fallback to individual)
    summaries = _summarize_items_batch(items_with_content, profile)

    # Fallback for items without summaries
    for item in items_with_content:
        item_id = item.get("id")
        if item_id not in summaries or not summaries[item_id]:
            summary = _summarize_single_item(item, profile)
            if summary:
                summaries[item_id] = summary

    # Build newsletter items
    newsletter_items = []
    for item in items_with_content:
        item_id = item.get("id")
        summary = summaries.get(item_id, "")

        # Fallback to description if no summary
        if not summary:
            summary = item.get("description", "")[:200]

        newsletter_items.append({
            "id": item_id,
            "title": item.get("title", ""),
            "url": item.get("url", ""),
            "summary": summary,
            "source": item.get("source", ""),
            "type": item.get("type", ""),
            "tags": item.get("tags", []),
            "metadata": {
                "why_relevant": item.get("metadata", {}).get("why_relevant", ""),
                "selected_by": "gemini" if item_id in selected_ids else "fallback",
            },
        })

    # Generate email subject
    email_subject = f"Your Daily Trace - {len(newsletter_items)} picks for {date}"

    # Build newsletter document
    newsletter_data = {
        "date": date,
        "user_id": user_id,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "send_time_ist": "10:00",
        "items": newsletter_items,
        "email_subject": email_subject,
        "email_html": "",  # Will be generated when sending
        "email_text": "",  # Will be generated when sending
        "status": "draft",
        "error": None,
    }

    # Save to Firestore
    store.save_user_newsletter(user_id, date, newsletter_data)

    print(f"  Newsletter saved with {len(newsletter_items)} items")

    return {
        "success": True,
        "user_id": user_id,
        "date": date,
        "item_count": len(newsletter_items),
        "items": [{"id": item["id"], "title": item["title"]} for item in newsletter_items],
    }


def main():
    parser = argparse.ArgumentParser(description="Build newsletter for a user")
    parser.add_argument("--user_id", required=True, help="User ID")
    parser.add_argument("--date", help="Date (YYYY-MM-DD), defaults to today IST")
    args = parser.parse_args()

    result = build_newsletter_for_user(args.user_id, args.date)

    if result["success"]:
        print(f"\nSuccess! Newsletter has {result['item_count']} items")
        for item in result.get("items", []):
            print(f"  - {item['title'][:60]}...")
    else:
        print(f"\nFailed: {result.get('error')}")


if __name__ == "__main__":
    main()
