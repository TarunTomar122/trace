#!/usr/bin/env python3
"""
Trace - Personal Agent System
Main orchestrator using OpenAI Agents SDK
"""
import os
import json
import asyncio
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

# CRITICAL: Load .env BEFORE importing trace_agents/tools (they read STORAGE_BACKEND at import time)
load_dotenv()

from agents import Runner
from context import TraceContext
from trace_agents import (
    feed_generator,
    reflection_agent
)
from trace_t_agent import trace_t_agent
from storage import get_store, FirestoreStore, COLLECTIONS
from schemas import VALID_TAGS

STORE = get_store()

# Check for API key
if not os.getenv("OPENAI_API_KEY"):
    print("ERROR: OPENAI_API_KEY not found in environment!")
    print("Please create a .env file with:")
    print("OPENAI_API_KEY=your_key_here")
    exit(1)

# Default user folder
DEFAULT_USER_FOLDER = "users/tarun"

def get_available_users() -> list:
    """Get list of available user folders"""
    users_dir = Path("users")
    if not users_dir.exists():
        return []
    return [d.name for d in users_dir.iterdir() if d.is_dir() and (d / "memory" / "user_profile.json").exists()]

async def generate_feed(user_folder: str = None, github_username: str = None, user_id: str = None):
    """Generate daily personalized feed for a user"""
    user_folder = user_folder or DEFAULT_USER_FOLDER
    date = datetime.now().strftime("%Y-%m-%d")
    start_time = datetime.utcnow()
    
    context = TraceContext(
        user_folder=user_folder,
        user_id=user_id,
        github_username=github_username or os.getenv("GITHUB_USERNAME"),
        date=date
    )
    
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Starting feed generation for {user_folder}...")
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Context: user_folder={context.user_folder}, github_username={context.github_username}, date={context.date}")
    
    runner = Runner()
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Running agent with max_turns=10...")
    
    try:
        result = await runner.run(
            starting_agent=feed_generator,
            context=context,
            input=f"Today's date is {date}. Generate today's personalized feed based on my preferences and patterns. Search for RECENT content (from {date[:4]}, not old years).",
            max_turns=10
        )
        
        # Log what happened
        print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Agent completed!")
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Total conversation items: {len(result.new_items)}")
        
        # Tool calls are logged in the tools themselves with [TOOL] prefix
        # Just count them here
        tool_calls = sum(1 for item in result.new_items if hasattr(item, 'type') and item.type == 'function_call')
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Tool calls in conversation: {tool_calls}")
        if isinstance(STORE, FirestoreStore):
            STORE.db.collection(COLLECTIONS["agent_runs"]).add({
                "type": "feed",
                "user_id": user_id,
                "user_folder": user_folder,
                "date": date,
                "status": "success",
                "tool_calls": tool_calls,
                "items_count": len(result.new_items),
                "started_at": start_time.isoformat(),
                "finished_at": datetime.utcnow().isoformat(),
            })
        
    except Exception as e:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ERROR: {e}")
        import traceback
        traceback.print_exc()
        if isinstance(STORE, FirestoreStore):
            STORE.db.collection(COLLECTIONS["agent_runs"]).add({
                "type": "feed",
                "user_id": user_id,
                "user_folder": user_folder,
                "date": date,
                "status": "error",
                "error": str(e),
                "started_at": start_time.isoformat(),
                "finished_at": datetime.utcnow().isoformat(),
            })
        raise
    
    print(f"\n{'='*60}")
    print(f"FEED GENERATED FOR {user_folder}")
    print(f"{'='*60}")
    print(result.final_output)
    print(f"{'='*60}\n")
    
    return result


def _ensure_list_json(value: str):
    parsed = json.loads(value)
    if not isinstance(parsed, list):
        raise ValueError("Expected a JSON array as final_output")
    return parsed


def _classify_type_from_url(url: str) -> str:
    u = (url or "").lower()
    if "youtube.com" in u or "youtu.be" in u:
        return "video"
    if "github.com" in u:
        return "repo"
    if "arxiv.org" in u:
        return "paper"
    return "blog"

