#!/usr/bin/env python3
"""
Test script for YouTube Data API v3.

Verifies that the API key is set up correctly and can search for videos.

Usage:
    python v1/tools/test_youtube_api.py
"""
import os
import sys
from pathlib import Path

project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env")

import requests


def test_youtube_api():
    """Test YouTube Data API connectivity and basic search."""
    api_key = os.getenv("YOUTUBE_API_KEY", "").strip()
    
    if not api_key:
        print("✗ YOUTUBE_API_KEY not set in environment")
        print("\nTo set up:")
        print("1. Go to https://console.cloud.google.com/apis/credentials")
        print("2. Create API key restricted to YouTube Data API v3")
        print("3. Add YOUTUBE_API_KEY=your_key to .env file")
        return False
    
    print(f"✓ YOUTUBE_API_KEY found (length: {len(api_key)})")
    
    # Test basic search
    print("\nTesting search API...")
    search_url = "https://www.googleapis.com/youtube/v3/search"
    params = {
        "key": api_key,
        "part": "snippet",
        "q": "machine learning tutorial",
        "type": "video",
        "maxResults": 3,
    }
    
    try:
        resp = requests.get(search_url, params=params, timeout=30)
        
        if resp.status_code == 403:
            error = resp.json().get("error", {})
            message = error.get("message", "Unknown error")
            if "quotaExceeded" in message:
                print("✗ API quota exceeded (10,000 units/day limit)")
            elif "API key not valid" in message:
                print("✗ API key is not valid - check credentials")
            else:
                print(f"✗ API error: {message}")
            return False
        
        if resp.status_code != 200:
            print(f"✗ Unexpected status code: {resp.status_code}")
            print(f"  Response: {resp.text[:200]}")
            return False
        
        data = resp.json()
        items = data.get("items", [])
        
        if not items:
            print("✗ Search returned no results")
            return False
        
        print(f"✓ Search returned {len(items)} videos:")
        for item in items:
            title = item.get("snippet", {}).get("title", "Unknown")
            video_id = item.get("id", {}).get("videoId", "")
            print(f"  - {title[:50]}... (ID: {video_id})")
        
        # Test video details API (for duration)
        print("\nTesting video details API...")
        video_ids = [item.get("id", {}).get("videoId") for item in items if item.get("id", {}).get("videoId")]
        
        if video_ids:
            details_url = "https://www.googleapis.com/youtube/v3/videos"
            details_params = {
                "key": api_key,
                "part": "contentDetails,statistics",
                "id": ",".join(video_ids),
            }
            
            details_resp = requests.get(details_url, params=details_params, timeout=30)
            if details_resp.status_code == 200:
                details_data = details_resp.json()
                details_items = details_data.get("items", [])
                print(f"✓ Video details returned for {len(details_items)} videos:")
                for item in details_items:
                    duration = item.get("contentDetails", {}).get("duration", "Unknown")
                    views = item.get("statistics", {}).get("viewCount", "0")
                    print(f"  - Duration: {duration}, Views: {views}")
            else:
                print(f"✗ Video details API error: {details_resp.status_code}")
                return False
        
        print("\n✓ YouTube API is working correctly!")
        return True
        
    except requests.exceptions.Timeout:
        print("✗ Request timed out")
        return False
    except requests.exceptions.RequestException as e:
        print(f"✗ Request error: {e}")
        return False
    except Exception as e:
        print(f"✗ Unexpected error: {e}")
        return False


if __name__ == "__main__":
    success = test_youtube_api()
    sys.exit(0 if success else 1)

