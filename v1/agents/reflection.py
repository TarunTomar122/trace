"""
Reflection Agent (The Listener) - learns from user interactions.

Reads interactions, updates tag scores, and creates personal_signals from notes.

Usage:
    python v1/agents/reflection.py --user_id abc123 --date 2026-01-18
"""
import argparse
import sys
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env")

from v1.storage import FirestoreStore
from v1.tools.extract_signal import extract_signal


# Score update constants (from v0)
UPVOTE_BOOST = 5
DOWNVOTE_PENALTY = 15
DECAY_RATE = 0.98
MIN_SCORE = 0
MAX_SCORE = 100

# Signal constants
SIGNAL_EXPIRY_HOURS = 72
MIN_CONFIDENCE = 0.5


def get_user_interactions(store: FirestoreStore, user_id: str, date: str) -> list[dict[str, Any]]:
    """Get user interactions for a specific date."""
    try:
        doc = store.db.collection("user_interactions").document(user_id).collection("daily").document(date).get()
        if doc.exists:
            data = doc.to_dict()
            return data.get("interactions", [])
    except Exception as e:
        print(f"  Error fetching interactions: {e}")
    return []


def get_user_patterns(store: FirestoreStore, user_id: str) -> dict[str, Any]:
    """Get user patterns from Firestore."""
    try:
        doc = store.db.collection("user_patterns").document(user_id).get()
        if doc.exists:
            return doc.to_dict() or {}
    except Exception:
        pass
    return {"tags": {}, "exclude_tags": [], "personal_signals": []}


def save_user_patterns(store: FirestoreStore, user_id: str, patterns: dict[str, Any]) -> None:
    """Save updated user patterns to Firestore."""
    patterns["updated_at"] = datetime.utcnow().isoformat()
    store.db.collection("user_patterns").document(user_id).set(patterns, merge=True)


def extract_tags_from_item(item_metadata: dict) -> list[str]:
    """Extract tags from item metadata."""
    return item_metadata.get("tags", [])


def calculate_tag_updates(patterns: dict, interactions: list) -> dict:
    """
    Calculate score updates based on interactions.
    
    Returns:
        {
            "tag_updates": {"agents": +10, "frontend": -15, ...},
            "new_impressions": {"agents": 2, ...},
            "upvoted_items": [...],
            "downvoted_items": [...]
        }
    """
    tag_updates = {}
    new_impressions = {}
    upvoted_items = []
    downvoted_items = []
    
    for interaction in interactions:
        action = interaction.get("action")
        item_meta = interaction.get("item_metadata", {})
        
        # Also check for metadata nested inside
        if not item_meta.get("tags") and "metadata" in item_meta:
            item_meta = {**item_meta, **item_meta.get("metadata", {})}
        
        tags = extract_tags_from_item(item_meta)
        
        if not tags:
            # Fallback: infer from type
            item_type = item_meta.get("type", "")
            if item_type in ["repo", "paper"]:
                tags = ["tools"]
            elif item_type == "video":
                tags = ["tutorials"]
            elif item_type in ["blog", "discussion"]:
                tags = ["tools"]
        
        for tag in tags:
            tag_lower = tag.lower()
            new_impressions[tag_lower] = new_impressions.get(tag_lower, 0) + 1
            
            if action == "upvote":
                tag_updates[tag_lower] = tag_updates.get(tag_lower, 0) + UPVOTE_BOOST
            elif action == "downvote":
                tag_updates[tag_lower] = tag_updates.get(tag_lower, 0) - DOWNVOTE_PENALTY
        
        if action == "upvote":
            upvoted_items.append(interaction)
        elif action == "downvote":
            downvoted_items.append(interaction)
    
    return {
        "tag_updates": tag_updates,
        "new_impressions": new_impressions,
        "upvoted_items": upvoted_items,
        "downvoted_items": downvoted_items,
        "total_interactions": len(interactions)
    }


def apply_tag_updates(patterns: dict, updates: dict, date: str) -> dict:
    """Apply calculated tag updates to patterns."""
    tags = patterns.get("tags", {})
    
    # Apply updates from interactions
    for tag, delta in updates["tag_updates"].items():
        if tag not in tags:
            tags[tag] = {"score": 50, "up": 0, "down": 0, "shown": 0}
        
        tags[tag]["score"] = max(MIN_SCORE, min(MAX_SCORE, tags[tag]["score"] + delta))
        
        if delta > 0:
            tags[tag]["up"] = tags[tag].get("up", 0) + 1
        elif delta < 0:
            tags[tag]["down"] = tags[tag].get("down", 0) + 1
    
    # Update shown counts
    for tag, count in updates["new_impressions"].items():
        if tag in tags:
            tags[tag]["shown"] = tags[tag].get("shown", 0) + count
    
    # Apply decay to tags NOT interacted with today
    interacted_tags = set(updates["tag_updates"].keys())
    for tag in tags:
        if tag not in interacted_tags:
            tags[tag]["score"] = max(MIN_SCORE, int(tags[tag]["score"] * DECAY_RATE))
    
    patterns["tags"] = tags
    patterns["updated"] = date
    
    return patterns


