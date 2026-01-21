#!/usr/bin/env python3
"""
Pool composition analytics script.

Analyzes retrieval_pool collection and generates reports on content type
distribution over time. Compares actual composition to user preference targets.

Usage:
    python v1/scripts/analyze_pool_composition.py
    python v1/scripts/analyze_pool_composition.py --last-n-days 7
"""
import argparse
import json
import sys
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env")

from v1.storage import FirestoreStore


def analyze_pool_composition(last_n_days: int | None = None) -> dict[str, Any]:
    """
    Analyze pool composition and compare to targets.
    
    Args:
        last_n_days: Only analyze items from last N days (None = all items)
    
    Returns:
        Analysis report dict
    """
    store = FirestoreStore()
    
    # Get all pool items
    print("Fetching pool items...")
    all_items = store.get_retrieval_pool()
    
    # Filter by date if specified
    if last_n_days:
        cutoff = (datetime.utcnow() - timedelta(days=last_n_days)).isoformat()
        all_items = [
            item for item in all_items
            if item.get("fetched_at", "") > cutoff
        ]
        print(f"Filtered to {len(all_items)} items from last {last_n_days} days")
    
    total_items = len(all_items)
    
    if total_items == 0:
        print("No items in pool")
        return {"total_items": 0, "by_type": {}, "by_source": {}, "by_date": {}}
    
    # Analyze by content type
    by_type: dict[str, int] = defaultdict(int)
    by_source: dict[str, int] = defaultdict(int)
    by_date: dict[str, int] = defaultdict(int)
    by_umbrella: dict[str, int] = defaultdict(int)
    
    for item in all_items:
        content_type = item.get("type", "unknown")
        source = item.get("source", "unknown")
        umbrella = item.get("umbrella_id", "unknown")
        
        # Parse date from fetched_at
        fetched_at = item.get("fetched_at", "")
        if fetched_at:
            date = fetched_at[:10]  # YYYY-MM-DD
        else:
            date = "unknown"
        
        by_type[content_type] += 1
        by_source[source] += 1
        by_date[date] += 1
        by_umbrella[umbrella] += 1
    
    # Calculate percentages
    type_percentages = {k: round((v / total_items) * 100, 1) for k, v in by_type.items()}
    source_percentages = {k: round((v / total_items) * 100, 1) for k, v in by_source.items()}
    
    # Get targets for comparison
    try:
        from v1.tools.calculate_pool_targets import get_pool_targets
        targets = get_pool_targets()
    except Exception as e:
        print(f"Warning: Could not get pool targets: {e}")
        targets = {"video": 40.0, "blog": 35.0, "discussion": 15.0, "repo": 10.0}
    
    # Calculate mismatches
    mismatches = {}
    for content_type, target_pct in targets.items():
        actual_pct = type_percentages.get(content_type, 0)
        diff = actual_pct - target_pct
        if abs(diff) >= 5:  # Only report significant mismatches
            mismatches[content_type] = {
                "target": target_pct,
                "actual": actual_pct,
                "diff": round(diff, 1),
            }
    
    report = {
        "total_items": total_items,
        "by_type": dict(sorted(by_type.items(), key=lambda x: -x[1])),
        "type_percentages": dict(sorted(type_percentages.items(), key=lambda x: -x[1])),
        "by_source": dict(sorted(by_source.items(), key=lambda x: -x[1])),
        "source_percentages": source_percentages,
        "by_date": dict(sorted(by_date.items(), reverse=True)),
        "by_umbrella": dict(sorted(by_umbrella.items(), key=lambda x: -x[1])[:10]),  # Top 10
        "targets": targets,
        "mismatches": mismatches,
        "analyzed_at": datetime.utcnow().isoformat(),
    }
    
    return report


def print_report(report: dict[str, Any]) -> None:
    """Print formatted report to console."""
    print("\n" + "=" * 60)
    print("POOL COMPOSITION ANALYSIS")
    print("=" * 60)
    
    print(f"\nTotal items: {report['total_items']}")
    
    # Content type breakdown
    print("\n--- Content Type Breakdown ---")
    type_pcts = report.get("type_percentages", {})
    by_type = report.get("by_type", {})
    for content_type, count in by_type.items():
        pct = type_pcts.get(content_type, 0)
        print(f"  {content_type}: {count} ({pct}%)")
    
    # Source breakdown
    print("\n--- Source Breakdown ---")
    by_source = report.get("by_source", {})
    source_pcts = report.get("source_percentages", {})
    for source, count in by_source.items():
        pct = source_pcts.get(source, 0)
        print(f"  {source}: {count} ({pct}%)")
    
    # Date breakdown (last 5 days)
    print("\n--- Daily Harvest (last 5 days) ---")
    by_date = report.get("by_date", {})
    for i, (date, count) in enumerate(by_date.items()):
        if i >= 5:
            break
        print(f"  {date}: {count} items")
    
    # Top umbrellas
    print("\n--- Top 10 Umbrellas ---")
    by_umbrella = report.get("by_umbrella", {})
    for umbrella, count in by_umbrella.items():
        print(f"  {umbrella}: {count}")
    
    # Targets comparison
    targets = report.get("targets", {})
    print(f"\n--- Target vs Actual ---")
    print(f"{'Type':<15} {'Target':>8} {'Actual':>8} {'Diff':>8}")
    print("-" * 40)
    for content_type, target_pct in targets.items():
        actual_pct = type_pcts.get(content_type, 0)
        diff = actual_pct - target_pct
        diff_str = f"{'+' if diff >= 0 else ''}{diff:.1f}%"
        print(f"{content_type:<15} {target_pct:>7.1f}% {actual_pct:>7.1f}% {diff_str:>8}")
    
    # Mismatches
    mismatches = report.get("mismatches", {})
    if mismatches:
        print("\n--- ⚠️ Significant Mismatches ---")
        for content_type, data in mismatches.items():
            diff = data["diff"]
            if diff > 0:
                print(f"  ⚠️ {content_type} overrepresented by {abs(diff):.1f}%")
            else:
                print(f"  ⚠️ {content_type} underrepresented by {abs(diff):.1f}%")
    else:
        print("\n✓ Pool composition is within target ranges")
    
    print("\n" + "=" * 60)


def main():
    parser = argparse.ArgumentParser(description="Analyze pool composition")
    parser.add_argument("--last-n-days", type=int, default=None, 
                        help="Only analyze items from last N days")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    args = parser.parse_args()
    
    report = analyze_pool_composition(last_n_days=args.last_n_days)
    
    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print_report(report)


if __name__ == "__main__":
    main()

