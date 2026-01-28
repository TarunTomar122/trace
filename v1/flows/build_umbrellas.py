"""
Build and maintain topic umbrellas for efficient news fetching.

Umbrellas are stable broad categories that group related topics.
Instead of fetching news for 100 topics, we fetch for ~12 umbrellas.

Usage:
    python v1/flows/build_umbrellas.py
    python v1/flows/build_umbrellas.py --dry-run
"""
import argparse
import json
import os
import sys
from pathlib import Path

project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env")

from collections import Counter
from google import genai
from v1.storage import FirestoreStore


# Stable umbrella definitions with short, specific Tavily queries
UMBRELLA_DEFINITIONS = [
    {
        "id": "ai-tech",
        "name": "AI & Machine Learning",
        "search_query": "AI artificial intelligence",
    },
    {
        "id": "web-dev",
        "name": "Web Development",
        "search_query": "web development",
    },
    {
        "id": "software-eng",
        "name": "Software Engineering",
        "search_query": "software engineering",
    },
    {
        "id": "design-ux",
        "name": "Design & UX",
        "search_query": "UX design",
    },
    {
        "id": "startups",
        "name": "Startups & Entrepreneurship",
        "search_query": "startups",
    },
    {
        "id": "finance",
        "name": "Finance & Investing",
        "search_query": "investing finance",
    },
    {
        "id": "product",
        "name": "Product Management",
        "search_query": "product management",
    },
    {
        "id": "fitness",
        "name": "Fitness & Sports",
        "search_query": "fitness",
    },
    {
        "id": "creative",
        "name": "Art & Photography",
        "search_query": "digital art",
    },
    {
        "id": "gaming",
        "name": "Gaming & Entertainment",
        "search_query": "gaming",
    },
    {
        "id": "music",
        "name": "Music",
        "search_query": "music",
    },
    {
        "id": "books",
        "name": "Books & Writing",
        "search_query": "books",
    },
    {
        "id": "science",
        "name": "Science & Learning",
        "search_query": "science",
    },
    {
        "id": "productivity",
        "name": "Productivity",
        "search_query": "productivity",
    },
    {
        "id": "marketing",
        "name": "Marketing",
        "search_query": "marketing",
    },
    {
        "id": "devops-cloud",
        "name": "DevOps & Cloud",
        "search_query": "cloud computing",
    },
    {
        "id": "career",
        "name": "Career & Jobs",
        "search_query": "career advice",
    },
    {
        "id": "health",
        "name": "Health & Wellness",
        "search_query": "health wellness",
    },
]


def get_popular_topics(store: FirestoreStore, min_users: int = 2) -> list[str]:
    """Get topics with at least min_users users."""
    users = store.db.collection("user_profiles").stream()
    topic_usage = Counter()

    for u in users:
        data = u.to_dict() or {}
        for i in (data.get("interests") or []):
            if isinstance(i, str) and i.strip():
                topic_usage[i.strip()] += 1
        for h in (data.get("hobbies") or []):
            if isinstance(h, str) and h.strip():
                topic_usage[h.strip()] += 1

    return [topic for topic, count in topic_usage.items() if count >= min_users]


def _map_topics_batch(topics: list[str], api_key: str) -> dict[str, str]:
    """
    Map a batch of topics to umbrella IDs.

    Returns:
        Dict of topic_name -> umbrella_id
    """
    umbrella_names = [f"{u['id']}: {u['name']}" for u in UMBRELLA_DEFINITIONS]

    prompt = f"""Map each topic to ONE umbrella ID.

UMBRELLAS:
{chr(10).join(umbrella_names)}

TOPICS:
{', '.join(topics)}

Return JSON object mapping topic to umbrella_id:
{{"AI": "ai-tech", "React": "web-dev", "Fitness": "fitness"}}

Return ONLY valid JSON."""

    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config={
            "temperature": 0.1,
            "max_output_tokens": 4000,
            "response_mime_type": "application/json",
        }
    )

    raw_text = response.text.strip()
    return json.loads(raw_text)


