"""
Map users to queries.

Reads user profiles and creates query_users mappings. This tells the system
which queries have active users and should be searched.

Usage:
    python v1/scripts/map_users_to_queries.py
"""
import sys
from pathlib import Path

# Add project root to path for imports (at end to not shadow external packages)
project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env")

from collections import defaultdict
from v1.storage import FirestoreStore


def normalize_interest(interest: str) -> str:
    """Normalize an interest string to an umbrella ID."""
    return interest.lower().strip().replace(" ", "-").replace("&", "and")


def map_users_to_queries() -> dict:
    """
    Map users to queries based on their interests.
    
    Returns:
        Stats dict with users_mapped and queries_active counts
    """
    store = FirestoreStore()
    
    # Get all user profiles
    print("Loading user profiles...")
    profiles = store.get_all_user_profiles()
    print(f"Found {len(profiles)} users")
    
    # Get all umbrellas
    print("Loading umbrellas...")
    umbrellas = store.get_all_umbrellas()
    umbrella_map = {u["id"]: u for u in umbrellas}
    print(f"Found {len(umbrellas)} umbrellas")
    
    # Track mappings
    query_users: dict[str, set[str]] = defaultdict(set)  # query_id -> set of user_ids
    umbrella_users: dict[str, set[str]] = defaultdict(set)  # umbrella_id -> set of user_ids
    
    users_mapped = 0
    
    # For each user, map their interests to queries
    for profile in profiles:
        uid = profile.get("uid")
        if not uid:
            continue
        
        interests = profile.get("interests", [])
        if not interests:
            continue
        
        users_mapped += 1
        
        for interest in interests:
            umbrella_id = normalize_interest(interest)
            
            # Check if umbrella exists
            if umbrella_id not in umbrella_map:
                print(f"  Warning: No umbrella for interest '{interest}' (user {uid})")
                continue
            
            umbrella = umbrella_map[umbrella_id]
            umbrella_users[umbrella_id].add(uid)
            
            # Add user to each sub-query in the umbrella
            for sub_query in umbrella.get("sub_queries", []):
                query_id = sub_query.get("id")
                if query_id:
                    query_users[query_id].add(uid)
    
    # Write query_users to Firestore
    print(f"\nWriting {len(query_users)} query_users documents...")
    for query_id, users in query_users.items():
        # Find umbrella and query text
        umbrella_id = query_id.rsplit("-", 1)[0] if "-" in query_id else query_id
        query_text = ""
        if umbrella_id in umbrella_map:
            for sq in umbrella_map[umbrella_id].get("sub_queries", []):
                if sq.get("id") == query_id:
                    query_text = sq.get("text", "")
                    break
        
        # Add each user to the query
        for user_id in users:
            store.add_user_to_query(query_id, user_id, query_text, umbrella_id)
    
    # Update umbrella user counts
    print(f"Updating user counts for {len(umbrella_users)} umbrellas...")
    for umbrella_id, users in umbrella_users.items():
        store.update_umbrella(umbrella_id, {"user_count": len(users)})
    
    # Summary
    print()
    print(f"Mapped {users_mapped} users to {len(query_users)} active queries")
    
    return {
        "users_mapped": users_mapped,
        "queries_active": len(query_users),
        "umbrellas_active": len(umbrella_users)
    }


def main():
    map_users_to_queries()


if __name__ == "__main__":
    main()

