"""
Merge duplicate/overlapping umbrellas using AI.

This script:
1. Uses GPT to identify which umbrellas should be merged
2. Shows proposed merges for review
3. Performs merges: combines sub_queries, reassigns pool items, updates query_users
4. Deletes redundant umbrellas

Usage:
    python v1/scripts/merge_umbrellas.py --dry-run    # Show proposed merges
    python v1/scripts/merge_umbrellas.py --execute    # Actually merge
"""
import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env")

import os
from openai import OpenAI
from v1.storage import FirestoreStore


def get_merge_plan(umbrellas: list[dict]) -> list[dict]:
    """
    Use AI to identify which umbrellas should be merged.
    
    Returns list of merge groups:
    [
        {
            "canonical": "ai",
            "merge_into": ["ai-ml", "machine-learning", "ai-agents"],
            "reasoning": "All related to AI/ML"
        },
        ...
    ]
    """
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    
    # Format umbrellas for the prompt
    umbrella_list = "\n".join([
        f"- {u.get('id')} ({u.get('display_name', u.get('id'))})"
        for u in umbrellas
    ])
    
    prompt = f"""You are helping consolidate duplicate/overlapping content categories (called "umbrellas").

Here are all the current umbrellas:
{umbrella_list}

Your task:
1. Identify groups of umbrellas that should be MERGED because they cover the same or very similar topics
2. For each group, pick the BEST canonical ID (shortest, most general, clearest)
3. List which umbrellas should be merged INTO that canonical one

Rules:
- Only merge umbrellas that are clearly duplicates or near-synonyms
- "ai" and "machine-learning" → merge (same topic)
- "frontend" and "react" → DON'T merge (react is a subset, keep separate)
- "finetuning-llms" and "llms-finetuning" → merge (same topic, different word order)
- "design" and "ux-design" → could merge if they're truly duplicates
- Keep umbrellas that serve different purposes separate
- Delete obvious junk like single letters ("m")

Return JSON array of merge groups:
[
    {{
        "canonical": "the-best-id",
        "merge_into": ["duplicate-1", "duplicate-2"],
        "reasoning": "brief explanation"
    }},
    {{
        "canonical": null,
        "delete": ["m", "other-junk"],
        "reasoning": "Invalid/junk umbrellas to delete"
    }}
]

Only JSON, no markdown. If no merges needed, return empty array []."""

    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=2000
        )
        
        result_text = response.choices[0].message.content.strip()
        
        # Parse JSON
        if result_text.startswith("```"):
            lines = result_text.split("\n")
            result_text = "\n".join(lines[1:-1])
        
        return json.loads(result_text)
        
    except Exception as e:
        print(f"Error getting merge plan: {e}")
        return []


def merge_umbrellas(
    store: FirestoreStore,
    canonical_id: str,
    merge_ids: list[str],
    dry_run: bool = True
) -> dict[str, Any]:
    """
    Merge multiple umbrellas into a canonical one.
    
    Steps:
    1. Get canonical umbrella
    2. Collect sub_queries from all merge targets
    3. Update pool items to use canonical umbrella_id
    4. Update query_users to use canonical umbrella_id
    5. Update canonical umbrella with merged sub_queries
    6. Delete merged umbrellas
    
    Returns stats dict.
    """
    stats = {
        "canonical": canonical_id,
        "merged": merge_ids,
        "sub_queries_added": 0,
        "pool_items_updated": 0,
        "query_users_updated": 0,
        "umbrellas_deleted": 0
    }
    
    # Get canonical umbrella
    canonical = store.get_umbrella(canonical_id)
    if not canonical:
        print(f"    Warning: Canonical umbrella '{canonical_id}' not found")
        return stats
    
    canonical_sub_queries = canonical.get("sub_queries", [])
    existing_query_ids = {sq.get("id") for sq in canonical_sub_queries}
    
    # Collect sub_queries from merge targets
    new_sub_queries = []
    for merge_id in merge_ids:
        umbrella = store.get_umbrella(merge_id)
        if not umbrella:
            print(f"    Warning: Umbrella '{merge_id}' not found, skipping")
            continue
        
        for sq in umbrella.get("sub_queries", []):
            # Avoid duplicate query IDs
            if sq.get("id") not in existing_query_ids:
                # Rename query ID to use canonical umbrella
                old_id = sq.get("id", "")
                new_id = old_id.replace(merge_id, canonical_id) if merge_id in old_id else f"{canonical_id}-merged-{len(new_sub_queries)}"
                sq["id"] = new_id
                new_sub_queries.append(sq)
                existing_query_ids.add(new_id)
    
    stats["sub_queries_added"] = len(new_sub_queries)
    
    if dry_run:
        print(f"    [DRY RUN] Would add {len(new_sub_queries)} sub_queries to {canonical_id}")
    else:
        # Update canonical umbrella with merged sub_queries
        merged_sub_queries = canonical_sub_queries + new_sub_queries
        store.update_umbrella(canonical_id, {
            "sub_queries": merged_sub_queries,
            "user_count": canonical.get("user_count", 0)  # Keep existing count
        })
        print(f"    Added {len(new_sub_queries)} sub_queries to {canonical_id}")
    
    # Update pool items
    for merge_id in merge_ids:
        pool_items = store.get_retrieval_pool(umbrella_id=merge_id)
        stats["pool_items_updated"] += len(pool_items)
        
        if dry_run:
            print(f"    [DRY RUN] Would update {len(pool_items)} pool items from {merge_id}")
        else:
            for item in pool_items:
                item_id = item.get("id")
                if item_id:
                    store.db.collection("retrieval_pool").document(item_id).update({
                        "umbrella_id": canonical_id
                    })
            print(f"    Updated {len(pool_items)} pool items from {merge_id}")
    
    # Update query_users
    for merge_id in merge_ids:
        # Get all query_users docs for this umbrella
        query_users_docs = list(store.db.collection("query_users").where("umbrella_id", "==", merge_id).stream())
        stats["query_users_updated"] += len(query_users_docs)
        
        if dry_run:
            print(f"    [DRY RUN] Would update {len(query_users_docs)} query_users from {merge_id}")
        else:
            for doc in query_users_docs:
                doc.reference.update({"umbrella_id": canonical_id})
            print(f"    Updated {len(query_users_docs)} query_users from {merge_id}")
    
    # Delete merged umbrellas
    for merge_id in merge_ids:
        if dry_run:
            print(f"    [DRY RUN] Would delete umbrella {merge_id}")
        else:
            store.db.collection("umbrellas").document(merge_id).delete()
            print(f"    Deleted umbrella {merge_id}")
        stats["umbrellas_deleted"] += 1
    
    return stats


