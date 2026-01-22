"""
Remove 'custom-' prefix from stored interests and mappings.
"""
import sys
from pathlib import Path
from typing import Any

project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env")

from v1.storage import FirestoreStore  # noqa: E402


def _strip_custom(value: str) -> str:
    return value.replace("custom-", "") if value.startswith("custom-") else value


def cleanup_custom_interests(limit: int | None = None) -> dict[str, Any]:
    store = FirestoreStore()
    profiles = store.get_all_user_profiles()
    if limit:
        profiles = profiles[:limit]

    updated = 0
    skipped = 0

    for profile in profiles:
        uid = profile.get("uid")
        if not uid:
            continue

        interests = profile.get("interests", []) or []
        interest_map = profile.get("interest_umbrella_map", {}) or {}

        cleaned_interests = [_strip_custom(i) for i in interests if i]
        cleaned_interests = list(dict.fromkeys(cleaned_interests))

        cleaned_map = {}
        for key, value in interest_map.items():
            cleaned_key = _strip_custom(key)
            cleaned_map[cleaned_key] = value

        if cleaned_interests == interests and cleaned_map == interest_map:
            skipped += 1
            continue

        store.db.collection("user_profiles").document(uid).set(
            {
                "interests": cleaned_interests,
                "interest_umbrella_map": cleaned_map,
            },
            merge=True,
        )
        updated += 1

    return {
        "users_processed": len(profiles),
        "updated": updated,
        "skipped": skipped,
    }


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Cleanup custom interest prefixes")
    parser.add_argument("--limit", type=int, default=None, help="Limit users processed")
    args = parser.parse_args()

    result = cleanup_custom_interests(limit=args.limit)
    print(result)


if __name__ == "__main__":
    main()

