"""
Onboarding/Subscription hook - runs when a user completes onboarding or subscribes.

Creates umbrellas if needed, maps user to queries, and generates feed.
Safe to run multiple times (idempotent).

Usage:
    python v1/hooks/on_user_onboard.py --user_id abc123
"""
import argparse
import hashlib
import os
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any

import requests

project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env")

from v1.storage import FirestoreStore
from v1.models import Umbrella, SubQuery
from v1.core_agents.trend_discovery import discover_trends
from v1.generate_feed import generate_feed
from v1.tools.umbrella_mapper import map_interests_to_umbrellas


def normalize_interest(interest: str) -> str:
    """Normalize an interest string to an umbrella ID."""
    return (interest.lower().strip()
            .replace(" ", "-")
            .replace("&", "and")
            .replace("/", "-")
            .replace("\\", "-")
            .replace("(", "")
            .replace(")", ""))


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


def get_user_source_preferences(store: FirestoreStore, user_id: str) -> dict[str, float]:
    """
    Get user's source distribution preferences.
    
    Returns:
        Dict with content type percentages
    """
    try:
        doc = store.db.collection("user_preferences").document(user_id).get()
        if doc.exists:
            data = doc.to_dict() or {}
            source_dist = data.get("source_distribution", {})
            if source_dist:
                # Normalize to ensure proper ratios
                total = sum(source_dist.values()) or 100
                return {k: (v / total) for k, v in source_dist.items()}
    except Exception:
        pass
    
    # Default preferences (updated to 30% video to conserve YouTube API quota)
    return {"video": 0.3, "blog": 0.4, "discussion": 0.15, "repo": 0.1}


def is_hobby_or_project(interest: str, user_profile: dict[str, Any]) -> bool:
    """Check if an interest is from user's hobbies or projects."""
    hobbies = user_profile.get("hobbies", [])
    projects = user_profile.get("projects", [])
    
    interest_lower = interest.lower()
    
    for hobby in hobbies:
        if hobby.lower() in interest_lower or interest_lower in hobby.lower():
            return True
    
    for project in projects:
        if project.lower() in interest_lower or interest_lower in project.lower():
            return True
    
    return False


def emergency_search_and_populate(
    store: FirestoreStore, 
    interest: str, 
    user_id: str | None = None,
    user_profile: dict[str, Any] | None = None
) -> int:
    """
    Run emergency search to populate pool for a new interest.
    
    This is called when pool is empty for user's interests.
    Uses multiple sources (YouTube + Tavily) proportionally based on user preferences.
    
    Args:
        store: Firestore store
        interest: Interest to search for
        user_id: Optional user ID to get preferences
        user_profile: Optional user profile for hobby detection
    
    Returns:
        Number of items added to pool
    """
    print(f"  Running emergency search for '{interest}'...")
    
    umbrella_id = normalize_interest(interest)
    
    # Determine date range based on whether this is a hobby
    if user_profile and is_hobby_or_project(interest, user_profile):
        days = 365  # 1 year for hobbies/projects
        print(f"    Using 1-year range for hobby/project: {interest}")
    else:
        days = 60  # 2 months for news/tech
    
    # Get user's source preferences
    if user_id:
        source_prefs = get_user_source_preferences(store, user_id)
    else:
        source_prefs = {"video": 0.4, "blog": 0.35, "discussion": 0.15, "repo": 0.1}
    
    # Calculate items per source (total ~10 items)
    total_items = 10
    video_items = max(1, round(total_items * source_prefs.get("video", 0.4)))
    blog_items = max(1, round(total_items * source_prefs.get("blog", 0.35)))
    
    # Use IST (UTC+5:30) for date consistency with pipeline runs
    ist_tz = timezone(timedelta(hours=5, minutes=30))
    today = datetime.now(ist_tz).strftime("%Y-%m-%d")
    
    items_added = 0
    video_count = 0
    blog_count = 0
    
    # Search YouTube for videos (if user prefers videos)
    if video_items > 0:
        try:
            from v1.tools.youtube_search import youtube_search
            
            video_results = youtube_search(
                query=f"{interest} latest",
                max_results=video_items,
                days=365 if days == 365 else 365  # YouTube always uses 1-year for better results
            )
            
            for r in video_results:
                url = r.get("url")
                if not url or store.pool_url_exists(url):
                    continue
                
                url_hash = hashlib.md5(url.encode()).hexdigest()[:8]
                pool_id = f"pool_{today}_{url_hash}"
                
                metadata = r.get("metadata", {})
                item = {
                    "id": pool_id,
                    "url": url,
                    "title": r.get("title", ""),
                    "description": r.get("content", "")[:500],
                    "type": "video",
                    "source": "youtube",
                    "umbrella_id": umbrella_id,
                    "query_id": f"{umbrella_id}-emergency",
                    "tags": [umbrella_id],
                    "fetched_at": datetime.utcnow().isoformat(),
                    "expires_at": (datetime.utcnow() + timedelta(days=3)).isoformat(),
                    "quality_signals": {"domain_authority": "high", "has_code": False},
                    "trending_score": 50,
                    "freshness_score": 95,
                    "thumbnail": metadata.get("thumbnail"),
                }
                
                store.add_to_pool(pool_id, item)
                items_added += 1
                video_count += 1
            
            if video_count > 0:
                print(f"    ✓ Added {video_count} videos from YouTube")
        except Exception as e:
            print(f"    Warning: YouTube emergency search error: {e}")
    
    # Search Tavily for blogs
    if blog_items > 0:
        api_key = os.getenv("TAVILY_API_KEY", "").strip()
        if api_key:
            try:
                # Calculate date range
                today_date = datetime.utcnow().date()
                start_date = (today_date - timedelta(days=days)).isoformat()
                end_date = today_date.isoformat()
                
                query = f"{interest} latest news trends insights -tutorial -beginner -guide"
                
                resp = requests.post(
                    "https://api.tavily.com/search",
                    json={
                        "api_key": api_key,
                        "query": query,
                        "max_results": blog_items,
                        "search_depth": "basic",
                        "topic": "news",
                        "start_date": start_date,
                        "end_date": end_date,
                    },
                    timeout=30
                )
                
                if resp.status_code < 400:
                    results = resp.json().get("results", [])
                    
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
                        blog_count += 1
                    
                    if blog_count > 0:
                        print(f"    ✓ Added {blog_count} blogs from Tavily")
            except Exception as e:
                print(f"    Warning: Tavily emergency search error: {e}")
        else:
            print("    Warning: TAVILY_API_KEY not set, skipping blog search")
    
    print(f"    Emergency search for {interest}: fetched {video_count} videos, {blog_count} blogs")
    return items_added


