"""
Backfill interest/hobby umbrella mappings for user profiles.

Uses a single LLM call per user to map all interests + hobbies in bulk.
"""
import argparse
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env")

from v1.storage import FirestoreStore  # noqa: E402
from v1.core_agents.trend_discovery import discover_trends  # noqa: E402
from v1.models import Umbrella, SubQuery  # noqa: E402
from v1.tools.umbrella_mapper import map_interests_to_umbrellas_bulk  # noqa: E402


def _create_umbrella(store: FirestoreStore, display_name: str, umbrella_id: str) -> bool:
    try:
        queries = discover_trends(display_name)
        sub_queries = []
        for i, query_text in enumerate(queries):
            sub_query = SubQuery(
                id=f"{umbrella_id}-{i}",
                text=query_text,
                source_hint="blog",
                user_count=0,
                last_searched=None,
            )
            sub_queries.append(sub_query.model_dump())
        umbrella = Umbrella(
            id=umbrella_id,
            display_name=display_name,
            sub_queries=sub_queries,
            user_count=0,
            last_discovery_refresh=None,
        )
        store.create_umbrella(umbrella_id, umbrella.model_dump())
        return True
    except Exception as e:
        print(f"  Warning: Failed to create umbrella {umbrella_id}: {e}")
        return False


def backfill_user_mappings(
    subscribed_only: bool = False,
    limit: int | None = None,
) -> dict[str, Any]:
    store = FirestoreStore()
    profiles = store.get_all_user_profiles()

    if subscribed_only:
        profiles = [
            p for p in profiles
            if p.get("subscriptionStatus") in ["trial", "active"]
        ]

    if limit:
        profiles = profiles[:limit]

    total = len(profiles)
    print(
        f"Backfill starting: {total} users "
        f"({'subscribed only' if subscribed_only else 'all'})"
    )

    updated = 0
    skipped = 0
    created_umbrellas = 0

    for idx, profile in enumerate(profiles, start=1):
        uid = profile.get("uid")
        if not uid:
            continue

        print(f"[{idx}/{total}] User {uid}: mapping interests + hobbies...")

        interests = profile.get("interests", []) or []
        hobbies = profile.get("hobbies", []) or []
        combined = list({i for i in interests + hobbies if i})
        if not combined:
            print(f"[{idx}/{total}] User {uid}: no interests/hobbies, skip")
            skipped += 1
            continue

        print(
            f"[{idx}/{total}] User {uid}: {len(interests)} interests, "
            f"{len(hobbies)} hobbies"
        )
        mapping_result = map_interests_to_umbrellas_bulk(combined, store)
        interest_to_umbrella = mapping_result.get("mappings", {})
        umbrellas_to_create = mapping_result.get("umbrellas_to_create", [])

        is_subscribed = profile.get("subscriptionStatus") in ["trial", "active"]
        if is_subscribed:
            for new_umbrella in umbrellas_to_create:
                umbrella_id = new_umbrella["id"]
                if store.umbrella_exists(umbrella_id):
                    continue
                created = _create_umbrella(
                    store,
                    new_umbrella.get("display_name", umbrella_id),
                    umbrella_id,
                )
                if created:
                    created_umbrellas += 1
                    print(f"[{idx}/{total}] Created umbrella {umbrella_id}")

        interest_map = {
            i: interest_to_umbrella[i]
            for i in interests
            if i in interest_to_umbrella
        }
        hobby_map = {
            h: interest_to_umbrella[h]
            for h in hobbies
            if h in interest_to_umbrella
        }

        store.db.collection("user_profiles").document(uid).set({
            "interest_umbrella_map": interest_map,
            "hobby_umbrella_map": hobby_map,
            "umbrella_ids": list(set(interest_to_umbrella.values())),
            "updatedAt": datetime.utcnow().isoformat(),
        }, merge=True)
        updated += 1
        print(
            f"[{idx}/{total}] User {uid}: saved "
            f"{len(interest_map)} interests, {len(hobby_map)} hobbies"
        )

    return {
        "users_processed": len(profiles),
        "updated": updated,
        "skipped": skipped,
        "created_umbrellas": created_umbrellas,
    }


def main():
    parser = argparse.ArgumentParser(description="Backfill user umbrella mappings")
    parser.add_argument("--subscribed-only", action="store_true", help="Only subscribed users")
    parser.add_argument("--limit", type=int, default=None, help="Limit users processed")
    args = parser.parse_args()

    result = backfill_user_mappings(
        subscribed_only=args.subscribed_only,
        limit=args.limit,
    )
    print(result)


if __name__ == "__main__":
    main()

