"""
Build a topic-based feed for an unsubscribed user using LLM topic matching.

Trending news is added separately via add_trending_news_to_feed.py

Usage:
  python v1/flows/build_unsubscribed_feed_from_topics.py --user_id USER_ID
  python v1/flows/build_unsubscribed_feed_from_topics.py --user_id USER_ID --skip-seen
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

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env")

from google import genai
from v1.storage import FirestoreStore


MAX_TOPICS_DEFAULT = 10


def _normalize_interest(interest: str) -> str:
    return (interest.lower().strip()
            .replace(" ", "-")
            .replace("&", "and")
            .replace("/", "-")
            .replace("\\", "-")
            .replace("(", "")
            .replace(")", ""))


def _get_today_ist_date() -> str:
    ist_tz = timezone(timedelta(hours=5, minutes=30))
    return datetime.now(ist_tz).strftime("%Y-%m-%d")


def _dedupe_preserve_order(items: Iterable[dict]) -> list[dict]:
    seen = set()
    deduped = []
    for item in items:
        url = item.get("url") if isinstance(item, dict) else None
        if url and url not in seen:
            seen.add(url)
            deduped.append(item)
    return deduped


def _get_user_seen_urls(store: FirestoreStore, user_id: str) -> set[str]:
    doc = store.db.collection("user_seen_urls").document(user_id).get()
    if not doc.exists:
        return set()
    data = doc.to_dict() or {}
    urls_dict = data.get("urls", {}) or {}
    return set(urls_dict.keys())


def _update_seen_urls(store: FirestoreStore, user_id: str, urls: list[str]) -> None:
    now = datetime.utcnow().isoformat()
    urls_update = {url: now for url in urls}

    doc_ref = store.db.collection("user_seen_urls").document(user_id)
    doc = doc_ref.get()

    if doc.exists:
        existing = doc.to_dict().get("urls", {}) or {}
        existing.update(urls_update)
        doc_ref.update({
            "urls": existing,
            "updated_at": now,
        })
    else:
        doc_ref.set({
            "urls": urls_update,
            "updated_at": now,
        })


def _mark_previous_feed_seen(store: FirestoreStore, user_id: str, date: str) -> None:
    try:
        prev_date = (datetime.strptime(date, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")
    except ValueError:
        return
    feed_doc = (
        store.db.collection("user_feeds")
        .document(user_id)
        .collection("daily")
        .document(prev_date)
        .get()
    )
    if not feed_doc.exists:
        return
    feed_data = feed_doc.to_dict() or {}
    items = feed_data.get("items", []) or []
    urls = [item.get("url") for item in items if item.get("url")]
    if urls:
        _update_seen_urls(store, user_id, urls)


def _pick_items(
    items: list[dict],
    limit: int,
    seen_urls: set[str],
    chosen_urls: set[str],
) -> list[dict]:
    picked = []
    for item in items:
        url = item.get("url")
        if not url:
            continue
        if url in chosen_urls:
            continue
        if url in seen_urls:
            continue
        picked.append(item)
        chosen_urls.add(url)
        if len(picked) >= limit:
            break
    return picked


def _get_topics(store: FirestoreStore) -> list[dict]:
    docs = store.db.collection("topics").stream()
    topics = []
    for doc in docs:
        data = doc.to_dict() or {}
        topic_id = data.get("topic_id") or doc.id
        topics.append({
            "topic_id": topic_id,
            "display_name": data.get("display_name", topic_id),
            "topic_kind": data.get("topic_kind"),
        })
    return topics


def _extract_json_from_response(text: str) -> str:
    """Extract JSON from response, handling markdown code blocks and extra text."""
    text = text.strip()
    # Remove markdown code blocks if present
    if text.startswith("```"):
        lines = text.split("\n")
        # Skip first line (```json or ```)
        lines = lines[1:]
        # Remove closing ```
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    # Try to find JSON object boundaries
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        text = text[start:end + 1]
    return text


def _select_topics_with_llm(
    profile: dict,
    topics: list[dict],
    max_topics: int = MAX_TOPICS_DEFAULT,
) -> list[str]:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return []

    context_lines = []
    for key in ["role", "company", "goals", "learningStyle", "contentDepth"]:
        value = profile.get(key)
        if value:
            context_lines.append(f"{key}: {value}")
    interests = profile.get("interests", []) or []
    hobbies = profile.get("hobbies", []) or []
    if interests:
        context_lines.append(f"interests: {', '.join(interests[:12])}")
    if hobbies:
        context_lines.append(f"hobbies: {', '.join(hobbies[:12])}")
    context_block = "\n".join(context_lines)

    topics_list = "\n".join(
        [f"- {t['topic_id']} ({t.get('display_name')})" for t in topics]
    )

    prompt = f"""Select up to 10 topic_ids that best match this user's interests and profile.

