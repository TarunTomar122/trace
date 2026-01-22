#!/usr/bin/env python3
"""
YouTube search tool with filters.

Searches YouTube with proper filters:
- No shorts (minimum 2 minutes duration)
- Recency control (up to 1 year old)
- Returns standardized format matching pool items

Usage:
    python v1/tools/youtube_search.py --query 'machine learning' --days 180
"""
import argparse
import json
import os
import re
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent.parent / ".env")

import requests


def parse_iso8601_duration(duration: str) -> int:
    """
    Parse ISO 8601 duration string to seconds.

    Examples:
        PT1M30S -> 90
        PT5M -> 300
        PT1H30M -> 5400
    """
    if not duration:
        return 0

    # Match pattern like PT1H30M45S
    pattern = r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?"
    match = re.match(pattern, duration)

    if not match:
        return 0

    hours = int(match.group(1) or 0)
    minutes = int(match.group(2) or 0)
    seconds = int(match.group(3) or 0)

    return hours * 3600 + minutes * 60 + seconds


def youtube_search(
    query: str,
    max_results: int = 10,
    days: int = 365,
    min_subscribers: int | None = None,
) -> list[dict[str, Any]]:
    """
    Search YouTube with filters.

    Args:
        query: Search query
        max_results: Max results to return
        days: Only fetch content from last N days (default 365 = 1 year)

    Returns:
        List of items in standardized pool format
    """
    from v1.tools.youtube_quota_monitor import (
        log_youtube_call,
        get_daily_usage,
        DAILY_QUOTA_LIMIT,
    )

    api_key = os.getenv("YOUTUBE_API_KEY", "").strip()
    if not api_key:
        print("  Warning: YOUTUBE_API_KEY not set, skipping YouTube search")
        return []

    # Check quota before making calls
    current_usage = get_daily_usage()
    if current_usage >= DAILY_QUOTA_LIMIT * 0.95:  # 95% threshold
        print(
            f"  Warning: YouTube API quota nearly exhausted ({current_usage}/{DAILY_QUOTA_LIMIT})"
        )
        return []

    # Calculate date range
    published_after = (datetime.utcnow() - timedelta(days=days)).isoformat() + "Z"

    # Step 1: Search for videos (cost: ~100 units)
    search_url = "https://www.googleapis.com/youtube/v3/search"
    search_params = {
        "key": api_key,
        "part": "snippet",
        "q": query,
        "type": "video",
        "maxResults": max_results * 2,  # Fetch more to account for shorts filtering
        "publishedAfter": published_after,
        "videoDuration": "medium",  # medium = 4-20 min, long = >20 min (excludes shorts)
        "order": "relevance",
        "relevanceLanguage": "en",
    }

    try:
        resp = requests.get(search_url, params=search_params, timeout=30)
        log_youtube_call("search", 100)  # Log search cost

        if resp.status_code == 403:
            error = resp.json().get("error", {})
            if "quotaExceeded" in str(error):
                print("  Warning: YouTube API quota exceeded")
                return []
            print(f"  Warning: YouTube API error: {error.get('message', 'Unknown')}")
            return []

        if resp.status_code != 200:
            print(f"  Warning: YouTube search error {resp.status_code}")
            return []

        search_data = resp.json()
        items = search_data.get("items", [])

        if not items:
            return []

        # Extract video IDs
        video_ids = [
            item.get("id", {}).get("videoId")
            for item in items
            if item.get("id", {}).get("videoId")
        ]

        if not video_ids:
            return []

        # Step 2: Get video details for duration filtering (cost: 1 unit per video)
        details_url = "https://www.googleapis.com/youtube/v3/videos"
        details_params = {
            "key": api_key,
            "part": "contentDetails,statistics,snippet",
            "id": ",".join(video_ids),
        }

        details_resp = requests.get(details_url, params=details_params, timeout=30)
        log_youtube_call("videos", len(video_ids))  # Log video details cost

        if details_resp.status_code != 200:
            print(f"  Warning: YouTube details error {details_resp.status_code}")
            return []

        details_data = details_resp.json()
        details_items = details_data.get("items", [])

        # Build lookup map
        video_details = {item.get("id"): item for item in details_items}

        # Optional: fetch channel subscriber counts
        channel_subscribers: dict[str, int] = {}
        if min_subscribers is not None:
            channel_ids = list(
                {
                    (item.get("snippet", {}) or {}).get("channelId")
                    for item in details_items
                    if (item.get("snippet", {}) or {}).get("channelId")
                }
            )
            if channel_ids:
                channels_url = "https://www.googleapis.com/youtube/v3/channels"
                for i in range(0, len(channel_ids), 50):
                    batch_ids = channel_ids[i : i + 50]
                    channels_params = {
                        "key": api_key,
                        "part": "statistics",
                        "id": ",".join(batch_ids),
                    }
                    channels_resp = requests.get(
                        channels_url, params=channels_params, timeout=30
                    )
                    log_youtube_call("channels", 1)
                    if channels_resp.status_code != 200:
                        print(
                            f"  Warning: YouTube channels error {channels_resp.status_code}"
                        )
                        continue
                    channels_data = channels_resp.json()
                    for ch in channels_data.get("items", []):
                        channel_id = ch.get("id")
                        stats = ch.get("statistics", {}) or {}
                        try:
                            subs = int(stats.get("subscriberCount", 0))
                        except (TypeError, ValueError):
                            subs = 0
                        if channel_id:
                            channel_subscribers[channel_id] = subs

        # Filter and format results
        results = []
        for search_item in items:
            video_id = search_item.get("id", {}).get("videoId")
            if not video_id or video_id not in video_details:
                continue

            details = video_details[video_id]
            snippet = details.get("snippet", {})
            content_details = details.get("contentDetails", {})
            statistics = details.get("statistics", {})
            channel_id = snippet.get("channelId", "")

            # Parse duration
            duration_iso = content_details.get("duration", "")
            duration_seconds = parse_iso8601_duration(duration_iso)

            # Filter out shorts (< 2 minutes = 120 seconds)
            if duration_seconds < 120:
                continue

            if min_subscribers is not None:
                subs = channel_subscribers.get(channel_id, 0)
                if subs < min_subscribers:
                    continue

            # Parse published date
            published_at = snippet.get("publishedAt", "")
            published_date = None
            if published_at:
                try:
                    published_date = datetime.fromisoformat(
                        published_at.replace("Z", "+00:00")
                    ).strftime("%Y-%m-%d")
                except (ValueError, TypeError):
                    pass

            # Build standardized result
            result = {
                "title": snippet.get("title", ""),
                "url": f"https://www.youtube.com/watch?v={video_id}",
                "content": snippet.get("description", "")[:500],
                "content_type": "video",
                "source": "youtube",
                "published_date": published_date,
                "metadata": {
                    "video_id": video_id,
                    "channel_name": snippet.get("channelTitle", ""),
                    "channel_id": channel_id,
                    "channel_subscribers": channel_subscribers.get(channel_id),
                    "duration_seconds": duration_seconds,
                    "duration": duration_iso,
                    "view_count": int(statistics.get("viewCount", 0)),
                    "like_count": int(statistics.get("likeCount", 0)),
                    "thumbnail": snippet.get("thumbnails", {})
                    .get("high", {})
                    .get("url")
                    or snippet.get("thumbnails", {}).get("medium", {}).get("url")
                    or snippet.get("thumbnails", {}).get("default", {}).get("url"),
                },
            }
            results.append(result)

            if len(results) >= max_results:
                break

        return results

    except requests.exceptions.Timeout:
        print("  Warning: YouTube search timed out")
        return []
    except requests.exceptions.RequestException as e:
        print(f"  Warning: YouTube request error: {e}")
        return []
    except Exception as e:
        print(f"  Warning: YouTube search error: {e}")
        return []


def main():
    parser = argparse.ArgumentParser(description="Search YouTube with filters")
    parser.add_argument("--query", required=True, help="Search query")
    parser.add_argument(
        "--max-results", type=int, default=10, help="Max results (default: 10)"
    )
    parser.add_argument(
        "--days", type=int, default=365, help="Max age in days (default: 365)"
    )
    args = parser.parse_args()

    results = youtube_search(args.query, args.max_results, args.days)

    # Output as JSON
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
