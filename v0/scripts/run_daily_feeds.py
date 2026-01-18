#!/usr/bin/env python3
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent.parent))

from agent import generate_feed, generate_feed_tavily  # noqa: E402
from storage import COLLECTIONS, FirestoreStore, get_store  # noqa: E402


def list_users_file_store() -> list[str]:
    users_dir = Path("users")
    if not users_dir.exists():
        return []
    onboarded = []
    for p in users_dir.iterdir():
        if not p.is_dir():
            continue
        profile_path = p / "memory" / "user_profile.json"
        if not profile_path.exists():
            continue
        try:
            profile = json.loads(profile_path.read_text())
        except Exception:
            continue
        if profile.get("onboarded"):
            onboarded.append(str(p))
    return onboarded


def list_users_firestore(store: FirestoreStore) -> list[str]:
    docs = store.db.collection(COLLECTIONS["user_profiles"]).stream()
    onboarded = []
    for doc in docs:
        data = doc.to_dict() or {}
        if data.get("onboarded"):
            onboarded.append(doc.id)
    return onboarded


async def run_all(feed_mode: str) -> None:
    store = get_store()
    if isinstance(store, FirestoreStore):
        user_ids = list_users_firestore(store)
        for uid in user_ids:
            if feed_mode == "tavily":
                await generate_feed_tavily(
                    user_folder=f"users/{uid}",
                    user_id=uid,
                )
            else:
                await generate_feed(
                    user_folder=f"users/{uid}",
                    user_id=uid,
                )
    else:
        user_folders = list_users_file_store()
        for folder in user_folders:
            if feed_mode == "tavily":
                await generate_feed_tavily(user_folder=folder, user_id=None)
            else:
                await generate_feed(user_folder=folder, user_id=None)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--tavily", action="store_true", help="Use Tavily-only trace_t_agent"
    )
    args = parser.parse_args()
    feed_mode = "tavily" if args.tavily else "default"

    backend = os.getenv("STORAGE_BACKEND", "file")
    print(
        f"Running daily feeds with storage backend: {backend} "
        f"(onboarded users only, mode={feed_mode})"
    )
    asyncio.run(run_all(feed_mode))
