from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Any

import requests

from v3.lib.store import V3Store
from v3.lib.timezones import now_for_profile

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
NOTIFICATION_MARKERS = "v3_push_notifications"
QUIET_HOURS_START = 22
QUIET_HOURS_END = 8

INTEREST_ALIASES = {
    "artificial-intelligence": "ai",
    "artificial_intelligence": "ai",
    "machine-learning": "ai",
    "technology": "tech",
    "software": "tech",
    "productivity": "tech",
    "health": "tech",
    "healthcare": "tech",
    "climate": "tech",
    "sustainability": "tech",
    "software-engineering": "engineering",
    "software_engineering": "engineering",
    "design": "product-design",
    "ux": "product-design",
    "user-experience": "product-design",
    "experience": "product-design",
    "business-market": "markets",
    "business": "markets",
    "leadership": "markets",
    "management": "markets",
    "finance": "fintech",
    "crypto": "fintech",
    "blockchain": "fintech",
    "web3": "fintech",
    "startup": "startups",
    "entrepreneurship": "startups",
    "growth": "marketing",
}


def _normalize_interest_id(value: str) -> str:
    normalized = str(value or "").strip().lower()
    return INTEREST_ALIASES.get(normalized, normalized)


def _topic_identity(topic: dict[str, Any]) -> str:
    return str(
        topic.get("id")
        or topic.get("topic_key")
        or topic.get("title")
        or ""
    ).strip()


def _topic_marker_id(topic: dict[str, Any]) -> str:
    identity = _topic_identity(topic)
    return hashlib.sha256(identity.encode("utf-8")).hexdigest()[:40]


def _first_sentence(text: str) -> str:
    cleaned = " ".join(str(text or "").split()).strip()
    if not cleaned:
        return ""
    parts = cleaned.split(". ")
    sentence = parts[0].strip()
    if not sentence:
        return cleaned[:140].strip()
    if sentence.endswith((".", "!", "?")):
        return sentence[:140].strip()
    return f"{sentence[:136].strip()}."


def _url_hash(url: str) -> str:
    return hashlib.sha256(url.encode("utf-8")).hexdigest()[:32]


def _topic_article(topic: dict[str, Any]) -> dict[str, Any] | None:
    articles = topic.get("articles")
    if isinstance(articles, list) and articles:
        first = articles[0]
        if isinstance(first, dict):
            return first
    return None


def _notification_payload(push_token: str, topic: dict[str, Any]) -> dict[str, Any] | None:
    article = _topic_article(topic)
    if not article:
        return None
    article_url = str(article.get("url", "")).strip()
    if not article_url:
        return None

    title = str(topic.get("title") or article.get("title") or "New story for you").strip()
    body = (
        str(article.get("summary", {}).get("short_article", {}).get("subtitle", "")).strip()
        or _first_sentence(str(topic.get("summary", "")).strip())
        or "Something new matched your interests."
    )

    return {
        "to": push_token,
        "title": title[:120],
        "body": body[:180],
        "sound": "default",
        "priority": "high",
        "data": {
            "articleId": str(article.get("id") or _url_hash(article_url)),
            "topicId": _topic_identity(topic),
            "interestId": _normalize_interest_id(str(topic.get("interest_id", ""))),
            "type": "interest_trending",
        },
    }


def _get_push_enabled_users(store: V3Store) -> list[dict[str, Any]]:
    users: list[dict[str, Any]] = []
    docs = store.db.collection("user_profiles").where("onboarded", "==", True).stream()
    for doc in docs:
        data = doc.to_dict() or {}
        token = str(data.get("pushToken") or "").strip()
        if not token:
            continue
        if data.get("pushNotificationsEnabled") is False:
            continue
        interests = {
            _normalize_interest_id(str(value))
            for value in (data.get("interests") or [])
            if str(value or "").strip()
        }
        if not interests:
            continue
        users.append({
            "uid": doc.id,
            "pushToken": token,
            "interests": interests,
            "timezone": data.get("timezone"),
        })
    return users


def _can_send_now(user: dict[str, Any]) -> bool:
    local_now = now_for_profile(user)
    hour = local_now.hour
    if QUIET_HOURS_START <= hour or hour < QUIET_HOURS_END:
        return False
    return True


def _mark_topic_notified(store: V3Store, topic: dict[str, Any], sent_count: int) -> None:
    marker_id = _topic_marker_id(topic)
    store.db.collection(NOTIFICATION_MARKERS).document(marker_id).set(
        {
            "topic_id": _topic_identity(topic),
            "title": str(topic.get("title", "")).strip(),
            "interest_id": _normalize_interest_id(str(topic.get("interest_id", ""))),
            "sent_count": sent_count,
            "sent_at": datetime.now(timezone.utc).isoformat(),
        },
        merge=True,
    )


def _topic_already_notified(store: V3Store, topic: dict[str, Any]) -> bool:
    marker_id = _topic_marker_id(topic)
    return store.db.collection(NOTIFICATION_MARKERS).document(marker_id).get().exists


def send_interest_notifications(
    store: V3Store,
    previous_topics: list[dict[str, Any]],
    current_topics: list[dict[str, Any]],
) -> dict[str, int]:
    previous_ids = {_topic_identity(topic) for topic in previous_topics if _topic_identity(topic)}
    candidate_topics = [
        topic for topic in current_topics
        if _topic_identity(topic)
        and _topic_identity(topic) not in previous_ids
        and not _topic_already_notified(store, topic)
        and _normalize_interest_id(str(topic.get("interest_id", "")))
    ]

    if not candidate_topics:
        return {
            "new_topics": 0,
            "users_matched": 0,
            "notifications_sent": 0,
        }

    users = _get_push_enabled_users(store)
    if not users:
        return {
            "new_topics": len(candidate_topics),
            "users_matched": 0,
            "notifications_sent": 0,
        }

    messages: list[tuple[str, dict[str, Any], str]] = []
    topic_recipient_counts: dict[str, int] = {}

    for user in users:
        if not _can_send_now(user):
            continue
        matched_topic = next(
            (
                topic for topic in candidate_topics
                if _normalize_interest_id(str(topic.get("interest_id", ""))) in user["interests"]
            ),
            None,
        )
        if not matched_topic:
            continue
        payload = _notification_payload(user["pushToken"], matched_topic)
        if not payload:
            continue
        topic_id = _topic_identity(matched_topic)
        messages.append((user["uid"], payload, topic_id))
        topic_recipient_counts[topic_id] = topic_recipient_counts.get(topic_id, 0) + 1

    sent = 0
    for _, payload, _ in messages:
        try:
            response = requests.post(
                EXPO_PUSH_URL,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=15,
            )
            if response.ok:
                sent += 1
        except requests.RequestException:
            continue

    for topic in candidate_topics:
        topic_id = _topic_identity(topic)
        recipients = topic_recipient_counts.get(topic_id, 0)
        if recipients > 0:
            _mark_topic_notified(store, topic, recipients)

    return {
        "new_topics": len(candidate_topics),
        "users_matched": len(messages),
        "notifications_sent": sent,
    }