def create_personal_signals(upvoted_items: list, existing_signals: list) -> tuple[list, int]:
    """
    Create personal signals from upvoted items with notes.
    
    Args:
        upvoted_items: List of upvote interactions
        existing_signals: Existing personal signals
    
    Returns:
        Tuple of (updated_signals_list, new_signal_count)
    """
    signals = list(existing_signals)  # Copy existing
    new_count = 0
    
    # Get existing signal queries to avoid duplicates
    existing_queries = {s.get("query", "").lower() for s in signals}
    
    for interaction in upvoted_items:
        note = interaction.get("note", "")
        if not note or len(note.strip()) < 3:
            continue
        
        item_meta = interaction.get("item_metadata", {})
        title = item_meta.get("title", "")
        
        if not title:
            continue
        
        # Extract signal using LLM
        result = extract_signal(title, note)
        
        if not result or not result.get("query"):
            continue
        
        if result.get("confidence", 0) < MIN_CONFIDENCE:
            continue
        
        query = result["query"]
        
        # Skip if we already have a similar signal
        if query.lower() in existing_queries:
            continue
        
        # Create new signal
        now = datetime.utcnow()
        signal = {
            "signal_id": f"sig_{uuid.uuid4().hex[:12]}",
            "query": query,
            "priority": 5,
            "created_at": now.isoformat(),
            "expires_at": (now + timedelta(hours=SIGNAL_EXPIRY_HOURS)).isoformat(),
            "origin_item_id": item_meta.get("id", ""),
            "confidence": result["confidence"]
        }
        
        signals.append(signal)
        existing_queries.add(query.lower())
        new_count += 1
    
    return signals, new_count


def run_reflection(user_id: str, date: str) -> dict[str, Any]:
    """
    Run reflection for a user on a specific date.
    
    Args:
        user_id: User ID to run reflection for
        date: Date string (YYYY-MM-DD)
    
    Returns:
        Results dict with tags_updated, signals_created, etc.
    """
    store = FirestoreStore()
    
    print(f"Running reflection for user {user_id} on {date}...")
    
    # Load interactions
    interactions = get_user_interactions(store, user_id, date)
    
    if not interactions:
        print(f"  No interactions found for {date}")
        return {
            "success": True,
            "user_id": user_id,
            "date": date,
            "tags_updated": 0,
            "signals_created": 0,
            "message": "No interactions found"
        }
    
    print(f"  Found {len(interactions)} interactions")
    
    # Load current patterns
    patterns = get_user_patterns(store, user_id)
    
    # Calculate tag updates
    updates = calculate_tag_updates(patterns, interactions)
    print(f"  Tags to update: {len(updates['tag_updates'])}")
    
    # Apply tag updates
    patterns = apply_tag_updates(patterns, updates, date)
    
    # Create personal signals from notes on upvoted items
    existing_signals = patterns.get("personal_signals", [])
    
    # Filter out expired signals first
    now = datetime.utcnow()
    active_signals = [
        s for s in existing_signals
        if datetime.fromisoformat(s.get("expires_at", "2000-01-01")) > now
    ]
    
    print(f"  Active signals before: {len(active_signals)}")
    print(f"  Upvoted items with potential signals: {len(updates['upvoted_items'])}")
    
    # Create new signals from notes
    updated_signals, new_signal_count = create_personal_signals(
        updates["upvoted_items"],
        active_signals
    )
    
    patterns["personal_signals"] = updated_signals
    
    # Save updated patterns
    save_user_patterns(store, user_id, patterns)
    
    tags_updated = len(updates["tag_updates"])
    
    print(f"Updated {tags_updated} tags, created {new_signal_count} personal signals")
    
    return {
        "success": True,
        "user_id": user_id,
        "date": date,
        "tags_updated": tags_updated,
        "signals_created": new_signal_count,
        "total_interactions": updates["total_interactions"],
        "upvotes": len(updates["upvoted_items"]),
        "downvotes": len(updates["downvoted_items"])
    }


def main():
    parser = argparse.ArgumentParser(description="Run reflection for a user")
    parser.add_argument("--user_id", required=True, help="User ID to run reflection for")
    parser.add_argument("--date", required=True, help="Date string (YYYY-MM-DD)")
    args = parser.parse_args()
    
    result = run_reflection(args.user_id, args.date)
    
    if result["success"]:
        print(f"Updated {result['tags_updated']} tags, created {result['signals_created']} personal signals")
    else:
        print(f"Reflection failed: {result.get('message', 'Unknown error')}")


if __name__ == "__main__":
    main()

