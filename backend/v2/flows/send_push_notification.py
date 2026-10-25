#!/usr/bin/env python3
"""
Send push notifications to users via Expo Push Notification service.

Usage:
  python3 -m v2.flows.send_push_notification --type trending
  python3 -m v2.flows.send_push_notification --type daily_reminder
  python3 -m v2.flows.send_push_notification --user-id <uid> --title "Test" --body "Hello"
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv

BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

load_dotenv()

from v3.lib.store import V3Store

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

# The morning push remembers what it sent, one doc per day, and skips a top
# story that repeats one from the last PUSH_REPEAT_DAYS days: a big story stays
# on top for days under a new headline each morning ("1Password Launches AI
# Agent Login Tool", then "1Password Unveils AI Agent Login Feature").
PUSH_HISTORY = "push_notifications_sent"
PUSH_REPEAT_DAYS = 3
PUSH_CANDIDATES = 8
PUSH_URLS = 12  # links kept per pushed story, as the daily keeps (SENT_URLS)


def _log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] [push-notify] {msg}")


def send_push_notification(
    push_token: str,
    title: str,
    body: str,
    data: dict[str, Any] | None = None,
) -> bool:
    """Send a single push notification via Expo."""
    if not push_token or not push_token.startswith("ExponentPushToken"):
        return False

    payload = {
        "to": push_token,
        "title": title,
        "body": body,
        "sound": "default",
        "priority": "high",
    }
    if data:
        payload["data"] = data

    try:
        resp = requests.post(
            EXPO_PUSH_URL,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=10,
        )
        result = resp.json()
        if resp.status_code == 200 and result.get("data", {}).get("status") == "ok":
            return True
        else:
            _log(f"Push failed: {result}")
            return False
    except Exception as e:
        _log(f"Push error: {e}")
        return False


def send_bulk_notifications(
    tokens: list[str],
    title: str,
    body: str,
    data: dict[str, Any] | None = None,
) -> dict[str, int]:
    """Send notifications to multiple tokens (batched)."""
    valid_tokens = [t for t in tokens if t and t.startswith("ExponentPushToken")]
    if not valid_tokens:
        return {"sent": 0, "failed": 0, "skipped": len(tokens)}

    messages = []
    for token in valid_tokens:
        msg = {
            "to": token,
            "title": title,
            "body": body,
            "sound": "default",
            "priority": "high",
        }
        if data:
            msg["data"] = data
        messages.append(msg)

    # Expo accepts batches of up to 100
    stats = {"sent": 0, "failed": 0, "skipped": len(tokens) - len(valid_tokens)}
    
    for i in range(0, len(messages), 100):
        batch = messages[i:i + 100]
        try:
            resp = requests.post(
                EXPO_PUSH_URL,
                json=batch,
                headers={"Content-Type": "application/json"},
                timeout=30,
            )
            results = resp.json().get("data", [])
            for r in results:
                if r.get("status") == "ok":
                    stats["sent"] += 1
                else:
                    stats["failed"] += 1
        except Exception as e:
            _log(f"Batch error: {e}")
            stats["failed"] += len(batch)

    return stats


def get_users_with_push_enabled() -> list[dict[str, Any]]:
    """Get all users who have push notifications enabled."""
    store = V3Store()
    users = []
    
    docs = store.db.collection("user_profiles").where(
        "pushNotificationsEnabled", "==", True
    ).stream()
    
    for doc in docs:
        data = doc.to_dict() or {}
        token = data.get("pushToken", "")
        if token and token.startswith("ExponentPushToken"):
            users.append({
                "uid": doc.id,
                "pushToken": token,
                "name": data.get("name", ""),
            })
    
    return users


def _push_story(topic: dict[str, Any]) -> dict[str, Any]:
    """A topic (or a raw trending item) in the shape the daily's repeat check reads."""
    urls = [
        str(article.get("url"))
        for article in topic.get("articles") or []
        if isinstance(article, dict) and article.get("url")
    ] or ([str(topic["url"])] if topic.get("url") else [])
    urls = urls[:PUSH_URLS]
    return {
        "topic_id": str(topic.get("id") or topic.get("topic_key") or topic.get("title") or ""),
        "title": str(topic.get("title") or ""),
        "summary": str(topic.get("summary") or "")[:600],
        "url": urls[0] if urls else "",
        "urls": urls,
    }


def _recent_pushes(store: V3Store, today: str) -> list[dict[str, Any]]:
    """The stories the morning push sent today (a re-run) and on the PUSH_REPEAT_DAYS days before."""
    day = datetime.strptime(today, "%Y-%m-%d")
    sent: list[dict[str, Any]] = []
    for back in range(0, PUSH_REPEAT_DAYS + 1):
        date = (day - timedelta(days=back)).strftime("%Y-%m-%d")
        try:
            doc = store.db.collection(PUSH_HISTORY).document(date).get()
        except Exception as exc:  # noqa: BLE001 - no history means no filter, not no push
            _log(f"push history read failed for {date}: {type(exc).__name__}")
            continue
        stories = (doc.to_dict() or {}).get("stories") if doc.exists else None
        sent += [story for story in stories or [] if isinstance(story, dict)]
    return sent


