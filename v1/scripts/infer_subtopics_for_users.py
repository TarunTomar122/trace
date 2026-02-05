"""
Infer subtopics for existing subscribed users based on their legacy interests.

Uses LLM to intelligently map legacy interests to canonical subtopics from
the fixed taxonomy, so users get query pools instead of just umbrella pools.

Usage:
    # Test on single user
    python v1/scripts/infer_subtopics_for_users.py --user-id USER_ID --dry-run
    python v1/scripts/infer_subtopics_for_users.py --user-id USER_ID
    
    # Run for all subscribed users
    python v1/scripts/infer_subtopics_for_users.py --all --dry-run
    python v1/scripts/infer_subtopics_for_users.py --all
    
    # Limit to first N users
    python v1/scripts/infer_subtopics_for_users.py --all --limit 10
"""
import argparse
import json
import os
import sys
import time
from pathlib import Path

project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env")

from v1.storage import FirestoreStore
from v1.algorithm.interest_schema import INTEREST_SUBTOPICS
from openai import OpenAI


def _infer_subtopics_for_user(
    user_profile: dict,
    client: OpenAI,
) -> dict[str, list[str]]:
    """
    Use LLM to infer which subtopics match the user's legacy interests.
    
    Args:
        user_profile: User profile with interest_ids and legacy_interests
        client: OpenAI client
        
    Returns:
        Dict mapping interest_id to list of subtopic_ids (max 2 per interest)
    """
    interest_ids = user_profile.get("interest_ids", [])
    legacy_interests = user_profile.get("legacy_interests", [])
    current_interests = user_profile.get("interests", [])
    
    if not interest_ids:
        return {}
    
    # Build available subtopics list
    available_subtopics = {}
    for interest_id in interest_ids:
        subtopics = INTEREST_SUBTOPICS.get(interest_id, [])
        if subtopics:
            available_subtopics[interest_id] = [
                {"id": s["id"], "label": s["label"]}
                for s in subtopics
            ]
    
    if not available_subtopics:
        return {}
    
    # Prepare context
    legacy_str = ", ".join(legacy_interests) if legacy_interests else "None"
    current_str = ", ".join(current_interests) if current_interests else "None"
    
    subtopics_str = json.dumps(available_subtopics, indent=2)
    
    prompt = f"""Given a user's original interests, select the most relevant subtopics (max 2 per interest).

USER'S ORIGINAL INTERESTS: {legacy_str}
USER'S CURRENT INTERESTS: {current_str}

AVAILABLE SUBTOPICS BY INTEREST:
{subtopics_str}

RULES:
1. Only select subtopics that clearly match the user's interests
2. Max 2 subtopics per interest
3. If no clear match, leave empty array for that interest
4. Be conservative - only select if you're confident it matches

Return JSON in this exact format:
{{
  "interest_id": ["subtopic_id_1", "subtopic_id_2"],
  "another_interest": ["subtopic_id"]
}}

Example:
If user interests include "React", "UI design", "machine learning":
{{
  "technology": ["ai", "software"],
  "design": ["ux", "visual-design"]
}}

YOUR RESPONSE (valid JSON only):"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an expert at understanding user interests and matching them to specific topics. Return only valid JSON."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
            max_tokens=500,
        )
        
        text = response.choices[0].message.content.strip()
        result = json.loads(text)
        
        # Validate and clean result
        cleaned = {}
        for interest_id, subtopic_ids in result.items():
            if interest_id not in available_subtopics:
                continue
            if not isinstance(subtopic_ids, list):
                continue
            
            valid_ids = [s["id"] for s in available_subtopics[interest_id]]
            filtered = [
                sid for sid in subtopic_ids[:2]
                if isinstance(sid, str) and sid in valid_ids
            ]
            
            if filtered:
                cleaned[interest_id] = filtered
        
        return cleaned
        
    except Exception as e:
        print(f"  Error inferring subtopics: {e}")
        return {}


def infer_subtopics_for_user(
    user_id: str,
    store: FirestoreStore,
    client: OpenAI,
    dry_run: bool = False,
) -> dict:
    """Infer and update subtopics for a single user."""
    profile = store.get_user_profile(user_id)
    if not profile:
        return {"error": "User not found", "user_id": user_id}
    
    # Skip if already has interest_queries
    existing_queries = profile.get("interest_queries", {})
    if existing_queries:
        return {
            "user_id": user_id,
            "skipped": True,
            "reason": "already_has_queries",
        }
    
    # Skip if no interest_ids
    interest_ids = profile.get("interest_ids", [])
    if not interest_ids:
        return {
            "user_id": user_id,
            "skipped": True,
            "reason": "no_interest_ids",
        }
    
    print(f"Processing {user_id}...")
    print(f"  Interest IDs: {interest_ids}")
    print(f"  Legacy interests: {profile.get('legacy_interests', [])}")
    
    # Infer subtopics
    inferred_queries = _infer_subtopics_for_user(profile, client)
    
    if not inferred_queries:
        print(f"  No subtopics inferred")
        return {
            "user_id": user_id,
            "inferred": False,
            "interest_queries": {},
        }
    
    print(f"  Inferred queries: {inferred_queries}")
    
    if dry_run:
        print(f"  DRY RUN - would update interest_queries")
        return {
            "user_id": user_id,
            "inferred": True,
            "interest_queries": inferred_queries,
            "dry_run": True,
        }
    
    # Update profile
    doc_ref = store.db.collection("user_profiles").document(user_id)
    doc_ref.update({
        "interest_queries": inferred_queries,
        "interestQueries": inferred_queries,  # Keep in sync with frontend
    })
    
    print(f"  ✓ Updated interest_queries")
    
    return {
        "user_id": user_id,
        "inferred": True,
        "interest_queries": inferred_queries,
    }


def infer_subtopics_for_all_users(
    limit: int | None = None,
    dry_run: bool = False,
) -> dict:
    """Infer subtopics for all subscribed users."""
    store = FirestoreStore()
    
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        print("Error: OPENAI_API_KEY not set")
        return {"error": "missing_api_key"}
    
    client = OpenAI(api_key=api_key)
    
    # Get subscribed users
    users = store.get_onboarded_users()
    if limit:
        users = users[:limit]
    
    total = len(users)
    if total == 0:
        print("No subscribed users found")
        return {"users_processed": 0}
    
    print("=" * 60)
    print(f"INFER SUBTOPICS FOR {total} USERS")
    if dry_run:
        print("DRY RUN - no changes will be made")
    print("=" * 60)
    print()
    
    success = 0
    skipped = 0
    failed = 0
    
    for i, user in enumerate(users, 1):
        user_id = user.get("uid")
        if not user_id:
            continue
        
        print(f"[{i}/{total}] {user_id}")
        
        try:
            result = infer_subtopics_for_user(
                user_id=user_id,
                store=store,
                client=client,
                dry_run=dry_run,
            )
            
            if result.get("skipped"):
                skipped += 1
            elif result.get("inferred"):
                success += 1
            else:
                skipped += 1
                
        except Exception as e:
            print(f"  Error: {e}")
            failed += 1
        
        print()
        time.sleep(0.3)  # Rate limit
    
    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Users processed: {total}")
    print(f"Subtopics inferred: {success}")
    print(f"Skipped: {skipped}")
    print(f"Failed: {failed}")
    
    return {
        "users_processed": total,
        "success": success,
        "skipped": skipped,
        "failed": failed,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Infer subtopics for users based on legacy interests"
    )
    parser.add_argument(
        "--user-id",
        help="Infer subtopics for a single user",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Infer subtopics for all subscribed users",
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Limit number of users to process (with --all)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without making changes",
    )
    
    args = parser.parse_args()
    
    if not args.user_id and not args.all:
        parser.error("Must specify either --user-id or --all")
    
    if args.user_id:
        store = FirestoreStore()
        api_key = os.getenv("OPENAI_API_KEY", "").strip()
        if not api_key:
            print("Error: OPENAI_API_KEY not set")
            sys.exit(1)
        
        client = OpenAI(api_key=api_key)
        result = infer_subtopics_for_user(
            user_id=args.user_id,
            store=store,
            client=client,
            dry_run=args.dry_run,
        )
        print(json.dumps(result, indent=2))
    else:
        result = infer_subtopics_for_all_users(
            limit=args.limit,
            dry_run=args.dry_run,
        )


if __name__ == "__main__":
    main()

