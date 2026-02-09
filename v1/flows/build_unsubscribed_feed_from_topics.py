"""
Build a topic-based feed for an unsubscribed user using deterministic matching.

Trending news is added separately via add_trending_news_to_feed.py

Usage:
  python v1/flows/build_unsubscribed_feed_from_topics.py --user_id USER_ID
  python v1/flows/build_unsubscribed_feed_from_topics.py --user_id USER_ID --skip-seen
"""
import argparse
import hashlib
import json
import random
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable

project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env")

from v1.storage import FirestoreStore
from v1.algorithm.interest_schema import (
    build_query_id,
    get_interest_ids,
    get_interest_label,
    get_interest_queries,
    normalize_query_text,
)


MAX_FEED_ITEMS = 10  # Unsubscribed users get limited content


MAX_TOPICS_DEFAULT = 10
CACHE_COLLECTION = "user_topic_selection_cache"
MIN_QUERY_POOL_ITEMS = 4

DEFAULT_SOURCE_WEIGHTS = {
    "blog": 5,
    "discussion": 4,
    "video": 3,
}


def _normalize_interest(interest: str) -> str:
    return _normalize_text(interest)


def _normalize_text(value: str) -> str:
    if not value:
        return ""
    normalized = re.sub(r"[^a-z0-9]+", "-", value.lower().strip())
    return normalized.strip("-")


def _tokenize(value: str) -> set[str]:
    if not value:
        return set()
    return {t for t in re.split(r"[^a-z0-9]+", value.lower().strip()) if t}


# Extended keyword map for interests whose names are too short/generic
_INTEREST_KEYWORDS: dict[str, list[str]] = {
    "technology": ["tech", "software", "hardware", "digital", "computing", "internet", "app", "startup", "code", "programming", "developer", "engineering", "algorithm", "blockchain", "cloud", "cyber"],
    "money": ["finance", "investing", "investment", "wealth", "budget", "savings", "stock", "crypto", "economic", "financial", "dollar", "income", "debt", "retire"],
    "health": ["medical", "wellness", "fitness", "nutrition", "mental health", "exercise", "diet", "sleep", "disease", "therapy", "doctor", "hospital", "vaccine"],
    "design": ["ux", "ui", "graphic", "visual", "typography", "layout", "interface", "prototype", "figma", "creative", "aesthetic", "branding"],
    "business": ["startup", "entrepreneur", "company", "founder", "revenue", "market", "customer", "product", "leadership", "management", "ceo", "growth", "strategy"],
    "career": ["job", "hire", "hiring", "interview", "resume", "promotion", "workplace", "salary", "profession", "skill", "mentor", "career change"],
    "psychology": ["mental", "cognitive", "behavior", "emotion", "therapy", "mindset", "habit", "bias", "brain", "consciousness", "motivation", "anxiety"],
    "culture": ["society", "cultural", "tradition", "art", "music", "film", "literature", "history", "identity", "diversity", "social", "community"],
    "ideas": ["concept", "innovation", "creativity", "philosophy", "thought", "theory", "insight", "perspective", "paradigm", "framework"],
    "science": ["research", "experiment", "discovery", "physics", "biology", "chemistry", "space", "climate", "evolution", "scientific"],
}


def _title_matches_topic(title: str, topic_name: str, interest_id: str | None = None) -> bool:
    """Check if an article title is roughly related to the topic."""
    if not title or not topic_name:
        return False
    
    title_lower = title.lower()
    topic_lower = topic_name.lower()
    
    # Split topic into keywords
    topic_words = set(topic_lower.replace("-", " ").split())
    # Remove common filler words
    filler_words = {"the", "a", "an", "in", "on", "for", "to", "and", "or", "of", "with"}
    topic_words = topic_words - filler_words

    # Add extended keywords if available
    if interest_id and interest_id in _INTEREST_KEYWORDS:
        topic_words.update(_INTEREST_KEYWORDS[interest_id])
    
    # Check if any topic keyword appears in title
    for word in topic_words:
        if len(word) >= 3 and word in title_lower:
            return True
    
    # Also check the full topic phrase
    topic_phrase = topic_lower.replace("-", " ")
    if topic_phrase in title_lower:
        return True
    
    return False


