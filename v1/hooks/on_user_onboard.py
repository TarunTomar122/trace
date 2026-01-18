"""
Onboarding hook - runs when a new user completes onboarding.

Creates umbrellas if needed, maps user to queries, and generates first feed.

Usage:
    python v1/hooks/on_user_onboard.py --user_id abc123
"""
import argparse
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env")

from v1.storage import FirestoreStore
from v1.models import Umbrella, SubQuery
from v1.v1_agents.trend_discovery import discover_trends
from v1.generate_feed import generate_feed


def normalize_interest(interest: str) -> str:
    """Normalize an interest string to an umbrella ID."""
    return interest.lower().strip().replace(" ", "-").replace("&", "and")


def create_display_name(umbrella_id: str) -> str:
    """Create a display name from an umbrella ID."""
    return umbrella_id.replace("-", " ").title()


def ensure_umbrella_exists(store: FirestoreStore, interest: str, create_if_missing: bool = True) -> str | None:
    """
    Ensure an umbrella exists for an interest.
    
    Args:
        store: Firestore store
        interest: The interest string
        create_if_missing: Whether to create umbrella if it doesn't exist
    
    Returns:
        Umbrella ID if exists/created, None if failed
    """
    umbrella_id = normalize_interest(interest)
    
    if store.umbrella_exists(umbrella_id):
        return umbrella_id
    
    if not create_if_missing:
        return None
    
    print(f"  Creating new umbrella for '{interest}'...")
    
    try:
        # Discover trends using the agent
        queries = discover_trends(interest)
        
        # Create sub-queries
        sub_queries = []
        for i, query_text in enumerate(queries):
            sub_query = SubQuery(
                id=f"{umbrella_id}-{i}",
                text=query_text,
                source_hint="blog",
                user_count=0,
                last_searched=None
            )
            sub_queries.append(sub_query.model_dump())
        
        # Create umbrella
        umbrella = Umbrella(
            id=umbrella_id,
            display_name=create_display_name(umbrella_id),
            sub_queries=sub_queries,
            user_count=0,
            last_discovery_refresh=datetime.utcnow().isoformat()
        )
        
        store.create_umbrella(umbrella_id, umbrella.model_dump())
        print(f"    ✓ Created umbrella with {len(sub_queries)} sub-queries")
        return umbrella_id
        
    except Exception as e:
        print(f"    ✗ Error creating umbrella: {e}")
        return None


def map_user_to_umbrella_queries(store: FirestoreStore, user_id: str, umbrella_id: str) -> int:
    """
    Map a user to all sub-queries in an umbrella.
    
    Returns:
        Number of queries the user was mapped to
    """
    umbrella = store.get_umbrella(umbrella_id)
    if not umbrella:
        return 0
    
    sub_queries = umbrella.get("sub_queries", [])
    mapped = 0
    
    for sq in sub_queries:
        query_id = sq.get("id")
        query_text = sq.get("text", "")
        if query_id:
            store.add_user_to_query(query_id, user_id, query_text, umbrella_id)
            mapped += 1
    
    return mapped


def emergency_search_and_populate(store: FirestoreStore, interest: str) -> int:
    """
    Run emergency search to populate pool for a new interest.
    
    This is called when pool is empty for user's interests.
    Uses Tavily to search and populate pool immediately.
    
    Returns:
        Number of items added to pool
    """
    import hashlib
    from datetime import timedelta
    import requests
    import os
    
    print(f"  Running emergency search for '{interest}'...")
    
    umbrella_id = normalize_interest(interest)
    
    # Use Tavily for quick search
    api_key = os.getenv("TAVILY_API_KEY", "").strip()
    if not api_key:
        print("    Warning: TAVILY_API_KEY not set, skipping emergency search")
        return 0
    
    query = f"{interest} latest news tutorials"
    
    try:
        resp = requests.post(
            "https://api.tavily.com/search",
            json={
                "api_key": api_key,
                "query": query,
                "max_results": 10,
                "search_depth": "basic"
            },
            timeout=30
        )
        
        if resp.status_code >= 400:
            print(f"    Warning: Tavily error {resp.status_code}")
            return 0
        
        results = resp.json().get("results", [])
        today = datetime.utcnow().strftime("%Y-%m-%d")
        items_added = 0
        
        for r in results:
            url = r.get("url")
            if not url or store.pool_url_exists(url):
                continue
            
            url_hash = hashlib.md5(url.encode()).hexdigest()[:8]
            pool_id = f"pool_{today}_{url_hash}"
            
            item = {
                "id": pool_id,
                "url": url,
                "title": r.get("title", ""),
                "description": (r.get("content") or "")[:500],
                "type": "blog",
                "source": "tavily",
                "umbrella_id": umbrella_id,
                "query_id": f"{umbrella_id}-emergency",
                "tags": [umbrella_id],
                "fetched_at": datetime.utcnow().isoformat(),
                "expires_at": (datetime.utcnow() + timedelta(days=3)).isoformat(),
                "quality_signals": {"domain_authority": "medium", "has_code": False},
                "trending_score": 50,
                "freshness_score": 95,
            }
            
            store.add_to_pool(pool_id, item)
            items_added += 1
        
        print(f"    ✓ Added {items_added} emergency items to pool")
        return items_added
        
    except Exception as e:
        print(f"    Warning: Emergency search error: {e}")
        return 0


