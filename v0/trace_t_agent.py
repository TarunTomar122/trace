"""
trace_t_agent - Tavily-only feed generator agent.

This agent is intentionally isolated from the existing Trace sub-agents/tools.
It exposes exactly one tool: tavily_search_urls().
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import requests
from agents import Agent, ModelSettings, RunContextWrapper, function_tool

from context import TraceContext


PROMPTS_DIR = Path(__file__).parent / "prompts"


def load_prompt(filename: str) -> str:
    with open(PROMPTS_DIR / filename, "r") as f:
        return f.read()


def _tavily_post(url: str, payload: dict[str, Any]) -> dict[str, Any]:
    resp = requests.post(url, json=payload, timeout=30)
    try:
        data = resp.json()
    except Exception:
        data = {
            "error": "non_json_response",
            "status_code": resp.status_code,
            "text": resp.text,
        }
    if resp.status_code >= 400:
        # Normalize Tavily errors into a consistent shape for the model.
        return {
            "error": "tavily_request_failed",
            "status_code": resp.status_code,
            "response": data,
        }
    return data if isinstance(data, dict) else {"results": data}


@function_tool
def tavily_search_urls(
    ctx: RunContextWrapper[TraceContext],
    query: str,
    max_results: int = 10,
    search_depth: str = "basic",
) -> str:
    """
    Tavily web search. Returns a JSON string containing an array of results.

    Each result includes: title, url, content (snippet), score (if available).
    """
    _ = ctx  # tool is context-agnostic by design
    print(
        f"[TOOL] tavily_search_urls called: query='{query}', "
        f"max_results={max_results}, search_depth={search_depth}"
    )
    api_key = (os.getenv("TAVILY_API_KEY") or "").strip()
    if not api_key:
        return json.dumps(
            {"error": "missing_env", "message": "TAVILY_API_KEY is not set"}
        )

    payload: dict[str, Any] = {
        "api_key": api_key,
        "query": query,
        "max_results": max_results,
        "search_depth": search_depth,
        # Keep payload conservative: we only need URLs + small snippets.
        "include_answer": False,
        "include_raw_content": False,
        "include_images": False,
    }

    data = _tavily_post("https://api.tavily.com/search", payload)
    if "error" in data:
        return json.dumps(data)

    results = data.get("results", [])
    if not isinstance(results, list):
        results = []

    normalized = []
    for r in results:
        if not isinstance(r, dict):
            continue
        url = r.get("url")
        if not url:
            continue
        normalized.append(
            {
                "title": r.get("title") or "",
                "url": url,
                "content": r.get("content") or "",
                "score": r.get("score"),
                "published_date": (
                    r.get("published_date") or r.get("published") or ""
                ),
            }
        )

    return json.dumps(normalized)


trace_t_agent = Agent[TraceContext](
    name="Trace Tavily Agent (trace_t_agent)",
    instructions=load_prompt("trace_t_agent.md"),
    tools=[tavily_search_urls],
    model="gpt-4.1-mini",
    model_settings=ModelSettings(tool_choice="required"),
)