def _is_junk_url(url: str) -> bool:
    """Quick check for homepage/archive URLs that shouldn't be in feeds."""
    if not url:
        return True
    from urllib.parse import urlparse
    try:
        parsed = urlparse(url)
        host = parsed.hostname or ""
        path = (parsed.path or "").lower().rstrip("/")
        if not path or path == "/" or path == "/index.html":
            return True
        if path in ("/blog", "/blogs", "/articles", "/posts", "/news",
                     "/newsletter", "/latest", "/stories"):
            return True
        if "blogspot" in host and re.match(r"^/\d{4}(/\d{2})?/?$", path):
            return True
        if "medium.com" in host and re.match(r"^/[a-z0-9][\w-]*/?$", path):
            return True
        return False
    except Exception:
        return False


def _get_why_relevant(title: str, topic_name: str, topic_kind: str, query_text: str | None = None, interest_id: str | None = None) -> str:
    """Generate appropriate why_relevant text based on actual relevance."""
    if _title_matches_topic(title, topic_name, interest_id=interest_id):
        if topic_kind == "hobby":
            return f"Matches your hobby in {topic_name.replace('-', ' ')}"
        if query_text:
            return f"Matches your interest in {topic_name} · {query_text}"
        return f"Matches your interest in {topic_name.replace('-', ' ')}"
    # Fallback for items that don't clearly match
    return "Curated for you"


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
    interest_id: str | None = None,
    topic_name: str | None = None,
) -> list[dict]:
    """Pick items, prioritizing those whose title matches the topic."""
    relevant = []
    other = []
    for item in items:
        url = item.get("url")
        if not url or url in chosen_urls or url in seen_urls:
            continue
        if _is_junk_url(url):
            continue
        title = item.get("title", "")
        if topic_name and _title_matches_topic(title, topic_name, interest_id=interest_id):
            relevant.append(item)
        else:
            other.append(item)

    picked = []
    for item in relevant + other:
        picked.append(item)
        chosen_urls.add(item["url"])
        if len(picked) >= limit:
            break
    return picked


