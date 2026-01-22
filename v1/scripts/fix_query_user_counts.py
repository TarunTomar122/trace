"""
Fix query_users.user_count to match users array length.
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


def fix_query_user_counts(limit: int | None = None) -> dict[str, Any]:
    store = FirestoreStore()
    docs = list(store.db.collection("query_users").stream())
    if limit:
        docs = docs[:limit]

    updated = 0
    deleted = 0

    for doc in docs:
        data = doc.to_dict() or {}
        users = data.get("users", []) or []
        user_count = int(data.get("user_count", 0) or 0)
        actual_count = len(users)

        if actual_count == 0:
            doc.reference.delete()
            deleted += 1
            continue

        if user_count != actual_count:
            doc.reference.update({"user_count": actual_count})
            updated += 1

    return {
        "processed": len(docs),
        "updated": updated,
        "deleted": deleted,
    }


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Fix query_users user_count")
    parser.add_argument("--limit", type=int, default=None, help="Limit docs processed")
    args = parser.parse_args()

    result = fix_query_user_counts(limit=args.limit)
    print(result)


if __name__ == "__main__":
    main()

