#!/usr/bin/env python3
import arxiv
import json
import sys

def fetch_arxiv(query, max_results=5):
    results = arxiv.Search(
        query=query,
        max_results=max_results,
        sort_by=arxiv.SortCriterion.Relevance
    ).results()
    
    papers = [{
        "title": r.title,
        "url": r.entry_id,
        "published": r.published.isoformat()
    } for r in results]
    
    return papers

if __name__ == "__main__":
    query = sys.argv[1] if len(sys.argv) > 1 else "machine learning"
    max_results = int(sys.argv[2]) if len(sys.argv) > 2 else 5
    
    papers = fetch_arxiv(query, max_results)
    print(json.dumps(papers, indent=2))

