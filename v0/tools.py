import json
import subprocess
from pathlib import Path
from datetime import datetime
from typing import Optional
import importlib.util
from agents import function_tool, RunContextWrapper
from context import TraceContext
from storage import get_store

# Shared scripts directory (not user-specific)
SCRIPTS_DIR = Path("scripts")

# Lazy-load STORE to avoid import-order issues with .env loading
_STORE = None
def _get_store():
    global _STORE
    if _STORE is None:
        _STORE = get_store()
    return _STORE

def _get_user_ref(ctx: RunContextWrapper[TraceContext]) -> str:
    return ctx.context.user_id or ctx.context.user_folder


_REFLECTION_MODULE = None


def _load_reflection_module():
    global _REFLECTION_MODULE
    if _REFLECTION_MODULE is not None:
        return _REFLECTION_MODULE
    module_path = SCRIPTS_DIR / "reflection.py"
    spec = importlib.util.spec_from_file_location("reflection", module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Failed to load reflection module")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    _REFLECTION_MODULE = module
    return module


def _get_latest_feed_date(store, user_ref: str) -> Optional[str]:
    from storage import FirestoreStore
    if isinstance(store, FirestoreStore):
        feeds_ref = store.db.collection("user_feeds").document(user_ref).collection("daily")
        latest_docs = feeds_ref.order_by("date", direction="DESCENDING").limit(1).stream()
        latest_doc = next(latest_docs, None)
        return latest_doc.id if latest_doc else None
    feeds_dir = Path(user_ref) / "feeds"
    if feeds_dir.exists():
        feed_files = sorted(feeds_dir.glob("*_feed.json"), reverse=True)
        if feed_files:
            return feed_files[0].stem.replace("_feed", "")
    return None


def _get_latest_interactions_date(store, user_ref: str) -> Optional[str]:
    from storage import FirestoreStore
    if isinstance(store, FirestoreStore):
        interactions_ref = (
            store.db.collection("user_interactions")
            .document(user_ref)
            .collection("daily")
        )
        latest_docs = (
            interactions_ref.order_by("date", direction="DESCENDING")
            .limit(1)
            .stream()
        )
        latest_doc = next(latest_docs, None)
        return latest_doc.id if latest_doc else None
    daily_dir = Path(user_ref) / "memory" / "daily"
    if daily_dir.exists():
        interaction_files = sorted(daily_dir.glob("*_interactions.json"), reverse=True)
        if interaction_files:
            return interaction_files[0].stem.replace("_interactions", "")
    return None


@function_tool
def read_user_profile(ctx: RunContextWrapper[TraceContext]) -> str:
    """Read the user's profile information (who they are, interests, background, goals)"""
    print(f"[TOOL] read_user_profile called")
    content = _get_store().read_user_profile(_get_user_ref(ctx))
    print(f"[TOOL] read_user_profile returned {len(content)} chars")
    return content

@function_tool
def read_memory(ctx: RunContextWrapper[TraceContext], file_name: str) -> str:
    """Read from agent memory files (preferences.json, patterns.json, etc.)"""
    print(f"[TOOL] read_memory called for: {file_name}")
    content = _get_store().read_memory(_get_user_ref(ctx), file_name)
    if content == "{}":
        print(f"[TOOL] read_memory: file not found")
    print(f"[TOOL] read_memory returned {len(content)} chars")
    return content

@function_tool
def write_memory(ctx: RunContextWrapper[TraceContext], file_name: str, data: str) -> str:
    """Write to agent memory files. Data should be a JSON string."""
    return _get_store().write_memory(_get_user_ref(ctx), file_name, data)

@function_tool
def fetch_arxiv(ctx: RunContextWrapper[TraceContext], query: str, max_results: int = 5) -> str:
    """Fetch papers from arXiv based on search query. Returns JSON string."""
    print(f"[TOOL] fetch_arxiv called with query='{query}', max_results={max_results}")
    result = subprocess.run(
        ["python", str(SCRIPTS_DIR / "fetch_arxiv.py"), query, str(max_results)],
        capture_output=True,
        text=True
    )
    if result.returncode != 0:
        print(f"[TOOL] fetch_arxiv ERROR: {result.stderr}")
        return json.dumps({"error": result.stderr})
    papers = json.loads(result.stdout)
    print(f"[TOOL] fetch_arxiv returned {len(papers) if isinstance(papers, list) else 0} papers")
    return json.dumps(papers[:max_results]) if isinstance(papers, list) else result.stdout

@function_tool
def fetch_github(ctx: RunContextWrapper[TraceContext], query: str, max_results: int = 5) -> str:
    """Fetch repositories from GitHub based on search query. Returns JSON string."""
    print(f"[TOOL] fetch_github called with query='{query}', max_results={max_results}")
    result = subprocess.run(
        ["python", str(SCRIPTS_DIR / "fetch_github.py"), query, str(max_results)],
        capture_output=True,
        text=True
    )
    if result.returncode != 0:
        print(f"[TOOL] fetch_github ERROR: {result.stderr}")
        return json.dumps({"error": result.stderr})
    repos = json.loads(result.stdout)
    print(f"[TOOL] fetch_github returned {len(repos)} repos")
    return result.stdout

@function_tool
def fetch_youtube(ctx: RunContextWrapper[TraceContext], query: str, max_results: int = 5) -> str:
    """Fetch videos from YouTube based on search query. Returns JSON string."""
    print(f"[TOOL] fetch_youtube called with query='{query}', max_results={max_results}")
    result = subprocess.run(
        ["python", str(SCRIPTS_DIR / "fetch_youtube.py"), query, str(max_results)],
        capture_output=True,
        text=True
    )
    if result.returncode != 0:
        print(f"[TOOL] fetch_youtube ERROR: {result.stderr}")
        return json.dumps({"error": result.stderr})
    videos = json.loads(result.stdout)
    print(f"[TOOL] fetch_youtube returned {len(videos) if isinstance(videos, list) else 0} videos")
    return json.dumps(videos[:max_results]) if isinstance(videos, list) else result.stdout

@function_tool
def fetch_exa(ctx: RunContextWrapper[TraceContext], query: str, content_type: str = "blog", max_results: int = 5) -> str:
    """
    Search web content using Exa API.
    
    content_type options:
    - "blog": Engineering blogs, tech posts
    - "discussion": HackerNews threads
    - "tweet": Twitter/X threads
    - "substack": Newsletter posts
    - "launch": Product Hunt launches
    - "model": Hugging Face models
    - "repo": GitHub repositories
    
    Returns JSON string with title, url, published_date, score.
    """
    print(f"[TOOL] fetch_exa called: query='{query}', type={content_type}, max={max_results}")
    result = subprocess.run(
        ["python", str(SCRIPTS_DIR / "fetch_exa.py"), query, content_type, str(max_results)],
        capture_output=True,
        text=True
    )
    if result.returncode != 0:
        print(f"[TOOL] fetch_exa ERROR: {result.stderr}")
        return json.dumps({"error": result.stderr})
    items = json.loads(result.stdout)
    print(f"[TOOL] fetch_exa returned {len(items) if isinstance(items, list) else 0} items")
    return json.dumps(items[:max_results]) if isinstance(items, list) else result.stdout


@function_tool
def fetch_github_activity(ctx: RunContextWrapper[TraceContext], username: str, days: int = 1) -> str:
    """Fetch user's GitHub activity for the specified number of days. Returns JSON string."""
    result = subprocess.run(
        ["python", str(SCRIPTS_DIR / "fetch_github_activity.py"), username, str(days)],
        capture_output=True,
        text=True
    )
    if result.returncode != 0:
        return json.dumps({"error": result.stderr})
    return result.stdout

@function_tool
def read_daily_interactions(ctx: RunContextWrapper[TraceContext]) -> str:
    """Read upvotes/downvotes for the most recent feed. CALL THIS FIRST to get user feedback!
    
    This reads interactions tied to the last generated feed (not just today's date),
    since users can interact with the same feed over multiple days.
    """
    user_ref = _get_user_ref(ctx)
    store = _get_store()
    feed_date = _get_latest_feed_date(store, user_ref)
    if not feed_date:
        print("[TOOL] read_daily_interactions: No feeds found for user")
        return "[]"
    print(f"[TOOL] read_daily_interactions: Found latest feed from {feed_date}")
    content = store.read_daily_interactions(user_ref, feed_date)
    print(f"[TOOL] read_daily_interactions returned {len(content)} chars")
    if content.strip() != "[]":
        return content

    # Fallback: if feed_date has no interactions, use latest interactions date.
    fallback_date = _get_latest_interactions_date(store, user_ref)
    if fallback_date and fallback_date != feed_date:
        print(
            "[TOOL] read_daily_interactions: No interactions for feed_date, "
            f"falling back to {fallback_date}"
        )
        content = store.read_daily_interactions(user_ref, fallback_date)
        print(f"[TOOL] read_daily_interactions returned {len(content)} chars")
    return content

@function_tool
def read_daily_activity(ctx: RunContextWrapper[TraceContext]) -> str:
    """Read today's activity log. Returns JSON string."""
    date = ctx.context.date if ctx.context else None
    date = date or datetime.now().strftime("%Y-%m-%d")
    print(f"[TOOL] read_daily_activity called for date: {date}")
    content = _get_store().read_daily_activity(_get_user_ref(ctx), date)
    print(f"[TOOL] read_daily_activity returned {len(content)} chars")
    return content

@function_tool
def run_reflection_algorithm(ctx: RunContextWrapper[TraceContext]) -> str:
    """
    Run the Python-based reflection algorithm.
    This does the math: updates tag scores based on today's upvotes/downvotes.
    Returns summary data for LLM to interpret and write history entry.
    """
    date = ctx.context.date if ctx.context else None
    date = date or datetime.now().strftime("%Y-%m-%d")
    user_folder = ctx.context.user_folder
    user_ref = _get_user_ref(ctx)
    store = _get_store()

    feed_date = _get_latest_feed_date(store, user_ref) or date
    print(
        f"[TOOL] run_reflection_algorithm called for feed_date: {feed_date}, "
        f"user: {user_folder}"
    )

    from storage import FirestoreStore
    if isinstance(store, FirestoreStore):
        interactions_raw = store.read_daily_interactions(user_ref, feed_date)
        interactions = json.loads(interactions_raw)
        if not interactions:
            fallback_date = _get_latest_interactions_date(store, user_ref)
            if fallback_date and fallback_date != feed_date:
                print(
                    "[TOOL] run_reflection_algorithm: No interactions for feed_date, "
                    f"falling back to {fallback_date}"
                )
                interactions_raw = store.read_daily_interactions(user_ref, fallback_date)
                interactions = json.loads(interactions_raw)
                feed_date = fallback_date

        if not interactions:
            return json.dumps(
                {
                    "success": False,
                    "message": "No interactions found for latest feed or interactions",
                    "date": feed_date,
                }
            )
        patterns_raw = store.read_memory(user_ref, "patterns.json")
        patterns = json.loads(patterns_raw) if patterns_raw else {}
        if not patterns:
            patterns = {"tags": {}, "exclude_tags": [], "exploration": {}, "history": []}

        reflection = _load_reflection_module()
        updates = reflection.calculate_updates(patterns, interactions)
        updated_patterns = reflection.apply_updates(patterns, updates, feed_date)
        summary_data = reflection.generate_summary_data(updates)

        store.write_memory(user_ref, "patterns.json", json.dumps(updated_patterns))
        print("[TOOL] run_reflection_algorithm completed (firestore)")
        return json.dumps(
            {
                "success": True,
                "date": feed_date,
                "summary_data": summary_data,
                "patterns": updated_patterns,
                "message": (
                    f"Updated {len(updates['tag_updates'])} tags based on "
                    f"{len(interactions)} interactions"
                ),
            }
        )

    result = subprocess.run(
        ["python", str(SCRIPTS_DIR / "reflection.py"), user_folder, feed_date],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"[TOOL] run_reflection_algorithm ERROR: {result.stderr}")
        return json.dumps({"error": result.stderr})

    print("[TOOL] run_reflection_algorithm completed")
    return result.stdout


@function_tool
def get_seen_urls(ctx: RunContextWrapper[TraceContext], days: int = 14) -> str:
    """Get URLs that have been shown in the last N days. Use this to avoid showing duplicate content."""
    print(f"[TOOL] get_seen_urls called with days={days}")
    recent_urls = json.loads(_get_store().get_seen_urls(_get_user_ref(ctx), days))
    print(f"[TOOL] get_seen_urls returned {len(recent_urls)} URLs from last {days} days")
    return json.dumps(recent_urls)


@function_tool
def save_feed(ctx: RunContextWrapper[TraceContext], items: str) -> str:
    """Save generated feed items to file. Items should be a JSON string array. Date is taken from context automatically."""
    # ALWAYS use context.date, never let agent specify date
    date = ctx.context.date if ctx.context else None
    date = date or datetime.now().strftime("%Y-%m-%d")
    
    print(f"[TOOL] save_feed called with {len(items)} chars of data, saving to date: {date}")
    
    parsed_items = json.loads(items)
    result = _get_store().save_feed(_get_user_ref(ctx), date, items)
    print(f"[TOOL] save_feed completed: {len(parsed_items)} items saved")
    return result