USER CONTEXT:
{context_block}

AVAILABLE TOPICS:
{topics_list}

INSTRUCTIONS:
- Select topic_ids that match the user's interests, role, and goals
- Return ONLY valid JSON, nothing else
- Use this exact format:

{{"topic_ids": ["machine-learning", "python", "web-development"]}}

YOUR RESPONSE (valid JSON only):"""

    try:
        client = genai.Client(api_key=api_key)
    except Exception as e:
        print(f"  Warning: Failed to create Gemini client: {e}")
        return []
    
    # Try up to 2 times
    for attempt in range(2):
        try:
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config={
                    "temperature": 0.2,
                    "max_output_tokens": 600,
                    "response_mime_type": "application/json",
                }
            )
            raw_text = response.text.strip() if response.text else ""
            if not raw_text:
                if attempt == 0:
                    continue
                print(f"  Warning: Gemini returned empty response")
                return []
            cleaned_text = _extract_json_from_response(raw_text)
            data = json.loads(cleaned_text)
            topic_ids = data.get("topic_ids", [])
            if isinstance(topic_ids, list):
                cleaned = [
                    t for t in topic_ids
                    if isinstance(t, str) and t.strip()
                ]
                return cleaned[:max_topics]
        except json.JSONDecodeError as e:
            if attempt == 0:
                continue
            # Log what we actually got for debugging
            snippet = raw_text[:100] if raw_text else "(empty)"
            print(f"  Warning: JSON parse failed: {e} | Response: {snippet}")
        except Exception as e:
            if attempt == 0:
                continue
            print(f"  Warning: Topic selection failed: {e}")
    return []


def _fallback_topic_match(profile: dict, topics: list[dict], max_topics: int) -> list[str]:
    interest_set = {
        _normalize_interest(i)
        for i in (profile.get("interests") or [])
        if isinstance(i, str)
    }
    hobby_set = {
        _normalize_interest(h)
        for h in (profile.get("hobbies") or [])
        if isinstance(h, str)
    }
    target = interest_set | hobby_set
    matches = []
    for t in topics:
        topic_id = t.get("topic_id", "")
        if topic_id in target:
            matches.append(topic_id)
    return matches[:max_topics]


def build_unsubscribed_feed(
    user_id: str,
    date: str | None = None,
    skip_seen: bool = False,
    max_topics: int = MAX_TOPICS_DEFAULT,
    force: bool = False,
) -> dict:
    store = FirestoreStore()
    profile = store.get_user_profile(user_id)
    if not profile:
        raise ValueError(f"User {user_id} not found")

    if not date:
        date = _get_today_ist_date()

    # Check if feed already exists
    if not force:
        existing = store.db.collection("user_feeds").document(user_id).collection("daily").document(date).get()
        if existing.exists:
            return {
                "user_id": user_id,
                "date": date,
                "items_written": 0,
                "skipped": True,
                "reason": "feed_exists",
            }

    seen_urls = set()
    if not skip_seen:
        _mark_previous_feed_seen(store, user_id, date)
        seen_urls = _get_user_seen_urls(store, user_id)

    topics = _get_topics(store)
    if not topics:
        print("No topics found in Firestore.")
        return {"user_id": user_id, "items_written": 0}

    selected = _select_topics_with_llm(profile, topics, max_topics=max_topics)
    if not selected:
        selected = _fallback_topic_match(profile, topics, max_topics=max_topics)

    if not selected:
        print("No matching topics selected.")
        return {"user_id": user_id, "items_written": 0}

    items = []
    chosen_urls: set[str] = set()

    for topic_id in selected:
        doc = store.db.collection("topics").document(topic_id).get()
        if not doc.exists:
            continue
        topic = doc.to_dict() or {}
        latest = topic.get("latest", {}) or {}
        raw_blogs = latest.get("blogs", []) or []
        raw_discussions = latest.get("discussions", []) or []
        raw_videos = latest.get("videos", []) or []
        topic_kind = latest.get("topic_kind") or topic.get("topic_kind")

        blogs = _dedupe_preserve_order([
            b if isinstance(b, dict) else {"url": b, "title": ""}
            for b in raw_blogs
        ])
        discussions = _dedupe_preserve_order([
            d if isinstance(d, dict) else {"url": d, "title": ""}
            for d in raw_discussions
        ])
        videos = _dedupe_preserve_order([
            v if isinstance(v, dict) else {"url": v, "title": ""}
            for v in raw_videos
        ])

        if topic_kind == "hobby":
            picked_blogs = _pick_items(blogs, 1, seen_urls, chosen_urls)
            picked_videos = _pick_items(videos, 1, seen_urls, chosen_urls)
            picked_discussions = []
        else:
            picked_blogs = _pick_items(blogs, 2, seen_urls, chosen_urls)
            picked_videos = []
            picked_discussions = _pick_items(discussions, 2, seen_urls, chosen_urls)

        for idx, item in enumerate(picked_blogs):
            items.append({
                "id": f"topic_{topic_id}_blog_{idx}_{date}",
                "type": "blog",
                "title": item.get("title", ""),
                "description": "",
                "url": item.get("url", ""),
                "tags": [topic_id],
                "source": "exa",
                "metadata": {
                    "why_relevant": f"Matches your interest in {topic_id.replace('-', ' ')}",
                    "feed_category": "topics",
                },
            })

        for idx, item in enumerate(picked_discussions):
            items.append({
                "id": f"topic_{topic_id}_discussion_{idx}_{date}",
                "type": "discussion",
                "title": item.get("title", ""),
                "description": "",
                "url": item.get("url", ""),
                "tags": [topic_id],
                "source": "exa",
                "metadata": {
                    "why_relevant": f"Matches your interest in {topic_id.replace('-', ' ')}",
                    "feed_category": "topics",
                },
            })

        for idx, item in enumerate(picked_videos):
            items.append({
                "id": f"topic_{topic_id}_video_{idx}_{date}",
                "type": "video",
                "title": item.get("title", ""),
                "description": "",
                "url": item.get("url", ""),
                "thumbnail": item.get("thumbnail"),
                "tags": [topic_id],
                "source": "youtube",
                "metadata": {
                    "why_relevant": f"Matches your interest in {topic_id.replace('-', ' ')}",
                    "feed_category": "topics",
                },
            })

    # Shuffle items for variety
    random.shuffle(items)

    feed_data = {
        "date": date,
        "items": items,
        "generated_at": datetime.utcnow().isoformat(),
        "metadata": {
            "version": "topics_v1_unsub",
            "item_count": len(items),
            "source_counts": {
                "blog": sum(1 for i in items if i.get("type") == "blog"),
                "discussion": sum(1 for i in items if i.get("type") == "discussion"),
                "video": sum(1 for i in items if i.get("type") == "video"),
            },
            "skip_seen": skip_seen,
            "is_preview": True,
        },
    }

    store.db.collection("user_feeds").document(user_id).collection("daily").document(date).set(feed_data)

    return {
        "user_id": user_id,
        "date": date,
        "items_written": len(items),
        "topics_used": selected,
        "skip_seen": skip_seen,
    }


def main():
    parser = argparse.ArgumentParser(description="Build topic feed for unsubscribed user")
    parser.add_argument("--user_id", required=True, help="User ID to build feed for")
    parser.add_argument("--date", help="Date string (YYYY-MM-DD), defaults to today IST")
    parser.add_argument("--skip-seen", action="store_true", help="Skip seen URL filtering and updates")
    parser.add_argument("--max-topics", type=int, default=MAX_TOPICS_DEFAULT, help="Max topics to select")
    args = parser.parse_args()

    result = build_unsubscribed_feed(
        user_id=args.user_id,
        date=args.date,
        skip_seen=args.skip_seen,
        max_topics=args.max_topics,
    )
    print(f"Done. Items written: {result['items_written']}")


if __name__ == "__main__":
    main()

