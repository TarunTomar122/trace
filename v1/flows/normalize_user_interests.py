"""
Normalize user interests using LLM semantic matching.

Takes raw user interests and maps them to existing topics or creates
canonical topic names. Prevents duplicate topics like "UI/UX" vs
"User Experience" vs "UX Design".

Usage:
    from v1.flows.normalize_user_interests import normalize_user_interests

    normalized = normalize_user_interests(
        interests=["UI/UX", "interaction design"],
        hobbies=["running marathons"],
        store=store,
    )
"""
import json
import os
import sys
from pathlib import Path
from typing import Any

project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env")

from google import genai
from v1.storage import FirestoreStore


def get_existing_topics(store: FirestoreStore) -> list[dict[str, str]]:
    """Fetch all existing topics from Firestore."""
    docs = store.db.collection("topics").stream()
    topics = []
    for doc in docs:
        data = doc.to_dict() or {}
        topic_id = doc.id
        display_name = data.get("display_name", topic_id)
        topic_kind = data.get("topic_kind", "interest")
        topics.append({
            "topic_id": topic_id,
            "display_name": display_name,
            "topic_kind": topic_kind,
        })
    return topics


def _normalize_topic_id(name: str) -> str:
    """Basic string normalization for topic IDs."""
    return (
        name.lower()
        .strip()
        .replace(" ", "-")
        .replace("&", "and")
        .replace("/", "-")
        .replace("\\", "-")
        .replace("(", "")
        .replace(")", "")
        .replace(".", "")
        .replace(",", "")
        .replace("'", "")
        .replace('"', "")
    )


def _normalize_with_llm(
    user_inputs: list[str],
    existing_topics: list[dict[str, str]],
    input_type: str,
) -> list[dict[str, str]]:
    """
    Use Gemini to normalize user inputs against existing topics.

    Args:
        user_inputs: Raw user interest/hobby strings
        existing_topics: List of existing topic dicts with topic_id and display_name
        input_type: "interest" or "hobby" for context

    Returns:
        List of dicts with original, normalized_id, display_name, is_new
    """
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        # Fallback to basic normalization
        print("  Warning: GEMINI_API_KEY not set, using basic normalization")
        return [
            {
                "original": inp,
                "normalized_id": _normalize_topic_id(inp),
                "display_name": inp.strip(),
                "is_new": True,
            }
            for inp in user_inputs
        ]

    # Build existing topics list for prompt
    if existing_topics:
        topics_list = "\n".join([
            f"- {t['topic_id']} (\"{t['display_name']}\")"
            for t in existing_topics[:200]  # Limit to avoid token overflow
        ])
    else:
        topics_list = "(no existing topics)"

    user_inputs_list = "\n".join([f"- \"{inp}\"" for inp in user_inputs])

    prompt = f"""Normalize these user {input_type}s against existing topics.

EXISTING TOPICS: {', '.join([t['topic_id'] for t in existing_topics])}

USER INPUTS: {', '.join(user_inputs)}

RULES:
1. Match to existing topic if SAME concept (e.g. "User Experience" → "ux-design", "travelling" → "travel", "Technology" → "technology")
2. Keep DISTINCT if different (e.g. "AI agents" != "AI", "music production" != "music")
3. Clean garbage inputs (e.g. "i am a ux designer" → "ux-design")
4. Use lowercase-hyphenated topic_ids, Title Case display_names
5. PREFER matching existing topics over creating new ones when possible

Return JSON array:
[{{"original":"input","normalized_id":"topic-id","display_name":"Topic Name","is_new":false,"matched_existing":"matched-id"}}]

If is_new=true, omit matched_existing. Return ONLY valid JSON."""

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config={
                "temperature": 0.1,
                "max_output_tokens": 2000,
                "response_mime_type": "application/json",
            }
        )

        raw_text = response.text.strip()

        # Try to parse JSON, handle common issues
        try:
            result = json.loads(raw_text)
        except json.JSONDecodeError:
            # Try to extract JSON array from response
            import re
            match = re.search(r'\[.*\]', raw_text, re.DOTALL)
            if match:
                result = json.loads(match.group())
            else:
                raise

        if isinstance(result, list):
            return result

    except Exception as e:
        print(f"  Warning: LLM normalization failed: {e}")

    # Fallback: basic normalization WITH existing topic matching
    existing_ids = {t["topic_id"]: t for t in existing_topics}
    fallback_results = []
    for inp in user_inputs:
        normalized_id = _normalize_topic_id(inp)
        # Check if this matches an existing topic
        if normalized_id in existing_ids:
            fallback_results.append({
                "original": inp,
                "normalized_id": normalized_id,
                "display_name": existing_ids[normalized_id].get("display_name", inp.strip()),
                "is_new": False,
                "matched_existing": normalized_id,
            })
        else:
            fallback_results.append({
                "original": inp,
                "normalized_id": normalized_id,
                "display_name": inp.strip().title(),
                "is_new": True,
            })
    return fallback_results