def on_user_onboard(user_id: str) -> dict[str, Any]:
    """
    Handle user onboarding or subscription.
    
    Runs when a user completes onboarding OR subscribes.
    - Always creates umbrellas (for pool organization)
    - Only maps to queries if subscribed (controls pool generation)
    - Generates feed regardless of subscription (preview for unsubscribed)
    
    1. Reads user interests
    2. Creates umbrellas if needed
    3. Maps user to queries (only if subscribed)
    4. Generates feed
    
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
    
    # Check subscription status
    subscription_status = profile.get("subscriptionStatus", "none")
    is_subscribed = subscription_status in ["trial", "active"]
    print(f"  Subscription status: {subscription_status} ({'subscribed' if is_subscribed else 'unsubscribed'})")
    
    interests = profile.get("interests", [])
    if not interests:
        print(f"  Warning: User has no interests")
        return {"error": "No interests"}
    
    print(f"  Interests: {interests}")
    print(f"  Hobbies: {profile.get('hobbies', [])}")
    print(f"  Projects: {profile.get('projects', [])}")
    
    umbrellas_created = 0
    umbrellas_existing = 0
    total_queries_mapped = 0
    interest_to_umbrella = {}
    unique_umbrella_ids = set()

    if is_subscribed:
        # Use AI to smart-map interests + hobbies to umbrellas
        print("\n  Smart-mapping interests + hobbies to umbrellas...")
        combined = list({i for i in interests + profile.get("hobbies", []) if i})
        mapping_result = map_interests_to_umbrellas(combined, store)
        interest_to_umbrella = mapping_result["mappings"]
        umbrellas_to_create = mapping_result["umbrellas_to_create"]

        # First, create any new umbrellas that were identified
        for new_umbrella in umbrellas_to_create:
            umbrella_id = new_umbrella["id"]
            if not store.umbrella_exists(umbrella_id):
                # Get the original interest that triggered this umbrella
                original_interest = next((i for i, u in interest_to_umbrella.items() if u == umbrella_id), umbrella_id)
                result_id = ensure_umbrella_exists(store, original_interest)
                if result_id:
                    umbrellas_created += 1

        # Now map users to queries for each unique umbrella
        unique_umbrella_ids = set(interest_to_umbrella.values())
        for umbrella_id in unique_umbrella_ids:
            if not store.umbrella_exists(umbrella_id):
                umbrellas_existing += 1  # Already existed before this run
                continue

            umbrellas_existing += 1
            queries_mapped = map_user_to_umbrella_queries(store, user_id, umbrella_id)
            total_queries_mapped += queries_mapped
            print(f"  Mapped to {queries_mapped} queries in {umbrella_id}")

        # Update umbrella user counts
        for umbrella_id in unique_umbrella_ids:
            umbrella = store.get_umbrella(umbrella_id)
            if umbrella:
                current_count = umbrella.get("user_count", 0)
                store.update_umbrella(umbrella_id, {"user_count": current_count + 1})

        interest_map = {
            i: interest_to_umbrella[i] for i in interests if i in interest_to_umbrella
        }
        hobbies = profile.get("hobbies", []) or []
        hobby_map = {
            h: interest_to_umbrella[h] for h in hobbies if h in interest_to_umbrella
        }
        store.db.collection("user_profiles").document(user_id).set({
            "interest_umbrella_map": interest_map,
            "hobby_umbrella_map": hobby_map,
            "umbrella_ids": list(unique_umbrella_ids),
            "updatedAt": datetime.utcnow().isoformat(),
        }, merge=True)
    else:
        print("  Skipping umbrella creation and query mapping (user not subscribed)")
    
    # Check if pool has items for user's umbrella mappings
    # Only run emergency search for subscribed users
    if is_subscribed:
        print("\n  Checking pool availability...")
        pool_items = []
        umbrellas_without_content = []

        for interest, umbrella_id in interest_to_umbrella.items():
            items = store.get_retrieval_pool(umbrella_id=umbrella_id)
            if items:
                pool_items.extend(items)
            else:
                umbrellas_without_content.append((interest, umbrella_id))

        print(f"  Pool has {len(pool_items)} items across {len(unique_umbrella_ids)} umbrellas")
        print(f"  {len(umbrellas_without_content)} umbrellas have no content")

        # Run emergency search for ALL umbrellas without content (not just if total < 5)
        # Uses multi-source search (YouTube + Tavily) based on user preferences
        if umbrellas_without_content:
            print(f"  Running multi-source emergency search for {len(umbrellas_without_content)} empty umbrellas...")
            for interest, umbrella_id in umbrellas_without_content:
                emergency_search_and_populate(store, interest, user_id=user_id, user_profile=profile)
    
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
