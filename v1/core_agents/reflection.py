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
from v1.tools.smart_reflection import run_smart_reflection, apply_smart_adjustments, generate_trace_summary


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
            # Frontend saves interactions as "items", not "interactions"
            return data.get("items", [])
    except Exception as e:
        print(f"  Error fetching interactions: {e}")
    return []


def get_user_feed_seen_items(store: FirestoreStore, user_id: str, date: str) -> tuple[list[dict[str, Any]], set[str]]:
    """
    Get user feed items and which items were seen.
    
    Returns:
        Tuple of (feed_items, seen_item_ids)
    """
    try:
        doc = store.db.collection("user_feeds").document(user_id).collection("daily").document(date).get()
        if doc.exists:
            data = doc.to_dict()
            items = data.get("items", [])
            seen_ids = set(data.get("seen_item_ids", []))
            return items, seen_ids
    except Exception as e:
        print(f"  Error fetching feed/seen items: {e}")
    return [], set()


def get_user_patterns(store: FirestoreStore, user_id: str) -> dict[str, Any]:
    """Get user patterns from Firestore."""
    try:
        doc = store.db.collection("user_patterns").document(user_id).get()
        if doc.exists:
            return doc.to_dict() or {}
    except Exception:
        pass
    return {"tags": {}, "exclude_tags": [], "personal_signals": []}


def get_user_profile(store: FirestoreStore, user_id: str) -> dict[str, Any]:
    """Get user profile from Firestore."""
    try:
        doc = store.db.collection("user_profiles").document(user_id).get()
        if doc.exists:
            return doc.to_dict() or {}
    except Exception:
        pass
    return {"interests": [], "learningStyle": "", "contentDepth": "deep"}


def get_user_preferences(store: FirestoreStore, user_id: str) -> dict[str, Any]:
    """Get user preferences from Firestore."""
    try:
        doc = store.db.collection("user_preferences").document(user_id).get()
        if doc.exists:
            return doc.to_dict() or {}
    except Exception:
        pass
    return {
        "source_distribution": {
            "video": 40, "blog": 35, "discussion": 15,
            "repo": 5, "paper": 0, "launch": 3, "tweet": 2
        },
        "contentDepth": "deep"
    }


def save_user_preferences(store: FirestoreStore, user_id: str, preferences: dict[str, Any]) -> None:
    """Save updated user preferences to Firestore."""
    preferences["updated_at"] = datetime.utcnow().isoformat()
    store.db.collection("user_preferences").document(user_id).set(preferences, merge=True)


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


def apply_tag_updates(patterns: dict, updates: dict, date: str, seen_tags: set[str] | None = None) -> dict:
    """
    Apply calculated tag updates to patterns.
    
    Args:
        patterns: User patterns dict
        updates: Calculated tag updates from interactions
        date: Date string
        seen_tags: Set of tags from items that were SEEN (scrolled past).
                   If provided, only decay tags that were seen but not interacted with.
                   If None, decay all non-interacted tags (old behavior).
    """
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
    
    # Apply decay to tags that were SEEN but NOT interacted with
    # This is fairer: we don't penalize topics the user never saw
    interacted_tags = set(updates["tag_updates"].keys())
    
    if seen_tags is not None:
        # New behavior: only decay tags from seen items that weren't interacted with
        tags_to_decay = seen_tags - interacted_tags
        print(f"  Decay: {len(tags_to_decay)} seen-but-not-interacted tags (skipping {len(tags) - len(tags_to_decay)} unseen)")
    else:
        # Old behavior: decay all non-interacted tags
        tags_to_decay = set(tags.keys()) - interacted_tags
    
    for tag in tags_to_decay:
        if tag in tags:
            tags[tag]["score"] = max(MIN_SCORE, int(tags[tag]["score"] * DECAY_RATE))
    
    patterns["tags"] = tags
    patterns["updated"] = date
    
    return patterns


def extract_exclude_tag(title: str, note: str) -> str | None:
    """
    Extract a tag/topic to exclude from user's note on a downvoted item.
    
    Args:
        title: The item title that was downvoted
        note: The user's note about why they didn't like it
    
    Returns:
        Tag string to exclude, or None if note is too generic
    """
    if not note or len(note.strip()) < 3:
        return None
    
    # Use the same extract_signal function but interpret differently
    result = extract_signal(title, note)
    
    if not result or not result.get("query"):
        return None
    
    if result.get("confidence", 0) < MIN_CONFIDENCE:
        return None
    
    # Extract the main topic/tag from the query
    query = result["query"]
    # Take first 1-2 words as the tag (simplified)
    words = query.split()[:2]
    tag = " ".join(words).lower()
    
    return tag


def update_exclude_tags(downvoted_items: list, existing_exclude_tags: list) -> tuple[list, int]:
    """
    Update exclude_tags from notes on downvoted items.
    
    Args:
        downvoted_items: List of downvote interactions with notes
        existing_exclude_tags: Current list of excluded tags
    
    Returns:
        Tuple of (updated_exclude_tags_list, new_exclude_count)
    """
    exclude_tags = list(existing_exclude_tags)  # Copy existing
    new_count = 0
    
    existing_lower = {tag.lower() for tag in exclude_tags}
    
    for interaction in downvoted_items:
        note = interaction.get("note", "")
        if not note or len(note.strip()) < 3:
            continue
        
        item_meta = interaction.get("item_metadata", {})
        title = item_meta.get("title", "")
        
        if not title:
            continue
        
        # Extract tag to exclude
        exclude_tag = extract_exclude_tag(title, note)
        
        if not exclude_tag:
            continue
        
        # Skip if already excluded
        if exclude_tag.lower() in existing_lower:
            continue
        
        # Add to exclude list
        exclude_tags.append(exclude_tag)
        existing_lower.add(exclude_tag.lower())
        new_count += 1
    
    return exclude_tags, new_count


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


