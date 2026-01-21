"""
AI-powered Umbrella Mapper - intelligently maps user interests to umbrellas.

Uses GPT to decide if an interest should map to an existing umbrella
or if a new umbrella should be created.

Usage:
    from v1.tools.umbrella_mapper import map_interest_to_umbrella

    result = map_interest_to_umbrella("UI/UX design", existing_umbrellas)
    # Returns: {"action": "use_existing", "umbrella_id": "ux-design"}
    # Or: {"action": "create_new", "umbrella_id": "new-topic",
    #      "display_name": "New Topic"}
"""
import json
import os
from typing import Any

from openai import OpenAI


def get_existing_umbrellas(store) -> list[dict]:
    """Get all existing umbrellas from Firestore."""
    umbrellas = store.get_all_umbrellas()
    return [
        {
            "id": u.get("id"),
            "display_name": u.get("display_name", u.get("id")),
        }
        for u in umbrellas
    ]


def map_interests_to_umbrellas_bulk(
    interests: list[str],
    store,
) -> dict[str, Any]:
    """
    Map multiple interests to umbrellas in a single LLM call.

    Returns:
        {
            "mappings": {interest: umbrella_id},
            "umbrellas_to_create": [{"id", "display_name", "reasoning"}]
        }
    """
    existing_umbrellas = get_existing_umbrellas(store)
    interest_list = [
        i for i in interests
        if isinstance(i, str) and i.strip()
    ]
    interest_list = list(dict.fromkeys(interest_list))

    if not interest_list:
        return {"mappings": {}, "umbrellas_to_create": []}

    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        # Deterministic fallback: match by substring or create normalized IDs
        mappings = {}
        umbrellas_to_create = []
        for interest in interest_list:
            interest_lower = interest.lower()
            matched = None
            for umb in existing_umbrellas:
                umb_id = (umb.get("id") or "").lower()
                umb_name = (umb.get("display_name") or "").lower()
                if umb_id and (
                    umb_id in interest_lower or interest_lower in umb_id
                ):
                    matched = umb.get("id")
                    break
                if umb_name and (
                    umb_name in interest_lower or interest_lower in umb_name
                ):
                    matched = umb.get("id")
                    break
            if matched:
                mappings[interest] = matched
            else:
                normalized = (
                    interest.lower()
                    .strip()
                    .replace(" ", "-")
                    .replace("&", "and")
                )
                mappings[interest] = normalized
                umbrellas_to_create.append(
                    {
                        "id": normalized,
                        "display_name": interest.title(),
                        "reasoning": "Fallback (no OpenAI key)",
                    }
                )
        return {
            "mappings": mappings,
            "umbrellas_to_create": umbrellas_to_create,
        }

    client = OpenAI(api_key=api_key)
    umbrella_list = "\n".join(
        [f"- {u['id']} ({u['display_name']})" for u in existing_umbrellas]
    )
    interest_lines = "\n".join([f"- {i}" for i in interest_list])

    prompt = f"""You map interests to existing umbrellas or create new ones.

Existing umbrellas:
{umbrella_list}

Interests to map:
{interest_lines}

Rules:
1) Prefer existing umbrellas if it is same topic, synonym, or subset.
2) Only create new umbrellas if no good match exists.
3) Use simple, slug-like umbrella_id for new umbrellas.

Return JSON array with one object per interest:
{{
  "interest": "...",
  "action": "use_existing" or "create_new",
  "umbrella_id": "...",
  "display_name": "..." (only for create_new),
  "confidence": 0.0-1.0,
  "reasoning": "short"
}}

Only JSON, no markdown."""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=800,
        )
        result_text = response.choices[0].message.content.strip()
        if result_text.startswith("```"):
            lines = result_text.split("\n")
            result_text = "\n".join(lines[1:-1])
        result = json.loads(result_text)
    except Exception as e:
        print(f"  Warning: Bulk mapping error: {e}")
        return {
            "mappings": {},
            "umbrellas_to_create": [],
        }

    mappings: dict[str, str] = {}
    umbrellas_to_create: list[dict[str, str]] = []
    for item in result if isinstance(result, list) else []:
        interest = item.get("interest")
        umbrella_id = item.get("umbrella_id")
        if not interest or not umbrella_id:
            continue
        mappings[interest] = umbrella_id
        if item.get("action") == "create_new":
            umbrellas_to_create.append(
                {
                    "id": umbrella_id,
                    "display_name": item.get("display_name", interest.title()),
                    "reasoning": item.get("reasoning", ""),
                }
            )

    return {
        "mappings": mappings,
        "umbrellas_to_create": umbrellas_to_create,
    }


