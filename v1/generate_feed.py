"""
Generate feed for a single user and save to Firestore.

Runs Feed Delivery Agent, formats items to match frontend schema,
and saves to user_feeds/{uid}/daily/{date}.

Usage:
    python v1/generate_feed.py --user_id abc123
"""
import argparse
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

project_root = str(Path(__file__).parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from v1.agents.feed_delivery import deliver_feed
from v1.storage import FirestoreStore


def format_feed_item(item: dict[str, Any]) -> dict[str, Any]:
    """
    Format a feed item to match the exact frontend schema.
    
    Frontend expects:
    {
        id: string,
        type: string,
        title: string,
        description: string,
        url: string,
        tags: string[],
        source: string,
        thumbnail?: string,
        metadata: {
            why_relevant: string,
            feed_category?: string
        }
    }
    """
    return {
        "id": item.get("id", ""),
        "type": item.get("type", "blog"),
        "title": item.get("title", ""),
        "description": item.get("description", ""),
        "url": item.get("url", ""),
        "tags": item.get("tags", []),
        "source": item.get("source", ""),
        "thumbnail": item.get("thumbnail"),
        "metadata": {
            "why_relevant": item.get("why_relevant", "Recommended for you"),
            "feed_category": "exploit",  # Main feed category
            "umbrella_id": item.get("umbrella_id"),
            "query_id": item.get("query_id"),
            "score": item.get("score", 0),
        }
    }


def update_seen_urls(store: FirestoreStore, user_id: str, urls: list[str]) -> None:
    """Update user_seen_urls with new URLs."""
    from firebase_admin import firestore as fs
    
    now = datetime.utcnow().isoformat()
    urls_update = {url: now for url in urls}
    
    doc_ref = store.db.collection("user_seen_urls").document(user_id)
    doc = doc_ref.get()
    
    if doc.exists:
        # Merge with existing
        existing = doc.to_dict().get("urls", {})
        existing.update(urls_update)
        doc_ref.update({
            "urls": existing,
            "updated_at": now
        })
    else:
        doc_ref.set({
            "urls": urls_update,
            "updated_at": now
        })


def generate_feed(user_id: str, date: str | None = None) -> dict[str, Any]:
    """
    Generate and save feed for a user.
    
    Args:
        user_id: The user's ID
        date: Optional date string (YYYY-MM-DD), defaults to today
    
    Returns:
        Feed data that was saved
    """
    store = FirestoreStore()
    
    if not date:
        date = datetime.utcnow().strftime("%Y-%m-%d")
    
    print(f"Generating feed for user {user_id} on {date}...")
    
    # Get scored items from Feed Delivery Agent
    items = deliver_feed(user_id)
    
    if not items:
        print(f"  Warning: No items generated for user {user_id}")
        # Still save an empty feed to indicate we tried
        feed_data = {
            "date": date,
            "items": [],
            "generated_at": datetime.utcnow().isoformat(),
            "metadata": {
                "version": "v1",
                "item_count": 0,
                "source_counts": {},
            }
        }
    else:
        # Format items for frontend
        formatted_items = [format_feed_item(item) for item in items]
        
        # Calculate source counts
        source_counts: dict[str, int] = {}
        for item in formatted_items:
            source = item.get("type", "other")
            source_counts[source] = source_counts.get(source, 0) + 1
        
        feed_data = {
            "date": date,
            "items": formatted_items,
            "generated_at": datetime.utcnow().isoformat(),
            "metadata": {
                "version": "v1",
                "item_count": len(formatted_items),
                "source_counts": source_counts,
                "freshness_ratio": 1.0,  # All items are fresh from pool
            }
        }
        
        # Update seen URLs
        urls = [item.get("url") for item in items if item.get("url")]
        if urls:
            print(f"  Updating seen URLs ({len(urls)} new)...")
            update_seen_urls(store, user_id, urls)
    
    # Save to Firestore: user_feeds/{uid}/daily/{date}
    print(f"  Saving feed to user_feeds/{user_id}/daily/{date}...")
    store.db.collection("user_feeds").document(user_id).collection("daily").document(date).set(feed_data)
    
    print(f"✓ Generated feed with {len(feed_data.get('items', []))} items")
    
    return feed_data


def main():
    parser = argparse.ArgumentParser(description="Generate feed for a user")
    parser.add_argument("--user_id", required=True, help="User ID to generate feed for")
    parser.add_argument("--date", help="Date string (YYYY-MM-DD), defaults to today")
    args = parser.parse_args()
    
    generate_feed(args.user_id, args.date)


if __name__ == "__main__":
    main()

