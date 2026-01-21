#!/usr/bin/env python3
"""
Calculate aggregate user preferences for pool harvesting.

Reads all users' source_distribution preferences and calculates
target percentages for proportional pool harvesting.

Usage:
    python v1/tools/calculate_pool_targets.py
"""
import json
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env")

# Cache settings
_CACHE_FILE = Path(__file__).parent.parent / "logs" / "pool_targets_cache.json"
_CACHE_TTL_HOURS = 24

# Default distribution if no users have preferences
DEFAULT_DISTRIBUTION = {
    "video": 30.0,
    "blog": 40.0,
    "discussion": 15.0,
    "repo": 10.0,
    "paper": 0.0,
    "launch": 5.0,
    "tweet": 0.0,
    "model": 0.0,
}


def _load_cache() -> dict[str, Any] | None:
    """Load cached targets if valid."""
    if not _CACHE_FILE.exists():
        return None
    
    try:
        with open(_CACHE_FILE, "r") as f:
            cache = json.load(f)
        
        cached_at = datetime.fromisoformat(cache.get("cached_at", ""))
        if datetime.utcnow() - cached_at < timedelta(hours=_CACHE_TTL_HOURS):
            return cache.get("targets")
    except (ValueError, json.JSONDecodeError, KeyError):
        pass
    
    return None


def _save_cache(targets: dict[str, float]) -> None:
    """Save targets to cache."""
    _CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
    
    cache = {
        "targets": targets,
        "cached_at": datetime.utcnow().isoformat(),
    }
    
    with open(_CACHE_FILE, "w") as f:
        json.dump(cache, f, indent=2)


def get_pool_targets(force_refresh: bool = False) -> dict[str, float]:
    """
    Get pool target percentages based on user preferences.
    
    Args:
        force_refresh: If True, bypass cache and recalculate
    
    Returns:
        Dict with content type percentages summing to 100
        e.g., {'video': 40.0, 'blog': 35.0, 'discussion': 15.0, 'repo': 10.0}
    """
    # Check cache first
    if not force_refresh:
        cached = _load_cache()
        if cached:
            return cached
    
    # Import storage lazily to avoid circular imports
    from v1.storage import FirestoreStore
    store = FirestoreStore()
    
    # Get all user preferences
    docs = store.db.collection("user_preferences").stream()
    
    # Aggregate source distributions
    totals = {
        "video": 0.0,
        "blog": 0.0,
        "discussion": 0.0,
        "repo": 0.0,
    }
    user_count = 0
    
    for doc in docs:
        data = doc.to_dict()
        if not data:
            continue
        
        source_dist = data.get("source_distribution", {})
        if not source_dist:
            continue
        
        user_count += 1
        
        for content_type in totals.keys():
            value = source_dist.get(content_type, 0)
            if isinstance(value, (int, float)):
                totals[content_type] += value
    
    # Calculate averages
    if user_count > 0:
        targets = {k: v / user_count for k, v in totals.items()}
    else:
        # Use defaults if no users have preferences
        targets = DEFAULT_DISTRIBUTION.copy()
    
    # Normalize to ensure sum is 100
    total = sum(targets.values())
    if total > 0:
        targets = {k: (v / total) * 100 for k, v in targets.items()}
    else:
        targets = DEFAULT_DISTRIBUTION.copy()
    
    # Round to 1 decimal place
    targets = {k: round(v, 1) for k, v in targets.items()}
    
    # Save to cache
    _save_cache(targets)
    
    return targets


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Calculate pool target percentages")
    parser.add_argument("--force", action="store_true", help="Force refresh (bypass cache)")
    args = parser.parse_args()
    
    targets = get_pool_targets(force_refresh=args.force)
    
    # Output as JSON
    print(json.dumps(targets))


if __name__ == "__main__":
    main()