def normalize_user_interests(
    interests: list[str],
    hobbies: list[str],
    store: FirestoreStore | None = None,
    existing_topics: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    """
    Normalize user interests and hobbies using LLM semantic matching.

    Args:
        interests: Raw interest strings from user
        hobbies: Raw hobby strings from user
        store: FirestoreStore instance (created if not provided)
        existing_topics: Pre-fetched topics list (fetched if not provided)

    Returns:
        Dict with:
        - interests: list of normalized interest strings (display names)
        - hobbies: list of normalized hobby strings (display names)
        - interest_mappings: list of mapping dicts for interests
        - hobby_mappings: list of mapping dicts for hobbies
        - topics_matched: count of inputs matched to existing topics
        - topics_new: count of new topics that will be created
    """
    if store is None:
        store = FirestoreStore()

    # Clean inputs
    interests = [i.strip() for i in interests if isinstance(i, str) and i.strip()]
    hobbies = [h.strip() for h in hobbies if isinstance(h, str) and h.strip()]

    if not interests and not hobbies:
        return {
            "interests": [],
            "hobbies": [],
            "interest_mappings": [],
            "hobby_mappings": [],
            "topics_matched": 0,
            "topics_new": 0,
        }

    print(f"Normalizing {len(interests)} interests and {len(hobbies)} hobbies...")

    # Fetch existing topics only if not provided
    if existing_topics is None:
        existing_topics = get_existing_topics(store)
        print(f"  Fetched {len(existing_topics)} existing topics")

    # Normalize interests
    interest_mappings = []
    if interests:
        print("  Normalizing interests...")
        interest_mappings = _normalize_with_llm(interests, existing_topics, "interest")
        for m in interest_mappings:
            status = "→ MATCHED" if not m.get("is_new") else "→ NEW"
            matched = m.get("matched_existing", "")
            if matched:
                status += f" ({matched})"
            print(f"    \"{m['original']}\" {status} \"{m['normalized_id']}\"")

    # Normalize hobbies
    hobby_mappings = []
    if hobbies:
        print("  Normalizing hobbies...")
        hobby_mappings = _normalize_with_llm(hobbies, existing_topics, "hobby")
        for m in hobby_mappings:
            status = "→ MATCHED" if not m.get("is_new") else "→ NEW"
            matched = m.get("matched_existing", "")
            if matched:
                status += f" ({matched})"
            print(f"    \"{m['original']}\" {status} \"{m['normalized_id']}\"")

    # Dedupe by normalized_id (in case LLM mapped multiple inputs to same topic)
    seen_interest_ids = set()
    deduped_interests = []
    for m in interest_mappings:
        nid = m.get("normalized_id")
        if nid and nid not in seen_interest_ids:
            seen_interest_ids.add(nid)
            deduped_interests.append(m.get("display_name", nid))

    seen_hobby_ids = set()
    deduped_hobbies = []
    for m in hobby_mappings:
        nid = m.get("normalized_id")
        if nid and nid not in seen_hobby_ids:
            seen_hobby_ids.add(nid)
            deduped_hobbies.append(m.get("display_name", nid))

    topics_matched = sum(
        1 for m in interest_mappings + hobby_mappings
        if not m.get("is_new")
    )
    topics_new = sum(
        1 for m in interest_mappings + hobby_mappings
        if m.get("is_new")
    )

    print(f"  Result: {topics_matched} matched existing, {topics_new} new")

    return {
        "interests": deduped_interests,
        "hobbies": deduped_hobbies,
        "interest_mappings": interest_mappings,
        "hobby_mappings": hobby_mappings,
        "topics_matched": topics_matched,
        "topics_new": topics_new,
    }


def update_user_profile_interests(
    user_id: str,
    normalized_interests: list[str],
    normalized_hobbies: list[str],
    store: FirestoreStore | None = None,
) -> None:
    """
    Update user profile with normalized interests and hobbies.

    Args:
        user_id: User ID to update
        normalized_interests: List of normalized interest display names
        normalized_hobbies: List of normalized hobby display names
        store: FirestoreStore instance
    """
    if store is None:
        store = FirestoreStore()

    doc_ref = store.db.collection("user_profiles").document(user_id)
    doc_ref.update({
        "interests": normalized_interests,
        "hobbies": normalized_hobbies,
    })
    print(f"  Updated profile for {user_id}")


if __name__ == "__main__":
    # Test with some examples
    test_interests = [
        "UI/UX",
        "interaction design",
        "i am a product manager by profession",
        "React performance",
        "react performance and optimisation",
    ]
    test_hobbies = [
        "running marathons",
        "long distance running",
    ]

    result = normalize_user_interests(test_interests, test_hobbies)
    print("\nFinal normalized interests:", result["interests"])
    print("Final normalized hobbies:", result["hobbies"])
