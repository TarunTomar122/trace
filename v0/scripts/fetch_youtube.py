#!/usr/bin/env python3
import json
import re
import sys
import yt_dlp

# Title patterns to exclude (case-insensitive)
EXCLUDED_TITLE_PATTERNS = [
    # Tutorials and guides
    r'\btutorial\b',
    r'\bwalkthrough\b',
    r'\bhow\s+to\b',
    r'\bfor\s+beginners\b',
    r'\bstep\s+by\s+step\b',
    r'\blearn\s+\w+\s+in\b',
    r'\bcomplete\s+guide\b',
    r'\bfull\s+course\b',
    r'\bcrash\s+course\b',
    r'\bintroduction\s+to\b',
    r'\bgetting\s+started\b',
    r'\bbasics\b',
    # Shorts and reels
    r'\b#shorts\b',
    r'\b#short\b',
    r'\breels?\b',
    r'\b#trending\b',
    # Lists and compilations
    r'\btop\s+\d+\b',
    r'\bbest\s+\d+\b',
    r'\b\d+\s+things\b',
    r'\b\d+\s+tips\b',
    r'\b\d+\s+ways\b',
    r'\b\d+\s+mistakes\b',
    # Reviews and comparisons
    r'\breview\b',
    r'\bvs\.?\b',
    r'\bcomparison\b',
    r'\bunboxing\b',
    # Motivational/hype
    r'\byou\s+need\s+to\b',
    r'\byou\s+should\b',
    r'\bmust\s+watch\b',
    r'\bmust\s+see\b',
    r'\bmind\s*blow',
    r'\binsane\b',
    r'\bcrazy\b',
]

# Minimum duration in seconds (filters out shorts/reels)
MIN_DURATION_SECONDS = 180  # 3 minutes minimum for substantive content


def is_excluded_title(title: str) -> bool:
    """Check if title matches any excluded patterns"""
    if not title:
        return False
    title_lower = title.lower()
    for pattern in EXCLUDED_TITLE_PATTERNS:
        if re.search(pattern, title_lower):
            return True
    return False


def fetch_youtube(query, max_results=5):
    """Search YouTube videos, filtered and sorted by view count (popularity)"""
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': 'in_playlist',
    }
    
    # Fetch more results to account for filtering
    fetch_count = max_results * 4
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        search_results = ydl.extract_info(f"ytsearch{fetch_count}:{query}", download=False)
        
        videos = []
        for entry in search_results.get('entries', []):
            title = entry.get('title', '')
            duration = entry.get('duration') or 0
            
            # Skip shorts/reels (under 60 seconds)
            if duration < MIN_DURATION_SECONDS:
                continue
            
            # Skip excluded title patterns (tutorials, etc.)
            if is_excluded_title(title):
                continue
            
            videos.append({
                "title": title,
                "url": entry.get('url'),
                "thumbnail": entry.get('thumbnail'),
                "channel": entry.get('channel'),
                "view_count": entry.get('view_count', 0) or 0,
                "like_count": entry.get('like_count', 0) or 0,
                "duration": duration,
            })
        
        # Sort by view count (most popular first) and return top results
        videos.sort(key=lambda x: x['view_count'], reverse=True)
        return videos[:max_results]


if __name__ == "__main__":
    query = sys.argv[1] if len(sys.argv) > 1 else "programming"
    max_results = int(sys.argv[2]) if len(sys.argv) > 2 else 5
    
    videos = fetch_youtube(query, max_results)
    print(json.dumps(videos, indent=2))
