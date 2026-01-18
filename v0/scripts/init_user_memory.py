#!/usr/bin/env python3
"""Initialize preferences.json and patterns.json for a user if they don't exist."""
import sys
import json
from pathlib import Path
from datetime import datetime

sys.path.append(str(Path(__file__).parent.parent))

from storage import get_store


DEFAULT_PREFERENCES = {
    "source_distribution": {
        "video": 30,
        "blog": 40,
        "paper": 10,
        "discussion": 15,
        "repo": 5
    },
    "content_depth": "balanced",  # quick, balanced, deep
    "exclude_tags": [],
    "preferred_sources": [],
    "updated_at": datetime.utcnow().isoformat()
}

DEFAULT_PATTERNS = {
    "tags": {},
    "exclude_tags": [],
    "exploration": {
        "mode": "balanced",
        "adjacent_searches": [],
        "serendipity_queries": []
    },
    "history": [],
    "updated_at": datetime.utcnow().isoformat()
}


def init_user_memory(user_id: str, force: bool = False):
    store = get_store()
    
    print(f"\n🔧 Initializing memory for user: {user_id[:8]}...")
    
    # Check current state
    try:
        prefs_raw = store.read_memory(user_id, "preferences.json")
        prefs = json.loads(prefs_raw)
    except:
        prefs = {}
    
    try:
        patterns_raw = store.read_memory(user_id, "patterns.json")
        patterns = json.loads(patterns_raw)
    except:
        patterns = {}
    
    # Initialize preferences if empty or forced
    if not prefs or "source_distribution" not in prefs or force:
        print("  ⚙️  Writing default preferences...")
        store.write_memory(user_id, "preferences.json", json.dumps(DEFAULT_PREFERENCES))
        print("  ✅ preferences.json initialized")
    else:
        print("  ⏭️  preferences.json already exists")
    
    # Initialize patterns if empty or forced
    if not patterns or "tags" not in patterns or force:
        print("  📊 Writing default patterns...")
        store.write_memory(user_id, "patterns.json", json.dumps(DEFAULT_PATTERNS))
        print("  ✅ patterns.json initialized")
    else:
        print("  ⏭️  patterns.json already exists")
    
    print(f"✅ Memory initialized for {user_id[:8]}...\n")


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("user_id", help="User ID to initialize")
    parser.add_argument("--force", action="store_true", help="Overwrite existing files")
    args = parser.parse_args()
    
    init_user_memory(args.user_id, args.force)


if __name__ == "__main__":
    main()

