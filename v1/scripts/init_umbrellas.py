"""
Initialize umbrellas from user interests.

Scans user_profiles to find all unique interests, creates umbrellas,
and runs Trend Discovery Agent to populate sub_queries.

Usage:
    python v1/scripts/init_umbrellas.py
"""
import sys
from pathlib import Path

# Add project root to path for imports (at end to not shadow external packages)
project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env")

from datetime import datetime
from v1.storage import FirestoreStore
from v1.models import Umbrella, SubQuery
from v1.core_agents.trend_discovery import discover_trends


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


def init_umbrellas(dry_run: bool = False) -> list[str]:
    """
    Initialize umbrellas from user interests.
    
    Args:
        dry_run: If True, don't write to Firestore, just print what would happen
    
    Returns:
        List of created umbrella IDs
    """
    store = FirestoreStore()
    
    # Collect all unique interests from user profiles
    print("Scanning user_profiles for interests...")
    profiles = store.get_all_user_profiles()
    
    all_interests: set[str] = set()
    for profile in profiles:
        interests = profile.get("interests", [])
        for interest in interests:
            if interest:
                all_interests.add(normalize_interest(interest))
    
    print(f"Found {len(all_interests)} unique interests: {sorted(all_interests)}")
    
    if not all_interests:
        print("No interests found in user_profiles. Make sure users have onboarded.")
        return []
    
    # Create umbrellas for each unique interest
    created_umbrellas = []
    skipped_umbrellas = []
    
    for interest in sorted(all_interests):
        umbrella_id = interest
        
        # Check if umbrella already exists (idempotency)
        if store.umbrella_exists(umbrella_id):
            print(f"  Skipping {umbrella_id} (already exists)")
            skipped_umbrellas.append(umbrella_id)
            continue
        
        print(f"  Creating umbrella: {umbrella_id}")
        
        if dry_run:
            print(f"    [DRY RUN] Would discover trends for {umbrella_id}")
            created_umbrellas.append(umbrella_id)
            continue
        
        # Discover trends using the agent
        try:
            print(f"    Discovering trends for {umbrella_id}...")
            queries = discover_trends(interest)
            
            # Create sub-queries from discovered trends
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
            
            # Create the umbrella
            umbrella = Umbrella(
                id=umbrella_id,
                display_name=create_display_name(umbrella_id),
                sub_queries=sub_queries,
                user_count=0,
                last_discovery_refresh=datetime.utcnow().isoformat()
            )
            
            store.create_umbrella(umbrella_id, umbrella.model_dump())
            created_umbrellas.append(umbrella_id)
            print(f"    ✓ Created with {len(sub_queries)} sub-queries")
            
        except Exception as e:
            print(f"    ✗ Error creating {umbrella_id}: {e}")
            continue
    
    # Summary
    print()
    if created_umbrellas:
        print(f"Created {len(created_umbrellas)} umbrellas: {', '.join(created_umbrellas)}")
    if skipped_umbrellas:
        print(f"Skipped {len(skipped_umbrellas)} existing umbrellas: {', '.join(skipped_umbrellas)}")
    
    return created_umbrellas


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Initialize umbrellas from user interests")
    parser.add_argument("--dry-run", action="store_true", help="Don't write to Firestore")
    args = parser.parse_args()
    
    init_umbrellas(dry_run=args.dry_run)


if __name__ == "__main__":
    main()