def _get_topics(store: FirestoreStore) -> list[dict]:
    docs = store.db.collection("topics").stream()
    topics = []
    for doc in docs:
        data = doc.to_dict() or {}
        topic_id = data.get("topic_id") or doc.id
        latest = data.get("latest", {}) or {}
        blogs = latest.get("blogs", []) or []
        discussions = latest.get("discussions", []) or []
        videos = latest.get("videos", []) or []
        content_score = min(len(blogs), 3) + min(len(discussions), 3) + min(len(videos), 3)
        topics.append({
            "topic_id": topic_id,
            "display_name": data.get("display_name", topic_id),
            "topic_kind": data.get("topic_kind"),
            "content_score": content_score,
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


def _profile_signature(profile: dict) -> str:
    interest_ids = get_interest_ids(profile)
    interest_queries = get_interest_queries(profile)
    payload = {
        "interest_ids": sorted([_normalize_text(i) for i in interest_ids if i]),
        "interest_queries": sorted(
            [
                (_normalize_text(k), [_normalize_text(q) for q in v])
                for k, v in interest_queries.items()
            ]
        ),
        "hobbies": sorted([_normalize_text(h) for h in (profile.get("hobbies") or []) if h]),
        "skills": sorted([_normalize_text(s) for s in (profile.get("skills") or []) if s]),
    }
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def _get_cached_topic_selection(store: FirestoreStore, user_id: str, signature: str) -> list[str]:
    doc = store.db.collection(CACHE_COLLECTION).document(user_id).get()
    if not doc.exists:
        return []
    data = doc.to_dict() or {}
    if data.get("signature") != signature:
        return []
    cached = data.get("topic_ids") or []
    return [t for t in cached if isinstance(t, str) and t.strip()]


def _save_cached_topic_selection(
    store: FirestoreStore,
    user_id: str,
    signature: str,
    topic_ids: list[str],
) -> None:
    store.db.collection(CACHE_COLLECTION).document(user_id).set(
        {
            "signature": signature,
            "topic_ids": topic_ids,
            "updated_at": datetime.utcnow().isoformat(),
        }
    )


def _extract_profile_terms(profile: dict) -> dict[str, set[str]]:
    interests = get_interest_ids(profile)
    hobbies = profile.get("hobbies") or []
    skills = profile.get("skills") or []

    interest_slugs = {_normalize_text(i) for i in interests if isinstance(i, str)}
    hobby_slugs = {_normalize_text(h) for h in hobbies if isinstance(h, str)}
    interest_tokens = set()
    for i in interests:
        interest_tokens |= _tokenize(str(i))
    hobby_tokens = set()
    for h in hobbies:
        hobby_tokens |= _tokenize(str(h))

    skill_tokens = set()
    for s in skills:
        skill_tokens |= _tokenize(str(s))

    return {
        "interest_slugs": interest_slugs,
        "hobby_slugs": hobby_slugs,
        "interest_tokens": interest_tokens,
        "hobby_tokens": hobby_tokens,
        "skill_tokens": skill_tokens,
    }


def _score_topic(topic: dict, terms: dict[str, set[str]]) -> int:
    topic_id = topic.get("topic_id", "")
    display_name = topic.get("display_name", "")
    display_slug = _normalize_text(display_name)
    tokens = _tokenize(topic_id) | _tokenize(display_name)

    score = 0
    if topic_id in terms["interest_slugs"] or display_slug in terms["interest_slugs"]:
        score += 6
    if topic_id in terms["hobby_slugs"] or display_slug in terms["hobby_slugs"]:
        score += 6

    overlap_interest = len(tokens & terms["interest_tokens"])
    overlap_hobby = len(tokens & terms["hobby_tokens"])
    overlap_skill = len(tokens & terms["skill_tokens"])

    score += min(overlap_interest + overlap_hobby, 3) * 2
    score += min(overlap_skill, 1)

    if topic.get("content_score", 0) > 0:
        score += 1
    return score


def _select_topics_deterministic(
    profile: dict,
    topics: list[dict],
    max_topics: int = MAX_TOPICS_DEFAULT,
) -> list[str]:
    if not topics:
        return []
    terms = _extract_profile_terms(profile)
    eligible = [t for t in topics if t.get("content_score", 0) > 0]
    if not eligible:
        eligible = topics

    scored = []
    for t in eligible:
        scored.append((t.get("topic_id"), _score_topic(t, terms), t.get("content_score", 0)))

    scored.sort(key=lambda x: (x[1], x[2], x[0]), reverse=True)
    selected = [topic_id for topic_id, score, _ in scored if score > 0][:max_topics]

    if len(selected) < max_topics:
        fallback = [
            t.get("topic_id")
            for t in sorted(eligible, key=lambda x: (x.get("content_score", 0), x.get("topic_id", "")), reverse=True)
            if t.get("topic_id") not in selected
        ]
        selected.extend(fallback[: max_topics - len(selected)])

    return selected[:max_topics]


def _fallback_topic_match(profile: dict, topics: list[dict], max_topics: int) -> list[str]:
    interest_set = {
        _normalize_interest(i)
        for i in get_interest_ids(profile)
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


def _source_weights(profile: dict) -> dict[str, int]:
    prefs = profile.get("sourcePreferences") or {}
    return {
        "blog": int(prefs.get("articles", DEFAULT_SOURCE_WEIGHTS["blog"]) or 0),
        "discussion": int(prefs.get("discussions", DEFAULT_SOURCE_WEIGHTS["discussion"]) or 0),
        "video": int(prefs.get("youtube", DEFAULT_SOURCE_WEIGHTS["video"]) or 0),
    }


def _pool_item_count(latest: dict) -> int:
    blogs = latest.get("blogs", []) or []
    discussions = latest.get("discussions", []) or []
    return len(blogs) + len(discussions)


def _load_interest_pools(
    store: FirestoreStore,
    interest_id: str,
    interest_queries: dict[str, list[str]],
) -> list[dict]:
    pools: list[dict] = []
    raw_queries = interest_queries.get(interest_id, [])[:2]
    for raw in raw_queries:
        query_text = normalize_query_text(interest_id, raw)
        query_id = build_query_id(query_text)
        doc_ref = (
            store.db.collection("topics")
            .document(interest_id)
            .collection("__q")
            .document(query_id)
        )
        doc = doc_ref.get()
        if not doc.exists:
            continue
        data = doc.to_dict() or {}
        pools.append({
            "latest": data.get("latest", {}) or {},
            "query_text": query_text,
            "topic_kind": "interest",
            "display_name": get_interest_label(interest_id),
        })

    if pools:
        total_items = sum(_pool_item_count(p["latest"]) for p in pools)
        if total_items >= MIN_QUERY_POOL_ITEMS:
            return pools

    doc = store.db.collection("topics").document(interest_id).get()
    if not doc.exists:
        return []
    data = doc.to_dict() or {}
    latest = data.get("latest", {}) or {}
    topic_kind = latest.get("topic_kind") or data.get("topic_kind") or "interest"
    display_name = data.get("display_name") or get_interest_label(interest_id)
    return [{
        "latest": latest,
        "query_text": None,
        "topic_kind": topic_kind,
        "display_name": display_name,
    }]


def _merge_pool_items(pools: list[dict], key: str) -> list[dict]:
    merged = []
    for pool in pools:
        latest = pool.get("latest", {}) or {}
        items = latest.get(key, []) or []
        for item in items:
            if isinstance(item, dict):
                url = item.get("url")
                title = item.get("title", "")
                payload = {**item, "url": url, "title": title}
            else:
                payload = {"url": item, "title": ""}
            payload["query_text"] = pool.get("query_text")
            merged.append(payload)
    return _dedupe_preserve_order(merged)


def _allocate_two_types(max_items: int, weight_a: int, weight_b: int) -> tuple[int, int]:
    if max_items <= 0:
        return 0, 0
    total = max(weight_a, 0) + max(weight_b, 0)
    if total == 0:
        a_count = max_items // 2
        return a_count, max_items - a_count
    a_share = max(weight_a, 0) / total
    a_count = int(round(max_items * a_share))
    if weight_a > 0 and weight_b > 0 and max_items >= 2:
        a_count = max(1, min(max_items - 1, a_count))
    b_count = max_items - a_count
    return a_count, b_count


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

    interest_ids = get_interest_ids(profile)
    interest_queries = get_interest_queries(profile)

    if interest_ids:
        selected = interest_ids[:max_topics]
        hobbies = profile.get("hobbies", []) or []
        hobby_ids = [
            _normalize_interest(h)
            for h in hobbies
            if isinstance(h, str) and h.strip()
        ]
        if hobby_ids:
            for hobby_id in hobby_ids:
                if hobby_id in selected:
                    continue
                if len(selected) >= max_topics:
                    break
                selected.append(hobby_id)
    else:
        topics = _get_topics(store)
        if not topics:
            print("No topics found in Firestore.")
            return {"user_id": user_id, "items_written": 0}

        signature = _profile_signature(profile)
        selected = _get_cached_topic_selection(store, user_id, signature)
        if not selected:
            selected = _select_topics_deterministic(profile, topics, max_topics=max_topics)
            if not selected:
                selected = _fallback_topic_match(profile, topics, max_topics=max_topics)
            if selected:
                _save_cached_topic_selection(store, user_id, signature, selected[:max_topics])
        if selected:
            selected = selected[:max_topics]

    if not selected:
        print("No matching topics selected.")
        return {"user_id": user_id, "items_written": 0}

    items = []
    chosen_urls: set[str] = set()
    source_weights = _source_weights(profile)

    for topic_id in selected:
        pools = _load_interest_pools(store, topic_id, interest_queries)
        if not pools:
            continue
        interest_label = pools[0].get("display_name") or get_interest_label(topic_id)
        topic_kind = pools[0].get("topic_kind") or "interest"

        blogs = _merge_pool_items(pools, "blogs")
        discussions = _merge_pool_items(pools, "discussions")
        videos = _merge_pool_items(pools, "videos")

        if topic_kind == "hobby":
            blog_limit, video_limit = _allocate_two_types(
                max_items=2,
                weight_a=source_weights["blog"],
                weight_b=source_weights["video"],
            )
            picked_blogs = _pick_items(blogs, blog_limit, seen_urls, chosen_urls,
                                       interest_id=topic_id, topic_name=interest_label)
            picked_videos = _pick_items(videos, video_limit, seen_urls, chosen_urls,
                                        interest_id=topic_id, topic_name=interest_label)
            picked_discussions = []

            remaining = 2 - len(picked_blogs) - len(picked_videos)
            if remaining > 0:
                if source_weights["blog"] >= source_weights["video"]:
                    picked_blogs += _pick_items(blogs, remaining, seen_urls, chosen_urls,
                                                interest_id=topic_id, topic_name=interest_label)
                    remaining = 2 - len(picked_blogs) - len(picked_videos)
                    if remaining > 0:
                        picked_videos += _pick_items(videos, remaining, seen_urls, chosen_urls,
                                                     interest_id=topic_id, topic_name=interest_label)
                else:
                    picked_videos += _pick_items(videos, remaining, seen_urls, chosen_urls,
                                                 interest_id=topic_id, topic_name=interest_label)
                    remaining = 2 - len(picked_blogs) - len(picked_videos)
                    if remaining > 0:
                        picked_blogs += _pick_items(blogs, remaining, seen_urls, chosen_urls,
                                                    interest_id=topic_id, topic_name=interest_label)
        else:
            blog_limit, discussion_limit = _allocate_two_types(
                max_items=4,
                weight_a=source_weights["blog"],
                weight_b=source_weights["discussion"],
            )
            picked_blogs = _pick_items(blogs, blog_limit, seen_urls, chosen_urls,
                                       interest_id=topic_id, topic_name=interest_label)
            picked_discussions = _pick_items(discussions, discussion_limit, seen_urls, chosen_urls,
                                             interest_id=topic_id, topic_name=interest_label)
            picked_videos = []

            remaining = 4 - len(picked_blogs) - len(picked_discussions)
            if remaining > 0:
                if source_weights["blog"] >= source_weights["discussion"]:
                    picked_blogs += _pick_items(blogs, remaining, seen_urls, chosen_urls,
                                                interest_id=topic_id, topic_name=interest_label)
                    remaining = 4 - len(picked_blogs) - len(picked_discussions)
                    if remaining > 0:
                        picked_discussions += _pick_items(discussions, remaining, seen_urls, chosen_urls,
                                                          interest_id=topic_id, topic_name=interest_label)
                else:
                    picked_discussions += _pick_items(discussions, remaining, seen_urls, chosen_urls,
                                                      interest_id=topic_id, topic_name=interest_label)
                    remaining = 4 - len(picked_blogs) - len(picked_discussions)
                    if remaining > 0:
                        picked_blogs += _pick_items(blogs, remaining, seen_urls, chosen_urls,
                                                    interest_id=topic_id, topic_name=interest_label)

        for idx, item in enumerate(picked_blogs):
            title = item.get("title", "")
            query_text = item.get("query_text")
            items.append({
                "id": f"topic_{topic_id}_blog_{idx}_{date}",
                "type": "blog",
                "title": title,
                "description": "",
                "url": item.get("url", ""),
                "tags": [topic_id],
                "source": "exa",
                "metadata": {
                    "why_relevant": _get_why_relevant(title, interest_label, topic_kind or "interest", query_text, interest_id=topic_id),
                    "feed_category": "topics",
                },
            })

        for idx, item in enumerate(picked_discussions):
            title = item.get("title", "")
            query_text = item.get("query_text")
            items.append({
                "id": f"topic_{topic_id}_discussion_{idx}_{date}",
                "type": "discussion",
                "title": title,
                "description": "",
                "url": item.get("url", ""),
                "tags": [topic_id],
                "source": "exa",
                "metadata": {
                    "why_relevant": _get_why_relevant(title, interest_label, topic_kind or "interest", query_text, interest_id=topic_id),
                    "feed_category": "topics",
                },
            })

        for idx, item in enumerate(picked_videos):
            title = item.get("title", "")
            query_text = item.get("query_text")
            items.append({
                "id": f"topic_{topic_id}_video_{idx}_{date}",
                "type": "video",
                "title": title,
                "description": "",
                "url": item.get("url", ""),
                "thumbnail": item.get("thumbnail"),
                "tags": [topic_id],
                "source": "youtube",
                "metadata": {
                    "why_relevant": _get_why_relevant(title, interest_label, topic_kind or "interest", query_text, interest_id=topic_id),
                    "feed_category": "topics",
                },
            })

    # Shuffle items for variety
    random.shuffle(items)
    if len(items) > MAX_FEED_ITEMS:
        items = items[:MAX_FEED_ITEMS]

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