def _pick_tags_from_text(text: str) -> list[str]:
    # Keep this intentionally simple + deterministic.
    t = (text or "").lower()
    tags = []
    if any(k in t for k in ["agent", "agents", "autonomous", "orchestration"]):
        tags.append("agents")
    if any(k in t for k in ["memory", "retrieval", "rag", "embedding"]):
        tags.append("memory")
    if any(k in t for k in ["llm", "gpt", "prompt", "inference"]):
        tags.append("llm")
    if any(k in t for k in ["react", "next.js", "frontend", "ui"]):
        tags.append("frontend")
    if any(k in t for k in ["performance", "latency", "benchmark"]):
        tags.append("performance")
    if any(k in t for k in ["tool", "tools", "sdk", "api"]):
        tags.append("tools")
    if any(k in t for k in ["infra", "kubernetes", "docker", "deployment"]):
        tags.append("infra")
    if any(k in t for k in ["design system", "component", "radix", "tailwind"]):
        tags.append("design-systems")
    if any(k in t for k in ["database", "postgres", "sqlite", "firestore"]):
        tags.append("databases")
    if any(k in t for k in ["paper", "arxiv", "research"]):
        tags.append("ml-research")
    if any(k in t for k in ["release", "launch", "announcing"]):
        tags.append("new-releases")
    if any(k in t for k in ["tutorial", "guide", "how to"]):
        tags.append("tutorials")
    if any(k in t for k in ["devops", "ci", "cd", "pipeline"]):
        tags.append("devops")
    if any(k in t for k in ["career", "interview", "hiring"]):
        tags.append("career")
    # Ensure 1–3 tags max; fall back to tools if empty.
    if not tags:
        tags = ["tools"]
    return tags[:3]

def _sanitize_tags(raw_tags: object, fallback_text: str) -> list[str]:
    if isinstance(raw_tags, list):
        cleaned = [t for t in raw_tags if isinstance(t, str) and t in VALID_TAGS]
        if cleaned:
            return cleaned[:3]
    return _pick_tags_from_text(fallback_text)


async def generate_feed_tavily(user_folder: str = None, github_username: str = None, user_id: str = None):
    """
    Generate daily personalized feed using trace_t_agent (Tavily-only tool).

    Note: To keep the agent tool surface minimal, we read profile/memory and save the feed
    in this orchestrator code (not via agent tools).
    """
    user_folder = user_folder or DEFAULT_USER_FOLDER
    date = datetime.now().strftime("%Y-%m-%d")
    start_time = datetime.utcnow()

    context = TraceContext(
        user_folder=user_folder,
        user_id=user_id,
        github_username=github_username or os.getenv("GITHUB_USERNAME"),
        date=date,
    )

    user_ref = context.user_id or context.user_folder
    store = get_store()

    profile = store.read_user_profile(user_ref)
    preferences = store.read_memory(user_ref, "preferences.json")
    patterns = store.read_memory(user_ref, "patterns.json")
    seen_urls = store.get_seen_urls(user_ref, 14)

    runner = Runner()
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Running trace_t_agent (Tavily-only) with max_turns=10...")

    input_text = (
        f"Today's date is {date}.\n\n"
        "You are generating a daily personalized feed.\n\n"
        "USER_PROFILE (json):\n"
        f"{profile}\n\n"
        "PREFERENCES (json):\n"
        f"{preferences}\n\n"
        "PATTERNS (json):\n"
        f"{patterns}\n\n"
        "SEEN_URLS (json array):\n"
        f"{seen_urls}\n\n"
        "Freshness requirement:\n"
        "- Prefer content from the last 30–90 days.\n"
        "- Older content is allowed only if it is canonical/foundational.\n"
        "- Do NOT blindly append the current year to every query; use rolling-window words like "
        "\"recent\", \"released\", \"past month\", \"last 30 days\".\n"
        "Return ONLY a JSON array of feed items as instructed."
    )

    try:
        result = await runner.run(
            starting_agent=trace_t_agent,
            context=context,
            input=input_text,
            max_turns=10,
        )

        # Count tool calls robustly (new_items isn't always populated consistently).
        tool_calls = 0
        for resp in getattr(result, "raw_responses", []) or []:
            if hasattr(resp, "tool_calls") and resp.tool_calls:
                tool_calls += len(resp.tool_calls)
        print(
            f"[{datetime.now().strftime('%H:%M:%S')}] trace_t_agent completed "
            f"(tool_calls={tool_calls})"
        )

        items = _ensure_list_json(result.final_output)

        # Minimal normalization to keep feeds usable even if the model omits fields.
        now_iso = datetime.utcnow().isoformat() + "Z"
        normalized = []
        for i, item in enumerate(items):
            if not isinstance(item, dict):
                continue
            url = item.get("url")
            title = item.get("title")
            if not url or not title:
                continue
            description = item.get("description") or ""
            combined = f"{title}\n{description}\n{item.get('metadata', {}).get('why_relevant','') if isinstance(item.get('metadata'), dict) else ''}"
            tags = _sanitize_tags(item.get("tags"), combined)
            normalized.append(
                {
                    # Keep Trace schema unchanged: treat Tavily results as "exa" source items.
                    "id": item.get("id") or f"exa_{date}_{i+1}",
                    "type": item.get("type") or _classify_type_from_url(url),
                    "title": title,
                    "description": description,
                    "tags": tags,
                    "url": url,
                    "thumbnail": item.get("thumbnail", None),
                    "timestamp": item.get("timestamp") or now_iso,
                    "source": item.get("source") or "exa",
                    "metadata": item.get("metadata") or {"why_relevant": "", "feed_category": None},
                    "stars": item.get("stars"),
                    "view_count": item.get("view_count"),
                    "score": item.get("score"),
                }
            )

        save_result = store.save_feed(user_ref, date, json.dumps(normalized))
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Saved Tavily feed: {save_result}")

        if isinstance(STORE, FirestoreStore):
            STORE.db.collection(COLLECTIONS["agent_runs"]).add(
                {
                    "type": "feed_tavily",
                    "user_id": user_id,
                    "user_folder": user_folder,
                    "date": date,
                    "status": "success",
                    "items_count": len(normalized),
                    "started_at": start_time.isoformat(),
                    "finished_at": datetime.utcnow().isoformat(),
                }
            )

        print(f"\n{'='*60}")
        print(f"TAVILY FEED GENERATED FOR {user_folder}")
        print(f"{'='*60}")
        print(json.dumps(normalized, indent=2))
        print(f"{'='*60}\n")

        return normalized

    except Exception as e:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ERROR: {e}")
        import traceback

        traceback.print_exc()
        if isinstance(STORE, FirestoreStore):
            STORE.db.collection(COLLECTIONS["agent_runs"]).add(
                {
                    "type": "feed_tavily",
                    "user_id": user_id,
                    "user_folder": user_folder,
                    "date": date,
                    "status": "error",
                    "error": str(e),
                    "started_at": start_time.isoformat(),
                    "finished_at": datetime.utcnow().isoformat(),
                }
            )
        raise


