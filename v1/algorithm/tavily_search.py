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
    include_domains: list[str] | None = None,
    exclude_domains: list[str] | None = None,
    min_results: int = 4,
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
    if include_domains:
        payload["include_domains"] = include_domains
    if exclude_domains:
        payload["exclude_domains"] = exclude_domains

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
        if include_domains and len(normalized) < min_results:
            fallback_payload = {
                **payload,
                "include_domains": None,
                "exclude_domains": None,
            }
            fallback_payload.pop("include_domains", None)
            fallback_payload.pop("exclude_domains", None)
            fallback_resp = requests.post(
                "https://api.tavily.com/search",
                json=fallback_payload,
                timeout=30,
            )
            if fallback_resp.status_code < 400:
                fallback_data = fallback_resp.json()
                fallback_results = fallback_data.get("results", [])
                for r in fallback_results:
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
        # Dedupe by URL while preserving order
        seen = set()
        deduped = []
        for item in normalized:
            url = item.get("url")
            if url and url not in seen:
                seen.add(url)
                deduped.append(item)
        return deduped
    except Exception as e:
        print(f"  Warning: Tavily search error: {e}")
        return []
