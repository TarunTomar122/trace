"""
Pool Harvester - searches active queries and populates retrieval_pool.

Uses Tavily API to search for content and store results in the global pool.

Usage:
    python v1/agents/pool_harvester.py
"""
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
import hashlib

# Add project root to path for imports (at end to not shadow external packages)
project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env")

import requests

from v1.storage import FirestoreStore
from v1.models import PoolItem, QualitySignals


def generate_pool_id(url: str, date: str) -> str:
    """Generate a unique pool item ID from URL and date."""
    url_hash = hashlib.md5(url.encode()).hexdigest()[:8]
    return f"pool_{date}_{url_hash}"


def detect_content_type(url: str, title: str) -> str:
    """Detect content type from URL and title."""
    url_lower = url.lower()
    title_lower = title.lower()
    
    if "youtube.com" in url_lower or "youtu.be" in url_lower:
        return "video"
    if "github.com" in url_lower:
        return "repo"
    if "arxiv.org" in url_lower:
        return "paper"
    if "twitter.com" in url_lower or "x.com" in url_lower:
        return "tweet"
    if "news.ycombinator.com" in url_lower or "reddit.com" in url_lower:
        return "discussion"
    if "producthunt.com" in url_lower:
        return "launch"
    if "huggingface.co" in url_lower:
        return "model"
    
    return "blog"


def extract_tags(title: str, description: str, umbrella_id: str) -> list[str]:
    """Extract relevant tags from title and description."""
    tags = [umbrella_id]
    
    text = (title + " " + description).lower()
    
    # Common tech tags
    tag_keywords = {
        "llm": ["llm", "language model", "gpt", "claude", "gemini"],
        "ml": ["machine learning", "ml", "neural", "deep learning"],
        "frontend": ["react", "vue", "angular", "frontend", "javascript", "typescript"],
        "backend": ["backend", "api", "server", "database", "sql"],
        "devops": ["docker", "kubernetes", "k8s", "ci/cd", "devops"],
        "mobile": ["ios", "android", "mobile", "react native", "flutter"],
        "performance": ["performance", "optimization", "fast", "speed"],
        "security": ["security", "auth", "encryption", "vulnerability"],
        "open-source": ["open source", "github", "open-source"],
    }
    
    for tag, keywords in tag_keywords.items():
        if any(kw in text for kw in keywords):
            if tag not in tags:
                tags.append(tag)
    
    return tags[:5]  # Limit to 5 tags


