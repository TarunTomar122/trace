#!/usr/bin/env python3
"""
Deterministic reflection algorithm for updating tag scores.
70% of reflection logic - Python math, no LLM guessing.
"""
import json
import sys
from pathlib import Path
from datetime import datetime

# Fixed tag taxonomy
VALID_TAGS = [
    "agents", "memory", "llm", "frontend", "performance",
    "tools", "infra", "web-components", "design-systems",
    "databases", "ml-research", "new-releases", "tutorials",
    "devops", "career", "ux-design", "ai-tools", "vibe-coding",
    "no-code", "creative-workflows", "design-inspiration"
]

# Score update constants
UPVOTE_BOOST = 5
DOWNVOTE_PENALTY = 15
DECAY_RATE = 0.98
MIN_SCORE = 0
MAX_SCORE = 100
EXCLUDE_THRESHOLD = 15


def load_patterns(memory_dir: Path):
    patterns_file = memory_dir / "patterns.json"
    if patterns_file.exists():
        with open(patterns_file) as f:
            return json.load(f)
    return {"tags": {}, "exclude_tags": [], "exploration": {}, "history": []}


def load_interactions(memory_dir: Path, date: str):
    interactions_file = memory_dir / "daily" / f"{date}_interactions.json"
    if interactions_file.exists():
        with open(interactions_file) as f:
            return json.load(f)
    return []


def extract_tags_from_item(item_metadata: dict) -> list:
    """Extract tags from item metadata. Items should have tags assigned at feed creation."""
    return item_metadata.get("tags", [])


def calculate_updates(patterns: dict, interactions: list) -> dict:
    """
    Calculate score updates based on interactions.
    Returns: {
        "tag_updates": {"agents": +10, "frontend": -15, ...},
        "new_impressions": {"agents": 2, ...},
        "summary_data": {...}
    }
    """
    tag_updates = {}
    new_impressions = {}
    upvoted_tags = []
    downvoted_tags = []
    
    for interaction in interactions:
        action = interaction.get("action")
        item_meta = interaction.get("item_metadata", {})
        tags = extract_tags_from_item(item_meta)
        
        if not tags:
            # Fallback: try to infer from type/source
            item_type = item_meta.get("type", "")
            if item_type in ["repo", "paper"]:
                tags = ["tools"]  # generic fallback
            elif item_type == "video":
                tags = ["tutorials"]
            elif item_type in ["blog", "discussion"]:
                tags = ["tools"]
        
        for tag in tags:
            if tag not in VALID_TAGS:
                continue
                
            # Track impressions
            new_impressions[tag] = new_impressions.get(tag, 0) + 1
            
            # Calculate update
            if action == "upvote":
                tag_updates[tag] = tag_updates.get(tag, 0) + UPVOTE_BOOST
                upvoted_tags.append(tag)
            elif action == "downvote":
                tag_updates[tag] = tag_updates.get(tag, 0) - DOWNVOTE_PENALTY
                downvoted_tags.append(tag)
    
    return {
        "tag_updates": tag_updates,
        "new_impressions": new_impressions,
        "upvoted_tags": list(set(upvoted_tags)),
        "downvoted_tags": list(set(downvoted_tags)),
        "total_interactions": len(interactions)
    }


def apply_updates(patterns: dict, updates: dict, date: str) -> dict:
    """Apply calculated updates to patterns."""
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
    
    # Check for tags to exclude
    exclude_tags = patterns.get("exclude_tags", [])
    for tag, data in list(tags.items()):
        if data["score"] < EXCLUDE_THRESHOLD and tag not in exclude_tags:
            # Don't auto-exclude, just flag it
            data["flagged_for_exclusion"] = True
    
    patterns["tags"] = tags
    patterns["updated"] = date
    
    return patterns


def generate_summary_data(updates: dict) -> dict:
    """Generate data for LLM to write summary."""
    return {
        "total_interactions": updates["total_interactions"],
        "upvoted_tags": updates["upvoted_tags"],
        "downvoted_tags": updates["downvoted_tags"],
        "tags_boosted": [t for t, d in updates["tag_updates"].items() if d > 0],
        "tags_penalized": [t for t, d in updates["tag_updates"].items() if d < 0]
    }


def run_reflection(user_folder: str, date: str = None) -> dict:
    """
    Run the Python part of reflection.
    Returns data for LLM to interpret (30% of reflection).
    """
    date = date or datetime.now().strftime("%Y-%m-%d")
    memory_dir = Path(user_folder) / "memory"
    patterns_file = memory_dir / "patterns.json"
    
    patterns = load_patterns(memory_dir)
    interactions = load_interactions(memory_dir, date)
    
    if not interactions:
        return {
            "success": False,
            "message": "No interactions found for this date",
            "patterns": patterns
        }
    
    # Calculate updates (pure math)
    updates = calculate_updates(patterns, interactions)
    
    # Apply updates
    updated_patterns = apply_updates(patterns, updates, date)
    
    # Generate summary data for LLM
    summary_data = generate_summary_data(updates)
    
    # Save updated patterns
    with open(patterns_file, "w") as f:
        json.dump(updated_patterns, f, indent=2)
    
    return {
        "success": True,
        "date": date,
        "summary_data": summary_data,
        "patterns": updated_patterns,
        "message": f"Updated {len(updates['tag_updates'])} tags based on {len(interactions)} interactions"
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python reflection.py <user_folder> [date]"}))
        sys.exit(1)
    
    user_folder = sys.argv[1]
    date = sys.argv[2] if len(sys.argv) > 2 else None
    result = run_reflection(user_folder, date)
    print(json.dumps(result, indent=2))