async def reflect_on_day(user_folder: str = None, github_username: str = None, user_id: str = None):
    """Run end-of-day reflection and update preferences/patterns for a user"""
    user_folder = user_folder or DEFAULT_USER_FOLDER
    date = datetime.now().strftime("%Y-%m-%d")
    start_time = datetime.utcnow()
    
    context = TraceContext(
        user_folder=user_folder,
        user_id=user_id,
        github_username=github_username or os.getenv("GITHUB_USERNAME"),
        date=date
    )
    
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Starting reflection for {user_folder}...")
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Context: user_folder={context.user_folder}, github_username={context.github_username}, date={context.date}")
    
    runner = Runner()
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Running reflection agent...")
    
    try:
        result = await runner.run(
            starting_agent=reflection_agent,
            context=context,
            input="First, read today's interactions (upvotes/downvotes) using read_daily_interactions(). Then analyze the feedback and update patterns.json accordingly.",
            max_turns=10
        )
        
        # Log what happened
        print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Reflection completed!")
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Total responses: {len(result.raw_responses)}")
        
        # Log tool calls
        tool_calls = 0
        for resp in result.raw_responses:
            if hasattr(resp, 'tool_calls') and resp.tool_calls:
                for tc in resp.tool_calls:
                    tool_calls += 1
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] Tool called: {tc.function.name}")
        
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Total tool calls: {tool_calls}")
        if isinstance(STORE, FirestoreStore):
            STORE.db.collection(COLLECTIONS["agent_runs"]).add({
                "type": "reflection",
                "user_id": user_id,
                "user_folder": user_folder,
                "date": date,
                "status": "success",
                "tool_calls": tool_calls,
                "started_at": start_time.isoformat(),
                "finished_at": datetime.utcnow().isoformat(),
            })
        
    except Exception as e:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ERROR: {e}")
        import traceback
        traceback.print_exc()
        if isinstance(STORE, FirestoreStore):
            STORE.db.collection(COLLECTIONS["agent_runs"]).add({
                "type": "reflection",
                "user_id": user_id,
                "user_folder": user_folder,
                "date": date,
                "status": "error",
                "error": str(e),
                "started_at": start_time.isoformat(),
                "finished_at": datetime.utcnow().isoformat(),
            })
        raise
    
    print(f"\n{'='*60}")
    print(f"REFLECTION COMPLETE FOR {user_folder}")
    print(f"{'='*60}")
    print(result.final_output)
    print(f"{'='*60}\n")
    
    return result

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python agent.py <command> [user_folder] [github_username]")
        print("")
        print("Commands:")
        print("  generate  - Generate daily feed for a user")
        print("  generate_tavily  - Generate daily feed using trace_t_agent (Tavily-only)")
        print("  reflect   - Run reflection for a user")
        print("  users     - List available users")
        print("")
        print("Examples:")
        print("  python agent.py generate users/tarun")
        print("  python agent.py reflect users/ananya")
        print("  python agent.py users")
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "users":
        users = get_available_users()
        print("Available users:")
        for user in users:
            print(f"  - users/{user}")
        sys.exit(0)
    
    user_folder = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_USER_FOLDER
    github_username = sys.argv[3] if len(sys.argv) > 3 else None
    
    if command == "generate":
        asyncio.run(generate_feed(user_folder, github_username))
    elif command == "generate_tavily":
        asyncio.run(generate_feed_tavily(user_folder, github_username))
    elif command == "reflect":
        asyncio.run(reflect_on_day(user_folder, github_username))
    else:
        print(f"Unknown command: {command}")
        print("Available commands: generate, generate_tavily, reflect, users")
