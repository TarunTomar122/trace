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
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

load_dotenv()

from v3.lib.store import V3Store

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


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


def send_trending_notification() -> dict[str, Any]:
    """Send a notification about trending news to all enabled users."""
    store = V3Store()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Get a trending item to feature
    global_feed = store.load_global_feed(today)
    trending = global_feed.get("trending", [])
    
    if not trending:
        return {"error": "No trending items found"}
    
    # Pick the top item
    top_item = trending[0]
    title = "Trending Now"
    body = top_item.get("title", "Check out what's trending")[:100]
    
    # Get users with push enabled
    users = get_users_with_push_enabled()
    if not users:
        return {"error": "No users with push enabled"}
    
    tokens = [u["pushToken"] for u in users]
    stats = send_bulk_notifications(
        tokens,
        title,
        body,
        data={"type": "trending", "articleId": top_item.get("id")},
    )
    
    _log(f"Trending notification sent: {stats}")
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