def delete_umbrellas(store: FirestoreStore, umbrella_ids: list[str], dry_run: bool = True) -> int:
    """Delete junk umbrellas that don't need merging."""
    deleted = 0
    
    for umbrella_id in umbrella_ids:
        # First clean up any pool items
        pool_items = store.get_retrieval_pool(umbrella_id=umbrella_id)
        if pool_items:
            if dry_run:
                print(f"    [DRY RUN] Would delete {len(pool_items)} pool items for {umbrella_id}")
            else:
                for item in pool_items:
                    item_id = item.get("id")
                    if item_id:
                        store.db.collection("retrieval_pool").document(item_id).delete()
                print(f"    Deleted {len(pool_items)} pool items for {umbrella_id}")
        
        # Delete query_users
        query_users_docs = list(store.db.collection("query_users").where("umbrella_id", "==", umbrella_id).stream())
        if query_users_docs:
            if dry_run:
                print(f"    [DRY RUN] Would delete {len(query_users_docs)} query_users for {umbrella_id}")
            else:
                for doc in query_users_docs:
                    doc.reference.delete()
                print(f"    Deleted {len(query_users_docs)} query_users for {umbrella_id}")
        
        # Delete umbrella
        if dry_run:
            print(f"    [DRY RUN] Would delete umbrella {umbrella_id}")
        else:
            store.db.collection("umbrellas").document(umbrella_id).delete()
            print(f"    Deleted umbrella {umbrella_id}")
        
        deleted += 1
    
    return deleted


def run_merge(dry_run: bool = True) -> dict[str, Any]:
    """
    Run the umbrella merge process.
    
    Args:
        dry_run: If True, only show what would happen
    
    Returns:
        Stats dict
    """
    store = FirestoreStore()
    
    print("=" * 60)
    print(f"UMBRELLA MERGE {'(DRY RUN)' if dry_run else '(EXECUTING)'}")
    print("=" * 60)
    
    # Get all umbrellas
    print("\nLoading umbrellas...")
    umbrellas = store.get_all_umbrellas()
    print(f"Found {len(umbrellas)} umbrellas")
    
    # Get merge plan from AI
    print("\nAnalyzing umbrellas with AI...")
    merge_plan = get_merge_plan(umbrellas)
    
    if not merge_plan:
        print("No merges recommended!")
        return {"merges": 0, "deletions": 0}
    
    print(f"\nAI recommended {len(merge_plan)} actions:")
    print("-" * 40)
    
    total_stats = {
        "merge_groups": 0,
        "umbrellas_merged": 0,
        "umbrellas_deleted": 0,
        "sub_queries_added": 0,
        "pool_items_updated": 0,
        "query_users_updated": 0
    }
    
    for i, group in enumerate(merge_plan, 1):
        canonical = group.get("canonical")
        merge_into = group.get("merge_into", [])
        delete_list = group.get("delete", [])
        reasoning = group.get("reasoning", "")
        
        if canonical and merge_into:
            print(f"\n{i}. MERGE: {merge_into} → {canonical}")
            print(f"   Reason: {reasoning}")
            
            stats = merge_umbrellas(store, canonical, merge_into, dry_run)
            total_stats["merge_groups"] += 1
            total_stats["umbrellas_merged"] += stats["umbrellas_deleted"]
            total_stats["sub_queries_added"] += stats["sub_queries_added"]
            total_stats["pool_items_updated"] += stats["pool_items_updated"]
            total_stats["query_users_updated"] += stats["query_users_updated"]
        
        elif delete_list:
            print(f"\n{i}. DELETE: {delete_list}")
            print(f"   Reason: {reasoning}")
            
            deleted = delete_umbrellas(store, delete_list, dry_run)
            total_stats["umbrellas_deleted"] += deleted
    
    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Merge groups processed: {total_stats['merge_groups']}")
    print(f"Umbrellas merged: {total_stats['umbrellas_merged']}")
    print(f"Umbrellas deleted (junk): {total_stats['umbrellas_deleted']}")
    print(f"Sub-queries added: {total_stats['sub_queries_added']}")
    print(f"Pool items updated: {total_stats['pool_items_updated']}")
    print(f"Query users updated: {total_stats['query_users_updated']}")
    
    if dry_run:
        print("\n⚠️  This was a DRY RUN. No changes were made.")
        print("Run with --execute to apply changes.")
    else:
        print("\n✓ All changes applied successfully!")
    
    return total_stats


def main():
    parser = argparse.ArgumentParser(description="Merge duplicate umbrellas")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--dry-run", action="store_true", help="Show proposed merges without executing")
    group.add_argument("--execute", action="store_true", help="Actually perform the merges")
    args = parser.parse_args()
    
    run_merge(dry_run=not args.execute)


if __name__ == "__main__":
    main()

