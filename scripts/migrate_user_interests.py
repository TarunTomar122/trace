"""
Migrate user interests from the old taxonomy to the new one.

Old interests: ai, tech, startups, markets, engineering, product-design, marketing, fintech
New interests: ai, products, tech, startups, engineering, ux-design, markets, the-world

Migration map:
  ai            → ai
  tech          → tech
  startups      → startups
  markets       → markets
  engineering   → engineering
  product-design→ ux-design
  marketing     → startups
  fintech       → markets

Run:
  python -m scripts.migrate_user_interests --dry-run   # preview only
  python -m scripts.migrate_user_interests             # apply changes
"""
from __future__ import annotations

import argparse
from collections import Counter

import firebase_admin
from firebase_admin import credentials, firestore

INTEREST_MIGRATION: dict[str, str] = {
    "ai":             "ai",
    "tech":           "tech",
    "startups":       "startups",
    "markets":        "markets",
    "engineering":    "engineering",
    "product-design": "ux-design",
    "marketing":      "startups",
    "fintech":        "markets",
    # extra legacy aliases just in case
    "product_design": "ux-design",
    "design":         "ux-design",
    "experience":     "ux-design",
    "web3":           "markets",
    "climate":        "the-world",
    "health":         "the-world",
    "productivity":   "tech",
}

VALID_NEW_INTERESTS = {
    "ai", "products", "tech", "startups",
    "engineering", "ux-design", "markets", "the-world",
}


def migrate_interests(old: list) -> list[str]:
    """Map a list of old interest IDs to deduplicated new IDs."""
    seen: list[str] = []
    for raw in old:
        interest = str(raw).strip().lower()
        new = INTEREST_MIGRATION.get(interest, interest)
        # Keep it if it's a valid new interest and not already added
        if new in VALID_NEW_INTERESTS and new not in seen:
            seen.append(new)
    return seen


def main() -> None:
    parser = argparse.ArgumentParser(description="Migrate user interests taxonomy")
    parser.add_argument("--dry-run", action="store_true", help="Preview only, no writes")
    parser.add_argument("--batch-size", type=int, default=400, help="Firestore batch size")
    args = parser.parse_args()

    if not firebase_admin._apps:
        firebase_admin.initialize_app()

    db = firestore.client()
    users_ref = db.collection("user_profiles")

    stats: Counter = Counter()
    batch = db.batch()
    batch_count = 0

    print(f"{'[DRY RUN] ' if args.dry_run else ''}Scanning users...")

    for doc in users_ref.stream():
        data = doc.to_dict() or {}
        old_interests: list = data.get("interests") or []

        if not old_interests:
            stats["skipped_no_interests"] += 1
            continue

        new_interests = migrate_interests(old_interests)

        if set(new_interests) == set(str(i) for i in old_interests if str(i) in VALID_NEW_INTERESTS):
            stats["already_current"] += 1
            continue

        stats["to_migrate"] += 1
        print(f"  {doc.id[:12]}…  {old_interests} → {new_interests}")

        if not args.dry_run:
            batch.update(doc.reference, {"interests": new_interests})
            batch_count += 1

            if batch_count >= args.batch_size:
                batch.commit()
                batch = db.batch()
                batch_count = 0
                print(f"  Committed {args.batch_size} writes...")

    if not args.dry_run and batch_count > 0:
        batch.commit()
        print(f"  Committed final {batch_count} writes.")

    print("\nSummary:")
    for key, count in sorted(stats.items()):
        print(f"  {key}: {count}")

    if args.dry_run:
        print("\n(Dry run — no changes written. Remove --dry-run to apply.)")


if __name__ == "__main__":
    main()
