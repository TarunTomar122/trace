"""
Map subscribed users to queries using interests + hobbies.

This feeds the algorithm pool harvester with the most subscribed queries.
"""
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

load_dotenv(Path(__file__).parent.parent.parent / ".env")

from v1.storage import FirestoreStore  # noqa: E402
from v1.models import Umbrella, SubQuery  # noqa: E402
from v1.core_agents.trend_discovery import discover_trends  # noqa: E402
from v1.tools.umbrella_mapper import map_interests_to_umbrellas  # noqa: E402


def _normalize_interest(interest: str) -> str:
    return (interest.lower().strip()
            .replace(" ", "-")
            .replace("&", "and")
            .replace("/", "-")
            .replace("\\", "-")
            .replace("(", "")
            .replace(")", ""))


def _create_umbrella(
    store: FirestoreStore,
    interest: str,
    umbrella_id: str,
) -> bool:
    try:
        queries = discover_trends(interest)
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
            display_name=interest.title(),
            sub_queries=sub_queries,
            user_count=0,
            last_discovery_refresh=None,
        )
        store.create_umbrella(umbrella_id, umbrella.model_dump())
        return True
    except Exception as e:
        print(f"  Warning: Failed to create umbrella for {interest}: {e}")
        return False


def map_users_to_queries() -> dict[str, Any]:
    store = FirestoreStore()

    profiles = store.get_all_user_profiles()
    subscribed_profiles = [
        p
        for p in profiles
        if p.get("subscriptionStatus") in ["trial", "active"]
    ]

    print(
        f"Found {len(subscribed_profiles)} subscribed users (trial + active)"
    )

    umbrellas = store.get_all_umbrellas()
    umbrella_map = {u["id"]: u for u in umbrellas}

    query_users: dict[str, set[str]] = defaultdict(set)
    umbrella_users: dict[str, set[str]] = defaultdict(set)

    users_mapped = 0
    users_skipped = 0

    for profile in subscribed_profiles:
        uid = profile.get("uid")
        if not uid:
            continue

        interests = profile.get("interests", []) or []
        hobbies = profile.get("hobbies", []) or []
        combined = list({i for i in interests + hobbies if i})
        if not combined:
            users_skipped += 1
            continue

        users_mapped += 1

        mapping_result = map_interests_to_umbrellas(combined, store)
        interest_to_umbrella = mapping_result["mappings"]
        umbrellas_to_create = mapping_result.get("umbrellas_to_create", [])

        interest_map = {i: interest_to_umbrella[i] for i in interests if i in interest_to_umbrella}
        hobby_map = {h: interest_to_umbrella[h] for h in hobbies if h in interest_to_umbrella}

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
                umbrella_map[umbrella_id] = (
                    store.get_umbrella(umbrella_id) or {"id": umbrella_id}
                )

        for interest, umbrella_id in interest_to_umbrella.items():
            if umbrella_id not in umbrella_map:
                print(
                    f"  Warning: No umbrella for '{interest}' → {umbrella_id} "
                    f"(user {uid})"
                )
                continue
            umbrella_users[umbrella_id].add(uid)

            for sub_query in umbrella_map[umbrella_id].get("sub_queries", []):
                query_id = sub_query.get("id")
                if query_id:
                    query_users[query_id].add(uid)

        store.db.collection("user_profiles").document(uid).set({
            "interest_umbrella_map": interest_map,
            "hobby_umbrella_map": hobby_map,
            "umbrella_ids": list(set(interest_to_umbrella.values())),
            "updatedAt": datetime.utcnow().isoformat(),
        }, merge=True)

    print(f"\nWriting {len(query_users)} query_users documents...")
    for query_id, users in query_users.items():
        umbrella_id = (
            query_id.rsplit("-", 1)[0] if "-" in query_id else query_id
        )
        query_text = ""
        if umbrella_id in umbrella_map:
            for sq in umbrella_map[umbrella_id].get("sub_queries", []):
                if sq.get("id") == query_id:
                    query_text = sq.get("text", "")
                    break
        for user_id in users:
            store.add_user_to_query(query_id, user_id, query_text, umbrella_id)

    print(f"Updating user counts for {len(umbrella_users)} umbrellas...")
    for umbrella_id, users in umbrella_users.items():
        store.update_umbrella(umbrella_id, {"user_count": len(users)})

    return {
        "users_mapped": users_mapped,
        "users_skipped": users_skipped,
        "queries_active": len(query_users),
        "umbrellas_active": len(umbrella_users),
        "total_users": len(profiles),
        "subscribed_users": len(subscribed_profiles),
    }


def main():
    map_users_to_queries()


if __name__ == "__main__":
    main()
