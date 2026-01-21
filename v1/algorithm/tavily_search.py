import os
from datetime import datetime, timedelta
from typing import Any

import requests


def tavily_search(
    query: str,
    max_results: int,
    days: int,
    topic: str = "general",
    search_depth: str = "basic",
) -> list[dict[str, Any]]:
    api_key = os.getenv("TAVILY_API_KEY", "").strip()
    if not api_key:
        print("  Warning: TAVILY_API_KEY not set, skipping Tavily search")
        return []

    today = datetime.utcnow().date()
    start_date = (today - timedelta(days=days)).isoformat()
    end_date = today.isoformat()

    payload = {
        "api_key": api_key,
        "query": query,
        "max_results": max_results,
        "search_depth": search_depth,
        "include_answer": False,
        "include_raw_content": False,
        "include_images": False,
        "topic": topic,
        "start_date": start_date,
        "end_date": end_date,
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

