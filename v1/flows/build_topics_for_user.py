"""
Build topic pools for a single subscribed user using Exa.

For each interest (capped), runs two Exa searches:
- "blogs about <interest>"
- "discussions about <interest>"

Stores results in Firestore collection "topics":
topics/{topic_id} -> generations[date_key] and latest with
blogs/discussions URLs.

Usage:
  python v1/flows/build_topics_for_user.py --user_id USER_ID
"""

import argparse
import json
import os
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable

project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from dotenv import load_dotenv  # noqa: E402

load_dotenv(Path(__file__).parent.parent.parent / ".env")

from v1.storage import FirestoreStore  # noqa: E402
from v1.tools.youtube_search import youtube_search  # noqa: E402
from openai import OpenAI  # noqa: E402

try:
    from exa_py import Exa
except Exception as exc:  # pragma: no cover - runtime import guard
    raise ImportError(
        "exa_py is required. Install exa_py and set EXA_API_KEY."
    ) from exc


MAX_INTERESTS_DEFAULT = 8
MAX_HOBBIES_DEFAULT = 3
RESULTS_PER_SEARCH = 10
LOOKBACK_DAYS_DEFAULT = 60
VIDEO_LOOKBACK_DAYS = 60
MIN_REFRESH_DAYS_DEFAULT = 5


def _normalize_interest(interest: str) -> str:
    return (
        interest.lower()
        .strip()
        .replace(" ", "-")
        .replace("&", "and")
        .replace("/", "-")
        .replace("\\", "-")
        .replace("(", "")
        .replace(")", "")
    )


def _dedupe_preserve_order(items: Iterable[str]) -> list[str]:
    seen = set()
    deduped = []
    for item in items:
        if item and item not in seen:
            seen.add(item)
            deduped.append(item)
    return deduped


