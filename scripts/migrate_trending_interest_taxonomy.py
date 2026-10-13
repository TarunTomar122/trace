#!/usr/bin/env python3
"""
Migrate existing user interest profiles to the 2026 trending taxonomy.

New canonical interest ids:
  ai, tech, startups, markets, engineering, product-design, marketing, fintech
"""

from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
# The pipeline packages (v1/v2/v3) live in backend/.
for path in (REPO_ROOT / "backend", REPO_ROOT):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

from v3.lib.store import V3Store

INTEREST_MAP = {
    "technology": "tech",
    "business-market": "markets",
    "business": "markets",
    "experience": "product-design",
    "design": "product-design",
    "leadership": "markets",
    "productivity": "tech",
    "health": "tech",
    "web3": "fintech",
    "climate": "tech",
    "ai": "ai",
    "tech": "tech",
    "startups": "startups",
    "markets": "markets",
    "engineering": "engineering",
    "product-design": "product-design",
    "marketing": "marketing",
    "fintech": "fintech",
}


def normalize_interest(value: str) -> str:
    return INTEREST_MAP.get(str(value or "").strip().lower(), str(value or "").strip().lower())


def normalize_interests(values: list[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for value in values:
        normalized = normalize_interest(value)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        out.append(normalized)
    return out

def main() -> None:
    store = V3Store()
    print("Loading onboarded user profiles...", flush=True)
    interest_counter: Counter[str] = Counter()
    profiles_to_update: list[tuple[str, list[str], list[str]]] = []
    processed = 0

    docs = store.db.collection("user_profiles").where("onboarded", "==", True).stream()
    for doc in docs:
        processed += 1
        data = doc.to_dict() or {}
        interests = data.get("interests")
        if isinstance(interests, list):
            normalized = normalize_interests([str(item) for item in interests])
            if normalized != interests:
                profiles_to_update.append((doc.id, interests, normalized))
            interest_counter.update(normalized)
        if processed % 25 == 0:
            print(f"Processed {processed}", flush=True)

    print(f"Loaded {processed} onboarded profiles, updating {len(profiles_to_update)}", flush=True)

    updated_profiles = 0
    for idx, (uid, _old, normalized) in enumerate(profiles_to_update, start=1):
        store.db.collection("user_profiles").document(uid).set(
            {
                "interests": normalized,
                "updatedAt": datetime.now(timezone.utc).isoformat(),
            },
            merge=True,
        )
        updated_profiles += 1
        if idx % 25 == 0:
            print(f"Updated {idx}/{len(profiles_to_update)}", flush=True)

    print(
        {
            "processed_profiles": processed,
            "updated_profiles": updated_profiles,
            "interest_counts": dict(interest_counter),
        }
    )


if __name__ == "__main__":
    main()
