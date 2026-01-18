#!/usr/bin/env python3
"""
Runnable entry point for query_generator_agent.
Fetches user data from Firestore and prints generated queries.
"""

from __future__ import annotations

import asyncio
import json
import os
from datetime import datetime

from dotenv import load_dotenv

from agents import Runner

from context import TraceContext
from query_generator_agent import query_generator_agent
from storage import COLLECTIONS, FirestoreStore


load_dotenv()


def _extract_json_array(text: str) -> str | None:
    start = text.find("[")
    end = text.rfind("]")
    if start == -1 or end == -1 or end <= start:
        return None
    return text[start : end + 1]


def _ensure_list_json(value: object) -> list[object]:
    if isinstance(value, list):
        return value
    if value is None:
        raise ValueError("Expected a JSON array but got empty output")
    if not isinstance(value, str):
        value = str(value)
    if not value.strip():
        raise ValueError("Expected a JSON array but got empty output")
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        extracted = _extract_json_array(value)
        if extracted is None:
            raise
        parsed = json.loads(extracted)
    if not isinstance(parsed, list):
        raise ValueError("Expected a JSON array")
    return parsed


def _get_final_text(result: object) -> str:
    final_output = getattr(result, "final_output", None)
    if isinstance(final_output, str):
        return final_output
    if final_output is not None:
        try:
            return json.dumps(final_output)
        except Exception:
            return str(final_output)
    for resp in reversed(getattr(result, "raw_responses", []) or []):
        output_text = getattr(resp, "output_text", None)
        if output_text:
            return output_text
        output_items = getattr(resp, "output", None) or []
        parts: list[str] = []
        for item in output_items:
            content = getattr(item, "content", None) or []
            for c in content:
                text = getattr(c, "text", None)
                if text:
                    parts.append(text)
        if parts:
            return "\n".join(parts)
    return ""


def _extract_tool_queries(result: object) -> list[dict[str, object]] | None:
    for item in getattr(result, "new_items", []) or []:
        item_type = getattr(item, "type", None)
        if item_type != "function_call":
            continue
        fn = getattr(item, "function", None)
        name = getattr(fn, "name", None) or getattr(item, "name", None)
        if name != "generate_queries":
            continue
        args = getattr(fn, "arguments", None) or getattr(item, "arguments", None)
        if not args:
            continue
        try:
            payload = json.loads(args)
        except json.JSONDecodeError:
            continue
        queries = payload.get("queries")
        if isinstance(queries, list):
            return [q for q in queries if isinstance(q, dict)]
    for resp in getattr(result, "raw_responses", []) or []:
        tool_calls = getattr(resp, "tool_calls", None)
        if not tool_calls:
            continue
        for call in tool_calls:
            fn = getattr(call, "function", None)
            name = getattr(fn, "name", None)
            if name != "generate_queries":
                continue
            args = getattr(fn, "arguments", None)
            if not args:
                continue
            try:
                payload = json.loads(args)
            except json.JSONDecodeError:
                continue
            queries = payload.get("queries")
            if isinstance(queries, list):
                return [q for q in queries if isinstance(q, dict)]
    return None


def _normalize_queries(items: list[object]) -> list[dict[str, object]]:
    normalized: list[dict[str, object]] = []
    for item in items:
        if isinstance(item, str):
            normalized.append({"text": item, "category": "exploit"})
            continue
        if isinstance(item, dict):
            text = item.get("text") or item.get("query")
            category = item.get("category")
            if not text or not category:
                continue
            normalized.append(
                {
                    "text": text,
                    "category": category,
                    "source_hint": item.get("source_hint"),
                }
            )
    return normalized


def _list_onboarded_users(store: FirestoreStore) -> list[str]:
    docs = store.db.collection(COLLECTIONS["user_profiles"]).stream()
    onboarded = []
    for doc in docs:
        data = doc.to_dict() or {}
        if data.get("onboarded"):
            onboarded.append(doc.id)
    return onboarded


async def generate_queries(user_id: str) -> list[str]:
    if not os.getenv("OPENAI_API_KEY"):
        raise RuntimeError("OPENAI_API_KEY is not set")

    store = FirestoreStore()
    date = datetime.now().strftime("%Y-%m-%d")

    profile = store.read_user_profile(user_id)
    preferences = store.read_memory(user_id, "preferences.json")
    patterns = store.read_memory(user_id, "patterns.json")
    print(
        "[query_generator] Loaded user data: "
        f"profile_bytes={len(profile)}, "
        f"preferences_bytes={len(preferences)}, "
        f"patterns_bytes={len(patterns)}"
    )

    input_text = (
        f"Today's date is {date}.\n\n"
        "You are generating search queries for a single user.\n\n"
        "USER_PROFILE (json):\n"
        f"{profile}\n\n"
        "PREFERENCES (json):\n"
        f"{preferences}\n\n"
        "PATTERNS (json):\n"
        f"{patterns}\n\n"
        "Return ONLY a tool call to generate_queries."
    )

    context = TraceContext(
        user_folder="users/remote",
        user_id=user_id,
        date=date,
    )

    runner = Runner()
    print("[query_generator] Running query_generator_agent...")
    result = await runner.run(
        starting_agent=query_generator_agent,
        context=context,
        input=input_text,
        max_turns=5,
    )

    raw_responses = getattr(result, "raw_responses", []) or []
    new_items = getattr(result, "new_items", []) or []
    print(
        "[query_generator] Debug: "
        f"raw_responses={len(raw_responses)}, new_items={len(new_items)}"
    )

    tool_queries = _extract_tool_queries(result)
    if tool_queries is not None:
        normalized = _normalize_queries(tool_queries)
        print(json.dumps(normalized, indent=2))
        return normalized

    output_text = _get_final_text(result)
    print(
        "[query_generator] Raw output: "
        f"chars={len(output_text)}, preview={output_text[:300]!r}"
    )
    raw_items = _ensure_list_json(output_text)
    normalized = _normalize_queries(raw_items)
    print(json.dumps(normalized, indent=2))
    return normalized


async def run_all_onboarded() -> None:
    store = FirestoreStore()
    user_ids = _list_onboarded_users(store)
    for uid in user_ids:
        print(f"\n=== Queries for user_id={uid} ===")
        try:
            await generate_queries(uid)
        except Exception as exc:
            print(f"[query_generator] ERROR for user_id={uid}: {exc}")


if __name__ == "__main__":
    import sys

    if len(sys.argv) >= 2:
        asyncio.run(generate_queries(sys.argv[1]))
    else:
        asyncio.run(run_all_onboarded())