def _iso_z(dt: datetime) -> str:
    return (
        dt.astimezone(timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


def _parse_iso_z(value: str) -> datetime | None:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None


def _should_refresh_topic(topic_doc: dict, min_days: int) -> bool:
    if not topic_doc:
        return True
    latest = topic_doc.get("latest") if isinstance(topic_doc, dict) else None
    updated_at = None
    if isinstance(latest, dict):
        updated_at = latest.get("generated_at") or latest.get("updated_at")
    updated_at = updated_at or topic_doc.get("updated_at")
    parsed = _parse_iso_z(updated_at) if isinstance(updated_at, str) else None
    if not parsed:
        return True
    return datetime.now(timezone.utc) - parsed >= timedelta(days=min_days)


def _extract_items(results) -> list[dict]:
    items = []
    for r in results or []:
        if hasattr(r, "url"):
            url = getattr(r, "url", None)
            title = getattr(r, "title", None)
        elif isinstance(r, dict):
            url = r.get("url")
            title = r.get("title")
        else:
            url = None
            title = None
        if url:
            items.append(
                {
                    "url": url,
                    "title": title or "",
                }
            )
    deduped_urls = set()
    deduped = []
    for item in items:
        url = item.get("url")
        if url and url not in deduped_urls:
            deduped_urls.add(url)
            deduped.append(item)
    return deduped


def _search_exa(
    exa: Exa,
    query: str,
    start_date: str,
    end_date: str,
) -> list[dict]:
    response = exa.search(
        query,
        num_results=RESULTS_PER_SEARCH,
        start_published_date=start_date,
        end_published_date=end_date,
        type="auto",
        exclude_text=["docs"],
    )
    results = getattr(response, "results", response)
    return _extract_items(results)[:RESULTS_PER_SEARCH]


def _generate_topic_queries(interest: str, user_profile: dict) -> list[str]:
    context_lines = []
    for key in ["role", "company", "goals", "learningStyle", "contentDepth"]:
        value = user_profile.get(key)
        if value:
            context_lines.append(f"{key}: {value}")
    interests = user_profile.get("interests", []) or []
    hobbies = user_profile.get("hobbies", []) or []
    if interests:
        context_lines.append(f"interests: {', '.join(interests[:12])}")
    if hobbies:
        context_lines.append(f"hobbies: {', '.join(hobbies[:12])}")
    context_block = "\n".join(context_lines)

    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY", "").strip())
    print(f"  Generating topic queries for: {interest}")
    prompt = (
        "Generate 5 concise, specific search queries for this interest.\n"
        f"Interest: {interest}\n\n"
        f"User context:\n{context_block}\n\n"
        f"Current year: {datetime.now(timezone.utc).year}\n\n"
        "Rules:\n"
        "- Total 5 queries, 2 to 5 words each\n"
        "- 2 queries should stay very close to the interest\n"
        "- 3 queries should blend the interest with the user's profile\n"
        "- Diverse angles (tools, methods, niche)\n"
        "- Avoid basic docs-related queries\n"
        "- Return JSON with this exact shape:\n"
        '{ "queries": ["q1", "q2", "q3", "q4", "q5"] }\n'
        "- No markdown\n"
    )
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.2,
            max_tokens=500,
        )
        text = response.choices[0].message.content.strip()
        data = json.loads(text)
        queries = data.get("queries", [])
        if isinstance(queries, list):
            cleaned = [
                q.strip()
                for q in queries
                if isinstance(q, str) and q.strip()
            ]
            if cleaned:
                print(f"  Queries generated: {cleaned}")
                return cleaned[:5]
    except Exception as e:
        print(f"  Warning: Query generation failed for {interest}: {e}")
    return [interest]


def _get_subscribed_user_profile(store: FirestoreStore, user_id: str) -> dict:
    profile = store.get_user_profile(user_id)
    if not profile:
        raise ValueError(f"User {user_id} not found")
    status = profile.get("subscriptionStatus", "none")
    if status not in ["trial", "active"]:
        raise ValueError(
            f"User {user_id} is not subscribed (status: {status})"
        )
    return profile


def build_topics_for_user(
    user_id: str,
    max_interests: int = MAX_INTERESTS_DEFAULT,
    lookback_days: int = LOOKBACK_DAYS_DEFAULT,
    min_refresh_days: int = MIN_REFRESH_DAYS_DEFAULT,
) -> dict:
    store = FirestoreStore()
    profile = _get_subscribed_user_profile(store, user_id)

    interests = profile.get("interests", []) or []
    interests = [
        i.strip()
        for i in interests
        if isinstance(i, str) and i.strip()
    ]
    interests = list(dict.fromkeys(interests))[:max_interests]

    hobbies = profile.get("hobbies", []) or []
    hobbies = [
        h.strip()
        for h in hobbies
        if isinstance(h, str) and h.strip()
    ]
    hobbies = list(dict.fromkeys(hobbies))[:MAX_HOBBIES_DEFAULT]

    if not interests and not hobbies:
        print("No interests or hobbies found for this user.")
        return {
            "user_id": user_id,
            "topics_written": 0,
            "interests": [],
            "hobbies": [],
        }

    api_key = (
        os.getenv("EXA_API_KEY") or os.getenv("EXA_KEY") or ""
    ).strip()
    if not api_key:
        raise ValueError("Set EXA_API_KEY (or EXA_KEY) in the environment.")

    exa = Exa(api_key=api_key)

    now = datetime.now(timezone.utc)
    start_date = _iso_z(now - timedelta(days=lookback_days))
    end_date = _iso_z(now)
    date_key = now.date().isoformat()
    generated_at = _iso_z(now)

    topics_written = 0
    topics_skipped = 0

    def _write_topic(topic_name: str, topic_kind: str) -> None:
        nonlocal topics_written, topics_skipped
        topic_id = _normalize_interest(topic_name)
        doc_ref = store.db.collection("topics").document(topic_id)
        existing = doc_ref.get()
        data = existing.to_dict() if existing.exists else {}
        if not _should_refresh_topic(data, min_refresh_days):
            print(
                "Skipping topic (fresh): "
                f"{topic_name} ({topic_id}) [{topic_kind}]"
            )
            topics_skipped += 1
            return

        print(f"Processing topic: {topic_name} ({topic_id}) [{topic_kind}]")

        queries = _generate_topic_queries(topic_name, profile)
        query_used = random.choice(queries)

        blogs_query = f"blogs about {query_used}"
        print(f"  Exa blog search: {blogs_query}")
        blogs = _search_exa(exa, blogs_query, start_date, end_date)

        discussions = []
        videos = []
        if topic_kind == "interest":
            discussions_query = f"discussions about {query_used}"
            print(f"  Exa discussion search: {discussions_query}")
            discussions = _search_exa(
                exa, discussions_query, start_date, end_date
            )
        else:
            videos_query = f"videos about {query_used}"
            print(f"  YouTube search: {videos_query}")
            youtube_results = youtube_search(
                query_used,
                max_results=RESULTS_PER_SEARCH,
                days=VIDEO_LOOKBACK_DAYS,
                min_subscribers=50_000,
            )
            for v in youtube_results:
                videos.append({
                    "url": v.get("url"),
                    "title": v.get("title", ""),
                    "thumbnail": (v.get("metadata") or {}).get("thumbnail"),
                    "published_date": v.get("published_date"),
                    "duration_seconds": (
                        v.get("metadata") or {}
                    ).get("duration_seconds"),
                })

        generation = {
            "generated_at": generated_at,
            "window_start": start_date,
            "window_end": end_date,
            "blogs": blogs,
            "discussions": discussions,
            "videos": videos,
            "source": "exa",
            "video_source": "youtube",
            "generated_by_user_id": user_id,
            "queries": queries,
            "query_used": query_used,
            "topic_kind": topic_kind,
        }

        generations = (
            data.get("generations", {}) if isinstance(data, dict) else {}
        )
        generations[date_key] = generation

        doc_ref.set(
            {
                "topic_id": topic_id,
                "display_name": topic_name,
                "topic_kind": topic_kind,
                "updated_at": generated_at,
                "latest": generation,
                "queries": queries,
                "generations": generations,
            },
            merge=True,
        )

        topics_written += 1

    for interest in interests:
        _write_topic(interest, "interest")

    for hobby in hobbies:
        _write_topic(hobby, "hobby")

    return {
        "user_id": user_id,
        "topics_written": topics_written,
        "topics_skipped": topics_skipped,
        "interests": interests,
        "hobbies": hobbies,
        "date_key": date_key,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Build Exa topics for a user"
    )
    parser.add_argument(
        "--user_id",
        required=True,
        help="User ID to build topics for",
    )
    parser.add_argument(
        "--max-interests",
        type=int,
        default=MAX_INTERESTS_DEFAULT,
        help="Max interests to process",
    )
    parser.add_argument(
        "--lookback-days",
        type=int,
        default=LOOKBACK_DAYS_DEFAULT,
        help="Days to look back for content",
    )
    args = parser.parse_args()

    result = build_topics_for_user(
        user_id=args.user_id,
        max_interests=args.max_interests,
        lookback_days=args.lookback_days,
    )
    print(f"Done. Topics written: {result['topics_written']}")


if __name__ == "__main__":
    main()