def map_interest_to_umbrella(
    interest: str,
    existing_umbrellas: list[dict],
) -> dict:
    """
    Use AI to map an interest to an existing umbrella or suggest a new one.

    Args:
        interest: The user's interest (e.g., "UI/UX design",
                 "machine learning")
        existing_umbrellas: List of existing umbrellas with id and display_name

    Returns:
        {
            "action": "use_existing" | "create_new",
            "umbrella_id": str,
            "display_name": str (only for create_new),
            "confidence": float,
            "reasoning": str
        }
    """
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    # Format existing umbrellas for the prompt
    umbrella_list = "\n".join(
        [f"- {u['id']} ({u['display_name']})" for u in existing_umbrellas]
    )

    prompt = (
        "You are helping map user interests to content categories\n"
        "(umbrellas).\n"
        f"\nUser's interest: \"{interest}\"\n"
        "\nExisting umbrellas:\n"
        f"{umbrella_list}\n"
        "\nYour task:\n"
        "1. If this interest clearly matches an existing umbrella\n"
        "   (same topic, synonym, subset), use that umbrella\n"
        "2. If no good match exists, suggest creating a new umbrella\n"
        "\nConsider these mappings:\n"
        "- \"UI/UX\", \"uiux\", \"user experience\", \"ux design\" → same\n"
        "  umbrella\n"
        "- \"AI\", \"artificial intelligence\", \"machine learning\",\n"
        "  \"ML\" → could be same umbrella\n"
        "- \"React performance\", \"frontend performance\" → could be same\n"
        "  umbrella\n"
        "- But \"cooking\" and \"software engineering\" → definitely\n"
        "  different umbrellas\n"
        "\nReturn JSON:\n"
        "{\n"
        "    \"action\": \"use_existing\" or \"create_new\",\n"
        "    \"umbrella_id\": \"the-umbrella-id\",\n"
        "    \"display_name\": \"Display Name\" (only if creating new),\n"
        "    \"confidence\": 0.0-1.0,\n"
        "    \"reasoning\": \"brief explanation\"\n"
        "}\n"
        "\nOnly JSON, no markdown."
    )

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=200
        )

        result_text = response.choices[0].message.content.strip()

        # Parse JSON
        if result_text.startswith("```"):
            lines = result_text.split("\n")
            result_text = "\n".join(lines[1:-1])

        result = json.loads(result_text)
        return result

    except Exception as e:
        # Fallback: create new umbrella with normalized ID
        normalized = (
            interest.lower()
            .strip()
            .replace(" ", "-")
            .replace("&", "and")
        )
        return {
            "action": "create_new",
            "umbrella_id": normalized,
            "display_name": interest.title(),
            "confidence": 0.5,
            "reasoning": f"Fallback due to error: {e}",
        }


def map_interests_to_umbrellas(interests: list[str], store) -> dict[str, str]:
    """
    Map multiple interests to umbrellas.

    Args:
        interests: List of user interests
        store: FirestoreStore instance

    Returns:
        Dict mapping each interest to an umbrella_id
    """
    existing_umbrellas = get_existing_umbrellas(store)

    mappings = {}
    umbrellas_to_create = []

    for interest in interests:
        result = map_interest_to_umbrella(interest, existing_umbrellas)
        umbrella_id = result["umbrella_id"]
        mappings[interest] = umbrella_id

        if result["action"] == "create_new":
            display_name = result.get("display_name", interest.title())
            umbrellas_to_create.append(
                {
                    "id": umbrella_id,
                    "display_name": display_name,
                    "reasoning": result.get("reasoning", ""),
                }
            )
            # Add to existing list so subsequent interests can match to it
            existing_umbrellas.append(
                {
                    "id": umbrella_id,
                    "display_name": display_name,
                }
            )

        print(
            f"  {interest} → {umbrella_id} ({result['action']}, "
            f"confidence: {result.get('confidence', 'N/A')})"
        )

    return {
        "mappings": mappings,
        "umbrellas_to_create": umbrellas_to_create,
    }


if __name__ == "__main__":
    # Test the mapper
    import sys
    from pathlib import Path

    project_root = str(Path(__file__).parent.parent.parent)
    if project_root not in sys.path:
        sys.path.append(project_root)

    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent.parent / ".env")

    from v1.storage import FirestoreStore

    store = FirestoreStore()

    test_interests = [
        "UI/UX design",
        "uiux",
        "machine learning",
        "AI",
        "fitness",
        "mental health",
        "React performance",
    ]

    print("Testing umbrella mapper:\n")
    result = map_interests_to_umbrellas(test_interests, store)

    print("\nMappings:")
    for interest, umbrella_id in result["mappings"].items():
        print(f"  {interest} → {umbrella_id}")

    print(f"\nNew umbrellas to create: {len(result['umbrellas_to_create'])}")
    for u in result["umbrellas_to_create"]:
        print(f"  - {u['id']}: {u['reasoning']}")
