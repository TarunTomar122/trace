"""
Append suggested items to a subscribed user's feed using non-profile topics.

Rules:
- Select up to N topics not in the user's direct interests/hobbies
- Add up to M items per topic (default 2) without overriding the feed
- Respect seen URLs and existing feed URLs

Usage:
  python v1/flows/build_suggested_items_for_user.py --user_id USER_ID
  python v1/flows/build_suggested_items_for_user.py --user_id USER_ID --date 2026-01-22
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

from openai import OpenAI
from v1.storage import FirestoreStore
from v1.algorithm.interest_schema import get_interest_ids, get_interest_label


MAX_SUGGESTED_TOPICS = 4
ITEMS_PER_TOPIC = 2
MAX_SUGGESTED_ITEMS = 4


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


def _select_suggested_topics(
    profile: dict,
    topics: list[dict],
    excluded_ids: set[str],
    max_topics: int,
) -> list[str]:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        return []

    client = OpenAI(api_key=api_key)

    context_lines = []
    for key in ["company", "goals", "learningStyle", "contentDepth"]:
        value = profile.get(key)
        if value:
            context_lines.append(f"{key}: {value}")
    interest_ids = get_interest_ids(profile)
    interests = [get_interest_label(i) for i in interest_ids]
    hobbies = profile.get("hobbies", []) or []
    skills = profile.get("skills", []) or []
    if interests:
        context_lines.append(f"interests: {', '.join(interests[:12])}")
    if hobbies:
        context_lines.append(f"hobbies: {', '.join(hobbies[:12])}")
    if skills:
        context_lines.append(f"skills: {', '.join(skills[:12])}")
    context_block = "\n".join(context_lines)

    available = [t for t in topics if t["topic_id"] not in excluded_ids]
    topics_list = "\n".join(
        [f"- {t['topic_id']} ({t.get('display_name')})" for t in available]
    )

    prompt = (
        "Select up to 4 topic_ids that are NOT the user's direct topics, "
        "but are likely interesting based on their profile.\n"
        "Bias toward topics that help someone with these skills learn or apply them.\n\n"
        f"User context:\n{context_block}\n\n"
        "Available topics:\n"
        f"{topics_list}\n\n"
        "Return JSON with exact shape:\n"
        '{ "topic_ids": ["topic-1", "topic-2"] }\n'
        "No markdown."
    )

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.3,
            max_tokens=400,
        )
        data = json.loads(response.choices[0].message.content.strip())
        topic_ids = data.get("topic_ids", [])
        if isinstance(topic_ids, list):
            cleaned = [
                t for t in topic_ids
                if isinstance(t, str) and t.strip()
                and t not in excluded_ids
            ]
            return cleaned[:max_topics]
    except Exception as e:
        print(f"  Warning: Suggested topic selection failed: {e}")
    return []


def _fallback_suggested_topics(topics: list[dict], excluded_ids: set[str], max_topics: int) -> list[str]:
    candidates = [t["topic_id"] for t in topics if t["topic_id"] not in excluded_ids]
    random.shuffle(candidates)
    return candidates[:max_topics]


def build_suggested_items_for_user(
    user_id: str,
    date: str | None = None,
    max_topics: int = MAX_SUGGESTED_TOPICS,
    items_per_topic: int = ITEMS_PER_TOPIC,
) -> dict:
    store = FirestoreStore()
    profile = store.get_user_profile(user_id)
    if not profile:
        raise ValueError(f"User {user_id} not found")

    status = profile.get("subscriptionStatus", "none")
    if status not in ["trial", "active"]:
        raise ValueError(f"User {user_id} is not subscribed (status: {status})")

    if not date:
        date = _get_today_ist_date()

    feed_ref = store.db.collection("user_feeds").document(user_id).collection("daily").document(date)
    feed_doc = feed_ref.get()
    feed_data = feed_doc.to_dict() if feed_doc.exists else None
    existing_items = (feed_data or {}).get("items", [])
    existing_urls = {i.get("url") for i in existing_items if i.get("url")}

    seen_urls = _get_user_seen_urls(store, user_id)
    chosen_urls = set(existing_urls)

    topics = _get_topics(store)
    if not topics:
        print("No topics found in Firestore.")
        return {"user_id": user_id, "items_added": 0}

    # Get user's current interests to exclude from suggestions
    interest_ids = get_interest_ids(profile)
    
    excluded_ids = {
        _normalize_interest(i)
        for i in interest_ids
        if isinstance(i, str)
    } | {
        _normalize_interest(h)
        for h in (profile.get("hobbies") or [])
        if isinstance(h, str)
    }

    suggested = _select_suggested_topics(profile, topics, excluded_ids, max_topics)
    if not suggested:
        suggested = _fallback_suggested_topics(topics, excluded_ids, max_topics)

    items_to_add = []

    for topic_id in suggested:
        doc = store.db.collection("topics").document(topic_id).get()
        if not doc.exists:
            continue
        topic = doc.to_dict() or {}
        latest = topic.get("latest", {}) or {}
        raw_blogs = latest.get("blogs", []) or []
        raw_discussions = latest.get("discussions", []) or []
        raw_videos = latest.get("videos", []) or []

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

        combined = []
        combined.extend(blogs)
        combined.extend(discussions)
        combined.extend(videos)

        picked = _pick_items(combined, items_per_topic, seen_urls, chosen_urls)
        for idx, item in enumerate(picked):
            item_type = "video" if "youtube.com" in (item.get("url") or "") else "blog"
            if item in discussions:
                item_type = "discussion"
            if item in videos:
                item_type = "video"

            items_to_add.append({
                "id": f"suggested_{topic_id}_{idx}_{date}",
                "type": item_type,
                "title": item.get("title", ""),
                "description": "",
                "url": item.get("url", ""),
                "thumbnail": item.get("thumbnail"),
                "tags": [topic_id],
                "source": "youtube" if item_type == "video" else "exa",
                "metadata": {
                    "why_relevant": "Suggested for you",
                    "feed_category": "suggested",
                },
            })

    if len(items_to_add) > MAX_SUGGESTED_ITEMS:
        items_to_add = items_to_add[:MAX_SUGGESTED_ITEMS]

    if not items_to_add:
        return {"user_id": user_id, "items_added": 0}

    new_items = existing_items + items_to_add
    feed_data = feed_data or {
        "date": date,
        "items": [],
        "generated_at": datetime.utcnow().isoformat(),
        "metadata": {
            "version": "topics_v1",
            "item_count": 0,
            "source_counts": {},
        },
    }
    feed_data["items"] = new_items
    feed_data["generated_at"] = datetime.utcnow().isoformat()
    feed_data.setdefault("metadata", {})
    feed_data["metadata"]["item_count"] = len(new_items)

    feed_ref.set(feed_data, merge=True)

    return {
        "user_id": user_id,
        "date": date,
        "items_added": len(items_to_add),
        "topics_used": suggested,
    }


def main():
    parser = argparse.ArgumentParser(description="Append suggested items to a user's feed")
    parser.add_argument("--user_id", required=True, help="User ID to build feed for")
    parser.add_argument("--date", help="Date string (YYYY-MM-DD), defaults to today IST")
    parser.add_argument("--max-topics", type=int, default=MAX_SUGGESTED_TOPICS, help="Max topics to select")
    parser.add_argument("--items-per-topic", type=int, default=ITEMS_PER_TOPIC, help="Items to add per topic")
    args = parser.parse_args()

    result = build_suggested_items_for_user(
        user_id=args.user_id,
        date=args.date,
        max_topics=args.max_topics,
        items_per_topic=args.items_per_topic,
    )
    print(f"Done. Items added: {result['items_added']}")


if __name__ == "__main__":
    main()
