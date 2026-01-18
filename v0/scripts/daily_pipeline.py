#!/usr/bin/env python3
"""
Trace Daily Pipeline - Simplified

Flow:
1. List onboarded users
2. Run reflection for each user (updates patterns based on interactions)
3. Generate feed for each user (agent reads profile + patterns, decides what to fetch)
"""
import argparse
import asyncio
import os
import json
import sys
from pathlib import Path
from datetime import datetime
from typing import Iterable
from dotenv import load_dotenv

# CRITICAL: Load .env BEFORE importing agent/tools (they read STORAGE_BACKEND at import time)
load_dotenv()

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from agent import generate_feed, generate_feed_tavily, reflect_on_day
from storage import get_store, FirestoreStore, FileStore, COLLECTIONS


def _log(msg: str, level: str = "INFO") -> None:
    timestamp = datetime.now().strftime("%H:%M:%S")
    prefix = {"INFO": "ℹ️ ", "OK": "✅", "SKIP": "⏭️ ", "ERR": "❌", "STEP": "🔄"}.get(level, "")
    print(f"[{timestamp}] {prefix} {msg}")


def _is_onboarded(profile: dict) -> bool:
    return bool(profile.get("onboarded"))


def _list_users(store) -> list[str]:
    """Get list of onboarded user IDs"""
    if isinstance(store, FirestoreStore):
        _log("Fetching users from Firestore...", "INFO")
        docs = list(store.db.collection(COLLECTIONS["user_profiles"]).stream())
        users = [doc.id for doc in docs if _is_onboarded(doc.to_dict() or {})]
        _log(f"Found {len(users)} onboarded users (out of {len(docs)} total)", "INFO")
        return users
    if isinstance(store, FileStore):
        users_dir = os.getenv("TRACE_USERS_DIR", "users")
        _log(f"Fetching users from local files ({users_dir})...", "INFO")
        onboarded = []
        for entry in os.scandir(users_dir):
            if not entry.is_dir():
                continue
            profile_path = os.path.join(entry.path, "memory", "user_profile.json")
            try:
                with open(profile_path, "r") as f:
                    profile = json.load(f)
                if _is_onboarded(profile):
                    onboarded.append(entry.name)
            except FileNotFoundError:
                continue
        _log(f"Found {len(onboarded)} onboarded users", "INFO")
        return onboarded
    return []


async def _run_reflection_for_all(store) -> None:
    user_ids = _list_users(store)
    _log(f"Running reflection for {len(user_ids)} users...", "STEP")
    for i, user_id in enumerate(user_ids, 1):
        _log(f"  [{i}/{len(user_ids)}] Reflecting for user: {user_id[:8]}...", "INFO")
        user_folder = f"users/{user_id}"
        await reflect_on_day(user_folder=user_folder, user_id=user_id)
        _log(f"  [{i}/{len(user_ids)}] Reflection complete for: {user_id[:8]}...", "OK")
    _log(f"Reflection complete for all {len(user_ids)} users", "OK")


async def _run_feed_for_all(store, feed_mode: str) -> None:
    user_ids = _list_users(store)
    _log(f"Generating feeds for {len(user_ids)} users...", "STEP")
    for i, user_id in enumerate(user_ids, 1):
        _log(f"  [{i}/{len(user_ids)}] Generating feed for: {user_id[:8]}...", "INFO")
        user_folder = f"users/{user_id}"
        if feed_mode == "tavily":
            await generate_feed_tavily(user_folder=user_folder, user_id=user_id)
        else:
            await generate_feed(user_folder=user_folder, user_id=user_id)
        _log(f"  [{i}/{len(user_ids)}] Feed complete for: {user_id[:8]}...", "OK")
    _log(f"Feed generation complete for all {len(user_ids)} users", "OK")


def main() -> None:
    parser = argparse.ArgumentParser(description="Run Trace daily pipeline")
    parser.add_argument("--skip-reflection", action="store_true", help="Skip reflection step")
    parser.add_argument("--skip-feed", action="store_true", help="Skip feed generation step")
    parser.add_argument(
        "--feed-mode",
        choices=["default", "tavily"],
        default="default",
        help="Which feed generator to run (default=existing multi-agent, tavily=trace_t_agent Tavily-only)",
    )
    args = parser.parse_args()

    print("\n" + "=" * 60)
    print("🚀 TRACE DAILY PIPELINE")
    print("=" * 60 + "\n")

    backend = os.getenv("STORAGE_BACKEND", "file")
    _log(f"Storage backend: {backend}", "INFO")
    _log(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", "INFO")
    print()

    # Step 1: Initialize store
    _log("STEP 1: Initializing storage...", "STEP")
    store = get_store()
    _log(f"Storage initialized ({type(store).__name__})", "OK")
    print()

    # Step 2: Run reflection (updates patterns based on user interactions)
    if args.skip_reflection:
        _log("STEP 2: Reflection [SKIPPED]", "SKIP")
    else:
        _log("STEP 2: Running daily reflection...", "STEP")
        asyncio.run(_run_reflection_for_all(store))
    print()

    # Step 3: Generate feeds (agent reads profile + patterns, decides what to fetch)
    if args.skip_feed:
        _log("STEP 3: Feed generation [SKIPPED]", "SKIP")
    else:
        _log(f"STEP 3: Generating user feeds (mode={args.feed_mode})...", "STEP")
        asyncio.run(_run_feed_for_all(store, args.feed_mode))
    print()

    # Done
    print("=" * 60)
    _log(f"Pipeline complete at {datetime.now().strftime('%H:%M:%S')}", "OK")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
