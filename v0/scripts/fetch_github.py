#!/usr/bin/env python3
import requests
import json
import sys

def fetch_github(query, max_results=5):
    url = "https://api.github.com/search/repositories"
    params = {
        "q": query,
        "sort": "stars",
        "order": "desc",
        "per_page": max_results
    }
    
    response = requests.get(url, params=params)
    data = response.json()
    
    repos = [{
        "name": item["full_name"],
        "url": item["html_url"],
        "stars": item["stargazers_count"],
        "forks": item["forks_count"],
        "language": item["language"],
        "description": item.get("description", ""),
        "updated_at": item.get("updated_at"),
    } for item in data.get("items", [])]
    
    return repos

if __name__ == "__main__":
    query = sys.argv[1] if len(sys.argv) > 1 else "agent memory"
    max_results = int(sys.argv[2]) if len(sys.argv) > 2 else 5
    
    repos = fetch_github(query, max_results)
    print(json.dumps(repos, indent=2))