def run_reflection(user_id: str, date: str, use_smart_reflection: bool = True) -> dict[str, Any]:
    """
    Run reflection for a user on a specific date.
    
    Uses a two-phase approach:
    1. Rule-based: Update tag scores based on upvotes/downvotes (reliable, fast)
    2. Smart reflection: Use LLM to understand notes and adjust preferences (intelligent)
    
    Args:
        user_id: User ID to run reflection for
        date: Date string (YYYY-MM-DD)
        use_smart_reflection: Whether to use LLM for note analysis (default True)
    
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
    
    # Load feed items and seen status
    feed_items, seen_item_ids = get_user_feed_seen_items(store, user_id, date)
    print(f"  Feed: {len(feed_items)} items, {len(seen_item_ids)} seen")
    
    # Extract tags from items that were SEEN (user scrolled past them)
    seen_tags: set[str] = set()
    for item in feed_items:
        if item.get("id") in seen_item_ids:
            # Extract tags from this seen item
            item_tags = item.get("tags", [])
            for tag in item_tags:
                seen_tags.add(tag.lower())
    
    print(f"  Tags from seen items: {len(seen_tags)}")
    
    # Load current data
    patterns = get_user_patterns(store, user_id)
    user_profile = get_user_profile(store, user_id)
    user_preferences = get_user_preferences(store, user_id)
    
    # =========================================================================
    # PHASE 1: Rule-based tag updates (always runs)
    # =========================================================================
    updates = calculate_tag_updates(patterns, interactions)
    print(f"  Tags to update: {len(updates['tag_updates'])}")
    
    # Apply tag updates - only decay tags from SEEN items
    patterns = apply_tag_updates(patterns, updates, date, seen_tags if seen_item_ids else None)
    
    # Filter out expired signals
    now = datetime.utcnow()
    existing_signals = patterns.get("personal_signals", [])
    active_signals = [
        s for s in existing_signals
        if datetime.fromisoformat(s.get("expires_at", "2000-01-01")) > now
    ]
    patterns["personal_signals"] = active_signals
    
    # =========================================================================
    # PHASE 2: Smart reflection for notes (LLM-powered)
    # =========================================================================
    smart_stats = {
        "tags_adjusted": 0,
        "exclude_tags_added": 0,
        "signals_created": 0,
        "source_adjusted": False,
        "depth_adjusted": False,
        "insights": None
    }
    
    # Find interactions with notes
    interactions_with_notes = [
        i for i in interactions 
        if i.get("note") and len(i.get("note", "").strip()) >= 3
    ]
    
    if interactions_with_notes and use_smart_reflection:
        print(f"  Running smart reflection on {len(interactions_with_notes)} notes...")
        
        try:
            # Run smart reflection
            adjustments = run_smart_reflection(
                interactions_with_notes,
                user_profile,
                patterns,
                user_preferences
            )
            
            if adjustments:
                # Apply smart adjustments
                patterns, user_preferences, smart_stats = apply_smart_adjustments(
                    adjustments,
                    patterns,
                    user_preferences
                )
                
                smart_stats["insights"] = adjustments.get("insights")
                
                print(f"  Smart reflection: {smart_stats['tags_adjusted']} tag adjustments, "
                      f"{smart_stats['signals_created']} signals, "
                      f"{smart_stats['exclude_tags_added']} exclude tags")
                
                if smart_stats.get("insights"):
                    print(f"  Insights: {smart_stats['insights'][:100]}...")
                
                # Save updated preferences if changed
                if smart_stats["source_adjusted"] or smart_stats["depth_adjusted"]:
                    save_user_preferences(store, user_id, user_preferences)
                    print(f"  Updated preferences (source: {smart_stats['source_adjusted']}, depth: {smart_stats['depth_adjusted']})")
            else:
                print(f"  Smart reflection: no adjustments suggested")
                
        except Exception as e:
            print(f"  Smart reflection error (falling back to rule-based): {e}")
    elif interactions_with_notes:
        print(f"  Skipping smart reflection (disabled)")
    else:
        print(f"  No notes to analyze")
    
    # =========================================================================
    # Save and return results
    # =========================================================================
    try:
        summary = generate_trace_summary(user_profile, patterns, user_preferences)
        if summary:
            patterns["summary"] = summary
    except Exception as e:
        print(f"  Summary generation error: {e}")

    save_user_patterns(store, user_id, patterns)
    
    tags_updated = len(updates["tag_updates"]) + smart_stats["tags_adjusted"]
    signals_created = smart_stats["signals_created"]
    exclude_tags_added = smart_stats["exclude_tags_added"]
    
    print(f"Updated {tags_updated} tags, created {signals_created} signals, added {exclude_tags_added} exclude tags")
    
    return {
        "success": True,
        "user_id": user_id,
        "date": date,
        "tags_updated": tags_updated,
        "signals_created": signals_created,
        "exclude_tags_added": exclude_tags_added,
        "total_interactions": updates["total_interactions"],
        "upvotes": len(updates["upvoted_items"]),
        "downvotes": len(updates["downvoted_items"]),
        "smart_reflection": {
            "used": use_smart_reflection and bool(interactions_with_notes),
            "notes_analyzed": len(interactions_with_notes),
            "insights": smart_stats.get("insights"),
            "source_adjusted": smart_stats["source_adjusted"],
            "depth_adjusted": smart_stats["depth_adjusted"]
        }
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