def detect_quality_signals(url: str, content: str) -> dict[str, Any]:
    """Detect quality signals from URL and content."""
    url_lower = url.lower()
    
    # Domain authority detection
    high_authority_domains = [
        "github.com", "arxiv.org", "huggingface.co",
        "openai.com", "anthropic.com", "google.ai",
        "microsoft.com", "meta.com", "deepmind.com"
    ]
    medium_authority_domains = [
        "medium.com", "dev.to", "hashnode.com",
        "substack.com", "vercel.com", "netlify.com"
    ]
    
    domain_authority = "low"
    for domain in high_authority_domains:
        if domain in url_lower:
            domain_authority = "high"
            break
    else:
        for domain in medium_authority_domains:
            if domain in url_lower:
                domain_authority = "medium"
                break
    
    # Code detection
    content_lower = content.lower() if content else ""
    has_code = any(marker in content_lower for marker in [
        "```", "code", "function", "import", "class", "def "
    ])
    
    # Estimate read time (rough: 200 words per minute)
    word_count = len(content.split()) if content else 0
    read_time = max(1, word_count // 200)
    
    return {
        "domain_authority": domain_authority,
        "has_code": has_code,
        "read_time_minutes": read_time
    }


def tavily_search(query: str, max_results: int = 10) -> list[dict[str, Any]]:
    """Search using Tavily API."""
    api_key = os.getenv("TAVILY_API_KEY", "").strip()
    if not api_key:
        print("  Warning: TAVILY_API_KEY not set, skipping search")
        return []
    
    payload = {
        "api_key": api_key,
        "query": query,
        "max_results": max_results,
        "search_depth": "basic",
        "include_answer": False,
        "include_raw_content": False,
        "include_images": False,
    }
    
    try:
        resp = requests.post("https://api.tavily.com/search", json=payload, timeout=30)
        if resp.status_code >= 400:
            print(f"  Warning: Tavily API error {resp.status_code}")
            return []
        
        data = resp.json()
        results = data.get("results", [])
        
        normalized = []
        for r in results:
            if not isinstance(r, dict):
                continue
            url = r.get("url")
            if not url:
                continue
            normalized.append({
                "title": r.get("title") or "",
                "url": url,
                "content": r.get("content") or "",
                "score": r.get("score"),
                "published_date": r.get("published_date") or r.get("published") or "",
            })
        
        return normalized
    except Exception as e:
        print(f"  Warning: Tavily search error: {e}")
        return []


def harvest_pool(max_queries: int = 50, items_per_query: int = 5) -> dict:
    """
    Harvest content from active queries into the retrieval pool.
    
    Args:
        max_queries: Maximum number of queries to search
        items_per_query: Maximum items to fetch per query
    
    Returns:
        Stats dict with queries_searched, items_stored, items_deleted
    """
    store = FirestoreStore()
    # Use IST (UTC+5:30) for date since pipeline runs at 10:30 PM UTC = 4:00 AM IST
    ist_tz = timezone(timedelta(hours=5, minutes=30))
    today = datetime.now(ist_tz).strftime("%Y-%m-%d")
    
    # Get active queries (with at least 1 user)
    print("Loading active queries...")
    active_queries = store.get_active_queries(min_users=1)
    print(f"Found {len(active_queries)} active queries")
    
    if not active_queries:
        print("No active queries found. Run map_users_to_queries.py first.")
        return {"queries_searched": 0, "items_stored": 0, "items_deleted": 0}
    
    # Sort by user_count and limit
    active_queries.sort(key=lambda q: q.get("user_count", 0), reverse=True)
    queries_to_search = active_queries[:max_queries]
    
    print(f"Searching top {len(queries_to_search)} queries...")
    
    queries_searched = 0
    items_stored = 0
    urls_seen = set()
    
    for query_doc in queries_to_search:
        query_id = query_doc.get("query_id")
        query_text = query_doc.get("query_text", "")
        umbrella_id = query_doc.get("umbrella_id", "")
        
        if not query_text:
            print(f"  Skipping {query_id} (no query text)")
            continue
        
        print(f"  Searching: {query_text[:50]}...")
        
        # Search using Tavily
        results = tavily_search(query_text, max_results=items_per_query)
        queries_searched += 1
        
        for result in results:
            url = result.get("url")
            if not url:
                continue
            
            # Deduplicate by URL
            if url in urls_seen:
                continue
            
            # Check if URL already in pool
            if store.pool_url_exists(url):
                continue
            
            urls_seen.add(url)
            
            title = result.get("title", "")
            content = result.get("content", "")
            
            # Generate pool item
            pool_id = generate_pool_id(url, today)
            content_type = detect_content_type(url, title)
            tags = extract_tags(title, content, umbrella_id)
            quality_signals = detect_quality_signals(url, content)
            
            pool_item = PoolItem(
                id=pool_id,
                url=url,
                title=title,
                description=content[:500] if content else "",
                type=content_type,
                source="tavily",
                umbrella_id=umbrella_id,
                query_id=query_id,
                tags=tags,
                fetched_at=datetime.utcnow().isoformat(),
                expires_at=(datetime.utcnow() + timedelta(days=3)).isoformat(),
                quality_signals=QualitySignals(**quality_signals),
                trending_score=50,
                freshness_score=95,
                published_date=result.get("published_date"),
                score=result.get("score")
            )
            
            store.add_to_pool(pool_id, pool_item.model_dump())
            items_stored += 1
        
        # Update last_searched for this query
        store.update_query_last_searched(query_id)
    
    # Clean old items
    print("\nCleaning old pool items...")
    items_deleted = store.clean_old_pool_items(max_age_days=3)
    
    # Summary
    print()
    print(f"Searched {queries_searched} queries, stored {items_stored} items, deleted {items_deleted} old items")
    
    return {
        "queries_searched": queries_searched,
        "items_stored": items_stored,
        "items_deleted": items_deleted
    }


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Harvest content into retrieval pool")
    parser.add_argument("--max-queries", type=int, default=50, help="Max queries to search")
    parser.add_argument("--items-per-query", type=int, default=5, help="Items per query")
    args = parser.parse_args()
    
    harvest_pool(max_queries=args.max_queries, items_per_query=args.items_per_query)


if __name__ == "__main__":
    main()

