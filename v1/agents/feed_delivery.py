"""
Feed Delivery Agent (The Concierge) - assembles personalized feeds from pool.

Pulls items from retrieval_pool, scores them for a specific user,
applies diversity filtering, checks for personal_signals,
and returns top 20 items (80% pool + 20% personal).

Usage:
    python v1/agents/feed_delivery.py --user_id abc123
"""
import argparse
import hashlib
import json
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env")

from v1.storage import FirestoreStore
from v1.scoring import score_item_for_user, apply_diversity_filter, generate_why_relevant


def get_user_seen_urls(store: FirestoreStore, user_id: str, days: int = 14) -> set[str]:
    """Get URLs the user has seen in the last N days."""
    seen_urls = set()
    try:
        doc = store.db.collection("user_seen_urls").document(user_id).get()
        if doc.exists:
            data = doc.to_dict()
            urls_dict = data.get("urls", {})
            cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()
            for url, seen_at in urls_dict.items():
                if seen_at and seen_at > cutoff:
                    seen_urls.add(url)
    except Exception:
        pass
    return seen_urls


def get_user_preferences(store: FirestoreStore, user_id: str) -> dict[str, Any]:
    """Get user preferences from user_preferences collection."""
    try:
        doc = store.db.collection("user_preferences").document(user_id).get()
        if doc.exists:
            return doc.to_dict() or {}
    except Exception:
        pass
    
    # Default preferences
    return {
        "source_distribution": {
            "video": 40, "blog": 35, "discussion": 15,
            "repo": 5, "paper": 0, "launch": 3, "tweet": 2, "model": 0
        },
        "contentDepth": "deep"
    }


def get_user_patterns(store: FirestoreStore, user_id: str) -> dict[str, Any]:
    """Get user patterns from user_patterns collection."""
    try:
        doc = store.db.collection("user_patterns").document(user_id).get()
        if doc.exists:
            return doc.to_dict() or {}
    except Exception:
        pass
    return {"tags": {}, "exclude_tags": [], "personal_signals": []}


def get_active_signals(patterns: dict[str, Any]) -> list[dict[str, Any]]:
    """Get active personal signals (not expired)."""
    signals = patterns.get("personal_signals", [])
    now = datetime.utcnow()
    
    active = []
    for signal in signals:
        expires_at_str = signal.get("expires_at", "")
        if not expires_at_str:
            continue
        
        try:
            expires_at = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
            if expires_at.tzinfo:
                expires_at = expires_at.replace(tzinfo=None)
            
            if expires_at > now:
                active.append(signal)
        except (ValueError, TypeError):
            continue
    
    return active


def search_personal_signal(query: str, max_results: int = 5) -> list[dict[str, Any]]:
    """
    Search for items matching a personal signal query using Tavily.
    
    Args:
        query: The search query from personal signal
        max_results: Maximum results to return (default 5)
    
    Returns:
        List of items from search
    """
    try:
        from tavily import TavilyClient
        
        tavily_key = os.getenv("TAVILY_API_KEY")
        if not tavily_key:
            print("  Warning: TAVILY_API_KEY not set, skipping personal search")
            return []
        
        client = TavilyClient(api_key=tavily_key)
        
        response = client.search(
            query=query,
            max_results=max_results,
            search_depth="basic"
        )
        
        items = []
        for result in response.get("results", []):
            # Create a unique ID for this item
            url = result.get("url", "")
            item_id = f"personal_{hashlib.md5(url.encode()).hexdigest()[:12]}"
            
            item = {
                "id": item_id,
                "url": url,
                "title": result.get("title", ""),
                "description": result.get("content", "")[:500],
                "type": "blog",  # Default type for personal searches
                "source": "tavily",
                "tags": [],
                "fetched_at": datetime.utcnow().isoformat(),
                "quality_signals": {},
                "metadata": {
                    "from_personal_signal": True
                }
            }
            items.append(item)
        
        return items
        
    except ImportError:
        print("  Warning: tavily package not installed")
        return []
    except Exception as e:
        print(f"  Error in personal search: {e}")
        return []


