#!/usr/bin/env python3
"""
Test script for YouTube transcript fetching.

Usage:
    python v1/tools/test_youtube_transcript.py
"""
import sys
from pathlib import Path

project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from v1.tools.youtube_transcript import fetch_youtube_transcript, extract_video_id


def test_video_id_extraction():
    """Test video ID extraction from various URL formats."""
    print("Testing video ID extraction...")
    
    test_cases = [
        ("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=123", "dQw4w9WgXcQ"),
    ]
    
    all_passed = True
    for url, expected_id in test_cases:
        video_id = extract_video_id(url)
        if video_id == expected_id:
            print(f"  ✓ {url} -> {video_id}")
        else:
            print(f"  ✗ {url} -> {video_id} (expected {expected_id})")
            all_passed = False
    
    return all_passed


def test_transcript_fetch():
    """Test actual transcript fetching."""
    print("\nTesting transcript fetching...")
    
    # Use a well-known video with captions
    # This is a popular tech talk that usually has transcripts
    test_url = "https://www.youtube.com/watch?v=8pTEmbeENF4"  # Google I/O Keynote
    
    print(f"  Fetching transcript for: {test_url}")
    transcript = fetch_youtube_transcript(test_url)
    
    if transcript:
        print(f"  ✓ Transcript fetched successfully!")
        print(f"  Length: {len(transcript)} characters")
        print(f"  Preview: {transcript[:200]}...")
        return True
    else:
        print(f"  ✗ Failed to fetch transcript")
        print(f"  Note: This might be expected if the video doesn't have captions")
        return False


def main():
    print("YouTube Transcript Tool Test\n" + "=" * 50)
    
    # Test video ID extraction
    id_test_passed = test_video_id_extraction()
    
    # Test transcript fetching
    transcript_test_passed = test_transcript_fetch()
    
    print("\n" + "=" * 50)
    if id_test_passed:
        print("✓ All video ID extraction tests passed")
    else:
        print("✗ Some video ID extraction tests failed")
    
    if transcript_test_passed:
        print("✓ Transcript fetching test passed")
    else:
        print("⚠ Transcript fetching test failed (might be expected)")
    
    print("\nTo test with a specific video:")
    print("  python v1/tools/youtube_transcript.py <youtube_url>")


if __name__ == "__main__":
    main()