def map_topics_to_umbrellas(topics: list[str]) -> dict[str, list[str]]:
    """
    Use LLM to map topics to umbrella categories.

    Returns:
        Dict of umbrella_id -> list of topic names
    """
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        print("Warning: GEMINI_API_KEY not set")
        return {}

    # Process in batches of 30 to avoid truncation
    batch_size = 30
    all_mappings: dict[str, str] = {}

    for i in range(0, len(topics), batch_size):
        batch = topics[i:i + batch_size]
        print(f"  Processing batch {i // batch_size + 1} ({len(batch)} topics)...")

        try:
            batch_result = _map_topics_batch(batch, api_key)
            all_mappings.update(batch_result)
        except Exception as e:
            print(f"    Error in batch: {e}")

    # Invert: topic -> umbrella_id => umbrella_id -> [topics]
    result: dict[str, list[str]] = {}
    for topic, umbrella_id in all_mappings.items():
        if umbrella_id not in result:
            result[umbrella_id] = []
        result[umbrella_id].append(topic)

    return result


def build_umbrellas(dry_run: bool = False, min_users: int = 2) -> dict:
    """
    Build umbrella categories and map popular topics to them.

    Args:
        dry_run: If True, don't save to Firestore
        min_users: Minimum users for a topic to be included

    Returns:
        Summary dict
    """
    store = FirestoreStore()

    print("=" * 60)
    print("BUILD UMBRELLAS")
    print("=" * 60)
    if dry_run:
        print("DRY RUN - no changes will be made\n")

    # Get popular topics
    print(f"Fetching topics with {min_users}+ users...")
    topics = get_popular_topics(store, min_users)
    print(f"Found {len(topics)} topics\n")

    if not topics:
        print("No topics found!")
        return {"umbrellas": 0, "topics_mapped": 0}

    # Map topics to umbrellas using LLM
    print("Mapping topics to umbrellas using LLM...")
    topic_mapping = map_topics_to_umbrellas(topics)

    if not topic_mapping:
        print("Failed to map topics!")
        return {"umbrellas": 0, "topics_mapped": 0}

    # Build umbrella documents
    umbrellas_to_save = []
    total_mapped = 0

    for umbrella_def in UMBRELLA_DEFINITIONS:
        uid = umbrella_def["id"]
        mapped_topics = topic_mapping.get(uid, [])

        if mapped_topics:
            umbrella_doc = {
                "id": uid,
                "name": umbrella_def["name"],
                "search_query": umbrella_def["search_query"],
                "topic_names": mapped_topics,
                "topic_count": len(mapped_topics),
            }
            umbrellas_to_save.append(umbrella_doc)
            total_mapped += len(mapped_topics)

            print(f"\n{umbrella_def['name']} ({uid}):")
            print(f"  Query: \"{umbrella_def['search_query']}\"")
            print(f"  Topics ({len(mapped_topics)}): {', '.join(mapped_topics[:10])}")
            if len(mapped_topics) > 10:
                print(f"    ... and {len(mapped_topics) - 10} more")

    print(f"\n{'=' * 60}")
    print(f"Total: {len(umbrellas_to_save)} umbrellas with {total_mapped} topics")

    # Save to Firestore
    if not dry_run:
        print("\nSaving to Firestore...")
        for umbrella in umbrellas_to_save:
            store.db.collection("umbrellas").document(umbrella["id"]).set(umbrella)
            print(f"  Saved: {umbrella['id']}")
        print("Done!")

    return {
        "umbrellas": len(umbrellas_to_save),
        "topics_mapped": total_mapped,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Build umbrella categories for topic grouping"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Don't save to Firestore, just show what would be created",
    )
    parser.add_argument(
        "--min-users",
        type=int,
        default=2,
        help="Minimum users for a topic to be included (default: 2)",
    )

    args = parser.parse_args()
    build_umbrellas(dry_run=args.dry_run, min_users=args.min_users)


if __name__ == "__main__":
    main()
