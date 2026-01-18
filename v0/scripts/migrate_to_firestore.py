#!/usr/bin/env python3
import json
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent.parent))

from storage import FileStore, FirestoreStore, COLLECTIONS


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text())


def migrate_user(user_folder: Path, firestore_store: FirestoreStore) -> None:
    user_id = user_folder.name
    memory_dir = user_folder / "memory"
    feeds_dir = user_folder / "feeds"
    daily_dir = memory_dir / "daily"

    profile = load_json(memory_dir / "user_profile.json")
    if profile:
        firestore_store._doc(COLLECTIONS["user_profiles"], user_id).set(profile, merge=True)

    preferences = load_json(memory_dir / "preferences.json")
    if preferences:
        firestore_store._doc(COLLECTIONS["user_preferences"], user_id).set(preferences, merge=True)

    patterns = load_json(memory_dir / "patterns.json")
    if patterns:
        firestore_store._doc(COLLECTIONS["user_patterns"], user_id).set(patterns, merge=True)

    seen_urls = load_json(memory_dir / "seen_urls.json")
    if seen_urls:
        firestore_store._doc(COLLECTIONS["user_seen_urls"], user_id).set(
            {"urls": seen_urls}, merge=True
        )

    if feeds_dir.exists():
        for feed_file in feeds_dir.glob("*_feed.json"):
            date = feed_file.stem.replace("_feed", "")
            items = load_json(feed_file)
            firestore_store._doc(COLLECTIONS["user_feeds"], user_id).collection("daily").document(date).set(
                {"date": date, "items": items},
                merge=True,
            )

    if daily_dir.exists():
        for interactions_file in daily_dir.glob("*_interactions.json"):
            date = interactions_file.stem.replace("_interactions", "")
            items = load_json(interactions_file)
            firestore_store._doc(COLLECTIONS["user_interactions"], user_id).collection("daily").document(date).set(
                {"date": date, "items": items},
                merge=True,
            )
        for activity_file in daily_dir.glob("*_activity.json"):
            date = activity_file.stem.replace("_activity", "")
            items = load_json(activity_file)
            firestore_store._doc(COLLECTIONS["user_interactions"], user_id).collection("activity").document(date).set(
                {"date": date, "items": items},
                merge=True,
            )


def main() -> None:
    users_dir = Path("users")
    if not users_dir.exists():
        print("No users directory found.")
        return

    firestore_store = FirestoreStore()
    for user_folder in users_dir.iterdir():
        if not user_folder.is_dir():
            continue
        migrate_user(user_folder, firestore_store)
        print(f"Migrated user: {user_folder.name}")


if __name__ == "__main__":
    main()