def _pick_topic(store: V3Store, topics: list[dict[str, Any]], recent: list[dict[str, Any]]) -> dict[str, Any] | None:
    """The highest-ranked topic that isn't a recent push, or None when all of the top ones are."""
    candidates = topics[:PUSH_CANDIDATES]
    if not recent:
        return candidates[0] if candidates else None
    from v3.flows.send_audience_newsletter import _look_alikes, _repeat_index, _sure_repeat
    from v3.lib.repeats import judge_repeats

    index = _repeat_index(recent)
    stories = [_push_story(topic) for topic in candidates]
    # The daily's checks, with the opposite default: the email sends a close
    # call the model couldn't judge (better a repeat than a missing story), but
    # a second ping about the same news is the complaint, so here only the
    # model saying "different story" clears a look-alike.
    repeats = {n for n, story in enumerate(stories) if _sure_repeat(story, index) is not None}
    pairs = [
        (n, story, sent)
        for n, story in enumerate(stories) if n not in repeats
        for sent in _look_alikes(story, index)
    ]
    verdicts = judge_repeats(store, [(story, sent) for _, story, sent in pairs]) or {}
    unjudged = sum(1 for i in range(len(pairs)) if i not in verdicts)
    if unjudged:
        _log(f"{unjudged} close call(s) unjudged; treated as repeats")
    repeats |= {n for i, (n, _, _) in enumerate(pairs) if verdicts.get(i) is not False}
    for n in sorted(repeats):
        _log(f"skipping a recent repeat: {stories[n]['title'][:80]}")
    return next((topic for n, topic in enumerate(candidates) if n not in repeats), None)


def _record_push(store: V3Store, today: str, story: dict[str, Any]) -> None:
    try:
        ref = store.db.collection(PUSH_HISTORY).document(today)
        doc = ref.get()
        # Appended, so a second push the same day keeps the first one's record.
        earlier = (doc.to_dict() or {}).get("stories") if doc.exists else None
        stories = [s for s in earlier or [] if isinstance(s, dict)] + [story]
        ref.set({"stories": stories, "sent_at": datetime.now(timezone.utc).isoformat()}, merge=True)
    except Exception as exc:  # noqa: BLE001 - the push went out; a lost record only weakens tomorrow's check
        _log(f"push history write failed: {type(exc).__name__}")


def send_trending_notification() -> dict[str, Any]:
    """Send a notification about the top trending topic to all enabled users."""
    store = V3Store()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Prefer trending_topics (clustered topics with deep-link IDs) over raw trending items
    global_feed = store.load_global_feed(today)
    trending_topics = global_feed.get("trending_topics", [])
    trending = global_feed.get("trending", [])

    if not trending_topics and not trending:
        return {"error": "No trending content found"}

    # Get users with push enabled (first, so a day with nobody to tell asks no model)
    users = get_users_with_push_enabled()
    if not users:
        return {"error": "No users with push enabled"}

    # Build notification from the top topic (with deep-link topicId) or fall back to article title
    if trending_topics:
        top = _pick_topic(store, trending_topics, _recent_pushes(store, today))
        if top is None:
            _log("every top story repeats a recent push; none today")
            return {"type": "trending", "skipped": "all top stories were pushed recently"}
        title = "Trending Now"
        body = top.get("title", "See what's trending today")[:100]
        notif_data: dict[str, Any] = {"type": "trending", "topicId": top.get("id") or top.get("topic_key", "")}
    else:
        top = trending[0]
        title = "Trending Now"
        body = top.get("title", "Check out what's trending")[:100]
        notif_data = {"type": "trending", "articleId": top.get("id", "")}

    tokens = [u["pushToken"] for u in users]
    stats = send_bulk_notifications(tokens, title, body, data=notif_data)
    if stats.get("sent"):
        _record_push(store, today, _push_story(top))

    _log(f"Trending notification sent: {body!r} {stats}")
    return {"type": "trending", "users": len(users), **stats}


def send_daily_reminder() -> dict[str, Any]:
    """Send a daily reminder to check the feed."""
    users = get_users_with_push_enabled()
    if not users:
        return {"error": "No users with push enabled"}
    
    title = "Your Daily Brief is Ready"
    body = "Fresh articles and insights waiting for you"
    
    tokens = [u["pushToken"] for u in users]
    stats = send_bulk_notifications(
        tokens,
        title,
        body,
        data={"type": "daily_reminder"},
    )
    
    _log(f"Daily reminder sent: {stats}")
    return {"type": "daily_reminder", "users": len(users), **stats}


def main() -> None:
    parser = argparse.ArgumentParser(description="Send push notifications")
    parser.add_argument(
        "--type",
        choices=["trending", "daily_reminder"],
        help="Type of notification to send",
    )
    parser.add_argument("--user-id", help="Send to specific user")
    parser.add_argument("--title", help="Custom notification title")
    parser.add_argument("--body", help="Custom notification body")
    args = parser.parse_args()

    if args.user_id:
        # Send to specific user
        store = V3Store()
        profile = store.get_user_profile(args.user_id)
        if not profile:
            print(json.dumps({"error": "User not found"}))
            return
        
        token = profile.get("pushToken", "")
        if not token:
            print(json.dumps({"error": "User has no push token"}))
            return
        
        title = args.title or "Trace"
        body = args.body or "You have new content waiting"
        
        success = send_push_notification(token, title, body)
        print(json.dumps({"success": success, "user_id": args.user_id}))
    
    elif args.type == "trending":
        result = send_trending_notification()
        print(json.dumps(result, indent=2))
    
    elif args.type == "daily_reminder":
        result = send_daily_reminder()
        print(json.dumps(result, indent=2))
    
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
