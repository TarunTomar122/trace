"""
Unmap a user's interests/hobbies from query_users and umbrella counts.
"""
import argparse
import sys
from pathlib import Path
from typing import Any

project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env")

from v1.storage import FirestoreStore  # noqa: E402
from v1.tools.umbrella_mapper import map_interests_to_umbrellas  # noqa: E402


def _clean_query_users(store: FirestoreStore, query_id: str) -> None:
    doc_ref = store.db.collection("query_users").document(query_id)
    doc = doc_ref.get()
    if not doc.exists:
        return
    data = doc.to_dict() or {}
    user_count = int(data.get("user_count", 0) or 0)
    users = data.get("users", []) or []
    if user_count <= 0 or len(users) == 0:
        doc_ref.delete()


def _resolve_existing_umbrellas(
    store: FirestoreStore,
    interests: list[str],
    hobbies: list[str],
) -> dict[str, str]:
    combined = list({i for i in interests + hobbies if i})
    if not combined:
        return {}
    mapping_result = map_interests_to_umbrellas(combined, store)
    mappings = mapping_result.get("mappings", {})
    existing = {}
    for interest, umbrella_id in mappings.items():
        if store.umbrella_exists(umbrella_id):
            existing[interest] = umbrella_id
    return existing


def unmap_user(user_id: str) -> dict[str, Any]:
    store = FirestoreStore()
    profile = store.get_user_profile(user_id)
    if not profile:
        print(f"User {user_id} not found")
        return {"error": "User not found"}

    status = profile.get("subscriptionStatus", "none")
    if status in ["trial", "active"]:
        print(f"User {user_id} is still subscribed ({status}); skipping unmap")
        return {"skipped": True, "reason": "still subscribed"}

    interests = profile.get("interests", []) or []
    hobbies = profile.get("hobbies", []) or []
    interest_to_umbrella = _resolve_existing_umbrellas(store, interests, hobbies)
    umbrella_ids = set(interest_to_umbrella.values())

    removed_queries = 0
    updated_umbrellas = 0
    deleted_umbrellas = 0

    for umbrella_id in umbrella_ids:
        umbrella = store.get_umbrella(umbrella_id)
        if not umbrella:
            continue

        sub_queries = umbrella.get("sub_queries", []) or []
        for sub_query in sub_queries:
            query_id = sub_query.get("id")
            if not query_id:
                continue
            store.remove_user_from_query(query_id, user_id)
            _clean_query_users(store, query_id)
            removed_queries += 1

        current_count = int(umbrella.get("user_count", 0) or 0)
        new_count = max(0, current_count - 1)
        if new_count == 0:
            store.db.collection("umbrellas").document(umbrella_id).delete()
            deleted_umbrellas += 1
        else:
            store.update_umbrella(umbrella_id, {"user_count": new_count})
            updated_umbrellas += 1

    return {
        "user_id": user_id,
        "umbrella_count": len(umbrella_ids),
        "removed_queries": removed_queries,
        "updated_umbrellas": updated_umbrellas,
        "deleted_umbrellas": deleted_umbrellas,
    }


def main():
    parser = argparse.ArgumentParser(description="Unmap a user on unsubscribe")
    parser.add_argument("--user_id", required=True, help="User ID to unmap")
    args = parser.parse_args()

    result = unmap_user(args.user_id)
    print(result)


if __name__ == "__main__":
    main()