def on_user_onboard(user_id: str) -> dict[str, Any]:
    """
    Handle user onboarding completion.
    
    1. Reads user interests
    2. Creates umbrellas if needed
    3. Maps user to queries
    4. Generates first feed
    
    Args:
        user_id: The user's ID
    
    Returns:
        Stats dict with umbrellas_created, queries_mapped, feed_items
    """
    store = FirestoreStore()
    
    print(f"Processing onboarding for user {user_id}...")
    
    # Get user profile
    profile = store.get_user_profile(user_id)
    if not profile:
        print(f"  Error: User {user_id} not found")
        return {"error": "User not found"}
    
    interests = profile.get("interests", [])
    if not interests:
        print(f"  Warning: User has no interests")
        return {"error": "No interests"}
    
    print(f"  Interests: {interests}")
    
    # Process each interest
    umbrellas_created = 0
    umbrellas_existing = 0
    total_queries_mapped = 0
    
    for interest in interests:
        umbrella_id = normalize_interest(interest)
        
        # Check if umbrella exists
        was_new = not store.umbrella_exists(umbrella_id)
        
        # Ensure umbrella exists (create if needed)
        result_id = ensure_umbrella_exists(store, interest)
        if not result_id:
            continue
        
        if was_new:
            umbrellas_created += 1
        else:
            umbrellas_existing += 1
        
        # Map user to queries
        queries_mapped = map_user_to_umbrella_queries(store, user_id, result_id)
        total_queries_mapped += queries_mapped
        print(f"  Mapped to {queries_mapped} queries in {result_id}")
    
    # Update umbrella user counts
    for interest in interests:
        umbrella_id = normalize_interest(interest)
        umbrella = store.get_umbrella(umbrella_id)
        if umbrella:
            current_count = umbrella.get("user_count", 0)
            store.update_umbrella(umbrella_id, {"user_count": current_count + 1})
    
    # Check if pool has items for user's interests
    print("\n  Checking pool availability...")
    pool_items = []
    for interest in interests:
        umbrella_id = normalize_interest(interest)
        items = store.get_retrieval_pool(umbrella_id=umbrella_id)
        pool_items.extend(items)
    
    if len(pool_items) < 5:
        print(f"  Pool has only {len(pool_items)} items, running emergency search...")
        for interest in interests[:3]:  # Search top 3 interests
            emergency_search_and_populate(store, interest)
    
    # Generate first feed
    print("\n  Generating initial feed...")
    try:
        feed_result = generate_feed(user_id)
        feed_items = len(feed_result.get("items", []))
    except Exception as e:
        print(f"  Error generating feed: {e}")
        feed_items = 0
    
    # Summary
    print("\n" + "=" * 50)
    print(f"User onboarded: created {umbrellas_created} umbrella(s), "
          f"mapped to {total_queries_mapped} queries, "
          f"generated initial feed with {feed_items} items")
    
    return {
        "umbrellas_created": umbrellas_created,
        "umbrellas_existing": umbrellas_existing,
        "queries_mapped": total_queries_mapped,
        "feed_items": feed_items,
        "user_id": user_id
    }


def main():
    parser = argparse.ArgumentParser(description="Handle user onboarding")
    parser.add_argument("--user_id", required=True, help="User ID to onboard")
    args = parser.parse_args()
    
    on_user_onboard(args.user_id)


if __name__ == "__main__":
    main()

