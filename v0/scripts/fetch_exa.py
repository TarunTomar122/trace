#!/usr/bin/env python3
"""
Exa API integration for searching blogs, discussions, tweets, launches, etc.
"""
import json
import sys
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root
load_dotenv(Path(__file__).parent.parent.parent / ".env")

from exa_py import Exa
from datetime import datetime, timedelta

exa = Exa(os.getenv("EXA_API_KEY"))

# Content type configurations
CONTENT_CONFIGS = {
    "blog": {
        "category": "blog",
        "include_domains": [
            "engineering.fb.com", "netflixtechblog.com", "uber.com/blog",
            "blog.cloudflare.com", "vercel.com/blog", "linear.app/blog",
            "leerob.io", "kentcdodds.com", "joshwcomeau.com",
            "blog.langchain.dev", "lilianweng.github.io"
        ],
        "num_results": 10
    },
    "discussion": {
        "include_domains": ["news.ycombinator.com"],
        "num_results": 10
    },
    "tweet": {
        "include_domains": ["twitter.com", "x.com"],
        "num_results": 10
    },
    "substack": {
        "include_domains": ["substack.com"],
        "num_results": 8
    },
    "launch": {
        "include_domains": ["producthunt.com"],
        "num_results": 8
    },
    "model": {
        "include_domains": ["huggingface.co"],
        "num_results": 8
    }
}


def fetch_exa(query: str, content_type: str = "blog", days_back: int = 7, max_results: int = 5):
    """
    Search Exa for specific content types.
    
    content_type: "blog" | "discussion" | "tweet" | "substack" | "launch" | "model"
    """
    config = CONTENT_CONFIGS.get(content_type, CONTENT_CONFIGS["blog"])
    
    # Calculate date range
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days_back)
    
    search_params = {
        "query": query,
        "num_results": min(max_results, config.get("num_results", 10)),
        "start_published_date": start_date.strftime("%Y-%m-%dT00:00:00.000Z"),
    }
    
    # Add category if specified
    if "category" in config:
        search_params["category"] = config["category"]
    
    # Add domain filters
    if "include_domains" in config:
        search_params["include_domains"] = config["include_domains"]
    
    try:
        results = exa.search(**search_params)
        
        items = []
        for r in results.results:
            item = {
                "title": r.title,
                "url": r.url,
                "published_date": getattr(r, 'published_date', None),
                "author": getattr(r, 'author', None),
                "score": getattr(r, 'score', 0) or 0,
                "content_type": content_type
            }
            items.append(item)
        
        # Sort by score (relevance) and return top results
        items.sort(key=lambda x: x["score"] or 0, reverse=True)
        return items[:max_results]
        
    except Exception as e:
        return {"error": str(e)}


if __name__ == "__main__":
    query = sys.argv[1] if len(sys.argv) > 1 else "AI agents"
    content_type = sys.argv[2] if len(sys.argv) > 2 else "blog"
    max_results = int(sys.argv[3]) if len(sys.argv) > 3 else 5
    
    results = fetch_exa(query, content_type, max_results=max_results)
    print(json.dumps(results, indent=2, default=str))