def deliver_feed(user_id: str, max_items: int = 20) -> list[dict[str, Any]]:
    """
    Deliver a personalized feed for a user from the retrieval pool.
    
    Includes 80% pool items and 20% personal search items (from signals).
    
    Args:
        user_id: The user's ID
        max_items: Maximum items to return (default 20)
    
    Returns:
        List of scored and filtered feed items
    """
    store = FirestoreStore()
    
    # Load user data
    print(f"Loading data for user {user_id}...")
    
    user_profile = store.get_user_profile(user_id)
    if not user_profile:
        print(f"  Error: User {user_id} not found")
        return []
    
    user_preferences = get_user_preferences(store, user_id)
    user_patterns = get_user_patterns(store, user_id)
    seen_urls = get_user_seen_urls(store, user_id, days=14)
    
    print(f"  Profile: {len(user_profile.get('interests', []))} interests")
    print(f"  Patterns: {len(user_patterns.get('tags', {}))} tags tracked")
    print(f"  Seen URLs: {len(seen_urls)} in last 14 days")
    
    # =========================================================================
    # PERSONAL SIGNALS - Check for active signals and run targeted searches
    # =========================================================================
    active_signals = get_active_signals(user_patterns)
    personal_items = []
    max_personal_items = int(max_items * 0.2)  # 20% of feed
    
    if active_signals:
        print(f"Found {len(active_signals)} active signals, searching...")
        
        for signal in active_signals:
            if len(personal_items) >= max_personal_items:
                break
            
            query = signal.get("query", "")
            if not query:
                continue
            
            # Search for this signal (max 5 results per signal)
            results = search_personal_signal(query, max_results=5)
            
            # Filter out already seen and add to personal items
            for item in results:
                if item.get("url") in seen_urls:
                    continue
                if item.get("url") in [p.get("url") for p in personal_items]:
                    continue
                
                # Add signal info to item
                item["signal_id"] = signal.get("signal_id", "")
                item["signal_query"] = query
                personal_items.append(item)
                
                if len(personal_items) >= max_personal_items:
                    break
        
        print(f"  Found {len(active_signals)} active signals, added {len(personal_items)} personal items")
    
    # =========================================================================
    # POOL ITEMS - Get items from retrieval pool
    # =========================================================================
    
    # Get user's umbrella IDs from interests
    interests = user_profile.get("interests", [])
    umbrella_ids = [i.lower().replace(" ", "-").replace("&", "and") for i in interests]
    
    # Calculate how many pool items we need
    pool_items_needed = max_items - len(personal_items)
    
    # Query pool for items matching user's umbrellas
    print(f"Querying pool for umbrellas: {umbrella_ids[:5]}...")
    
    all_items = []
    for umbrella_id in umbrella_ids:
        items = store.get_retrieval_pool(umbrella_id=umbrella_id)
        all_items.extend(items)
    
    # Also get some general items if we don't have enough
    if len(all_items) < pool_items_needed * 2:
        general_items = store.get_retrieval_pool()
        for item in general_items:
            if item.get("url") not in [i.get("url") for i in all_items]:
                all_items.append(item)
    
    print(f"  Found {len(all_items)} candidate items from pool")
    
    # Filter out seen URLs and personal item URLs
    personal_urls = {p.get("url") for p in personal_items}
    unseen_items = [
        item for item in all_items 
        if item.get("url") not in seen_urls and item.get("url") not in personal_urls
    ]
    print(f"  After deduplication: {len(unseen_items)} items")
    
    # Score each pool item
    print("Scoring pool items...")
    scored_items = []
    for item in unseen_items:
        score = score_item_for_user(item, user_profile, user_patterns, user_preferences)
        item_with_score = {**item, "_score": score}
        scored_items.append(item_with_score)
    
    # Sort by score descending
    scored_items.sort(key=lambda x: x.get("_score", 0), reverse=True)
    
    # Apply diversity filter
    print("Applying diversity filter...")
    filtered_pool_items = apply_diversity_filter(
        scored_items,
        max_per_domain=3,
        max_per_type=8,
        max_items=pool_items_needed
    )
    
    print(f"  Selected {len(filtered_pool_items)} pool items")
    
    # =========================================================================
    # MERGE AND FORMAT
    # =========================================================================
    
    # Format pool items
    feed_items = []
    for item in filtered_pool_items:
        why_relevant = generate_why_relevant(item, user_profile, item.get("_score", 0))
        
        feed_item = {
            "id": item.get("id", ""),
            "type": item.get("type", "blog"),
            "title": item.get("title", ""),
            "description": item.get("description", ""),
            "url": item.get("url", ""),
            "tags": item.get("tags", []),
            "source": item.get("source", ""),
            "thumbnail": item.get("thumbnail"),
            "umbrella_id": item.get("umbrella_id", ""),
            "query_id": item.get("query_id", ""),
            "score": item.get("_score", 0),
            "why_relevant": why_relevant,
            "quality_signals": item.get("quality_signals", {}),
            "metadata": {
                "from_personal_signal": False
            }
        }
        feed_items.append(feed_item)
    
    # Format and add personal items
    for item in personal_items:
        feed_item = {
            "id": item.get("id", ""),
            "type": item.get("type", "blog"),
            "title": item.get("title", ""),
            "description": item.get("description", ""),
            "url": item.get("url", ""),
            "tags": item.get("tags", []),
            "source": item.get("source", ""),
            "thumbnail": item.get("thumbnail"),
            "umbrella_id": "",
            "query_id": "",
            "score": 100,  # Personal items get high priority
            "why_relevant": f"Based on your interest: {item.get('signal_query', 'your feedback')}",
            "quality_signals": item.get("quality_signals", {}),
            "metadata": {
                "from_personal_signal": True,
                "signal_id": item.get("signal_id", ""),
                "signal_query": item.get("signal_query", "")
            }
        }
        feed_items.append(feed_item)
    
    # Log final mix
    pool_count = len(filtered_pool_items)
    personal_count = len(personal_items)
    print(f"Feed mix: {pool_count} pool items + {personal_count} personal items = {len(feed_items)} total")
    
    return feed_items


def main():
    parser = argparse.ArgumentParser(description="Deliver personalized feed for a user")
    parser.add_argument("--user_id", required=True, help="User ID to generate feed for")
    parser.add_argument("--max-items", type=int, default=20, help="Maximum items to return")
    args = parser.parse_args()
    
    items = deliver_feed(args.user_id, max_items=args.max_items)
    
    # Output as JSON
    print(json.dumps(items, indent=2))


if __name__ == "__main__":
    main()

