#!/usr/bin/env python3
"""
YouTube transcript fetcher.

Fetches transcripts/captions for YouTube videos to enable AI summarization.

Usage:
    from v1.tools.youtube_transcript import fetch_youtube_transcript
    
    transcript = fetch_youtube_transcript("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
    if transcript:
        print(transcript)
"""
import re
from typing import Optional
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    TranscriptsDisabled,
    NoTranscriptFound,
    VideoUnavailable,
)


def extract_video_id(url: str) -> Optional[str]:
    """
    Extract video ID from various YouTube URL formats.
    
    Examples:
        https://www.youtube.com/watch?v=VIDEO_ID
        https://youtu.be/VIDEO_ID
        https://www.youtube.com/embed/VIDEO_ID
    """
    patterns = [
        r'(?:v=|/)([0-9A-Za-z_-]{11}).*',
        r'youtu\.be/([0-9A-Za-z_-]{11})',
        r'embed/([0-9A-Za-z_-]{11})',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    
    return None


def fetch_youtube_transcript(
    url: str,
    languages: list[str] = ['en', 'en-US', 'en-GB'],
    fallback_to_auto: bool = True,
) -> Optional[str]:
    """
    Fetch transcript for a YouTube video.
    
    Args:
        url: YouTube video URL
        languages: Preferred language codes to try (default: English variants)
        fallback_to_auto: If True, will use auto-generated captions if manual
                         transcripts aren't available (default: True)
    
    Returns:
        Transcript text as a single string, or None if not available
    """
    video_id = extract_video_id(url)
    if not video_id:
        print(f"  Could not extract video ID from URL: {url}")
        return None
    
    try:
        # Try to get transcript in preferred languages
        transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
        
        # First, try manual transcripts
        transcript = None
        for lang in languages:
            try:
                transcript = transcript_list.find_transcript([lang])
                break
            except NoTranscriptFound:
                continue
        
        # If no manual transcript found and fallback is enabled, try auto-generated
        if transcript is None and fallback_to_auto:
            try:
                transcript = transcript_list.find_generated_transcript(languages)
            except NoTranscriptFound:
                pass
        
        if transcript is None:
            print(f"  No transcript found for video {video_id} in languages: {languages}")
            return None
        
        # Fetch and format the transcript
        transcript_data = transcript.fetch()
        
        # Join all text segments with spaces
        full_text = ' '.join(entry['text'] for entry in transcript_data)
        
        # Clean up the text (remove extra whitespace, etc.)
        full_text = ' '.join(full_text.split())
        
        return full_text
        
    except TranscriptsDisabled:
        print(f"  Transcripts are disabled for video {video_id}")
        return None
    except VideoUnavailable:
        print(f"  Video {video_id} is unavailable")
        return None
    except Exception as e:
        print(f"  Error fetching transcript for {video_id}: {e}")
        return None


def get_transcript_with_timestamps(url: str) -> Optional[list[dict]]:
    """
    Fetch transcript with timestamps preserved.
    
    Returns:
        List of dicts with 'text', 'start', and 'duration' keys, or None if not available
    """
    video_id = extract_video_id(url)
    if not video_id:
        return None
    
    try:
        transcript = YouTubeTranscriptApi.get_transcript(video_id)
        return transcript
    except Exception as e:
        print(f"  Error fetching timestamped transcript for {video_id}: {e}")
        return None


def main():
    """Test the transcript fetcher."""
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python youtube_transcript.py <youtube_url>")
        sys.exit(1)
    
    url = sys.argv[1]
    print(f"Fetching transcript for: {url}")
    
    transcript = fetch_youtube_transcript(url)
    if transcript:
        print(f"\nTranscript length: {len(transcript)} characters")
        print(f"\nFirst 500 characters:\n{transcript[:500]}...")
    else:
        print("\nFailed to fetch transcript")


if __name__ == "__main__":
    main()
