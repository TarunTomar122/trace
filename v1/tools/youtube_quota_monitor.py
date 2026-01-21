#!/usr/bin/env python3
"""
YouTube API quota monitoring tool.

Tracks estimated quota usage per day and warns before hitting limits.
YouTube free tier = 10,000 units/day.

Quota costs:
- search.list: ~100 units
- videos.list: 1 unit per video

Usage:
    python v1/tools/youtube_quota_monitor.py --check
"""
import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path

project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env")

# Quota settings
DAILY_QUOTA_LIMIT = 10000
WARNING_THRESHOLD = 0.8  # Warn at 80% usage

# Log file location
LOGS_DIR = Path(__file__).parent.parent / "logs"


def _get_log_file() -> Path:
    """Get today's log file path."""
    today = datetime.utcnow().strftime("%Y-%m-%d")
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    return LOGS_DIR / f"youtube_quota_{today}.log"


def log_youtube_call(call_type: str, cost: int) -> None:
    """
    Log a YouTube API call with its quota cost.
    
    Args:
        call_type: Type of call (e.g., 'search', 'videos')
        cost: Estimated quota cost
    """
    log_file = _get_log_file()
    
    entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "call_type": call_type,
        "cost": cost,
    }
    
    with open(log_file, "a") as f:
        f.write(json.dumps(entry) + "\n")


def get_daily_usage() -> int:
    """
    Get total quota units used today.
    
    Returns:
        Total units used today
    """
    log_file = _get_log_file()
    
    if not log_file.exists():
        return 0
    
    total = 0
    with open(log_file, "r") as f:
        for line in f:
            try:
                entry = json.loads(line.strip())
                total += entry.get("cost", 0)
            except json.JSONDecodeError:
                continue
    
    return total


def get_usage_breakdown() -> dict[str, int]:
    """
    Get breakdown of quota usage by call type.
    
    Returns:
        Dict mapping call_type to total cost
    """
    log_file = _get_log_file()
    
    breakdown = {}
    
    if not log_file.exists():
        return breakdown
    
    with open(log_file, "r") as f:
        for line in f:
            try:
                entry = json.loads(line.strip())
                call_type = entry.get("call_type", "unknown")
                cost = entry.get("cost", 0)
                breakdown[call_type] = breakdown.get(call_type, 0) + cost
            except json.JSONDecodeError:
                continue
    
    return breakdown


def check_quota() -> dict:
    """
    Check current quota usage and return status.
    
    Returns:
        Dict with usage info and warnings
    """
    usage = get_daily_usage()
    breakdown = get_usage_breakdown()
    percentage = (usage / DAILY_QUOTA_LIMIT) * 100
    
    status = {
        "usage": usage,
        "limit": DAILY_QUOTA_LIMIT,
        "percentage": round(percentage, 1),
        "remaining": DAILY_QUOTA_LIMIT - usage,
        "breakdown": breakdown,
        "warning": None,
    }
    
    if percentage >= 95:
        status["warning"] = "CRITICAL: Quota nearly exhausted!"
    elif percentage >= WARNING_THRESHOLD * 100:
        status["warning"] = f"WARNING: Approaching quota limit ({percentage:.1f}%)"
    
    return status


def main():
    parser = argparse.ArgumentParser(description="YouTube API quota monitor")
    parser.add_argument("--check", action="store_true", help="Check current quota usage")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    args = parser.parse_args()
    
    status = check_quota()
    
    if args.json:
        print(json.dumps(status, indent=2))
    else:
        print(f"YouTube API usage today: {status['usage']:,} / {status['limit']:,} units ({status['percentage']}%)")
        print(f"Remaining: {status['remaining']:,} units")
        
        if status["breakdown"]:
            print("\nBreakdown by call type:")
            for call_type, cost in status["breakdown"].items():
                print(f"  {call_type}: {cost:,} units")
        
        if status["warning"]:
            print(f"\n⚠️  {status['warning']}")
        else:
            print("\n✓ Quota usage within normal limits")


if __name__ == "__main__":
    main()

