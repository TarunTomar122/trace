#!/usr/bin/env python3
"""
Assemble final user feeds from the three feed sections.

Reads the for_you, deep_dives, and trending sections already written
by the build scripts, adds metadata, promotes yesterday's URLs to seen,
and writes the final assembled doc.

Usage:
  python3 -m v3.assemble_feeds
  python3 -m v3.assemble_feeds --user-id <uid>
  python3 -m v3.assemble_feeds --date 2026-02-17
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
load_dotenv(REPO_ROOT / ".env")

from v3.lib.store import V3Store, _today_ist  # noqa: E402


def _log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] [v3-assemble] {msg}")


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Assemble v3 user feeds")
    p.add_argument("--user-id", default="")
    p.add_argument("--limit-users", type=int, default=0)
    p.add_argument("--date", default="")
    return p.parse_args()


def _yesterday(date_str: str) -> str:
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    return (dt - timedelta(days=1)).strftime("%Y-%m-%d")


def assemble(args: argparse.Namespace) -> dict[str, int]:
    store = V3Store()
    target_date = args.date.strip() or _today_ist()
    yesterday = _yesterday(target_date)

    users = store.get_onboarded_users()
    if args.user_id:
        users = [u for u in users if u.get("uid") == args.user_id]
    if args.limit_users > 0:
        users = users[: args.limit_users]

    _log(f"Assembling feeds for {len(users)} users, date={target_date}")
    stats = {"users": 0, "total_items": 0, "seen_promoted": 0}

    for profile in users:
        uid = profile.get("uid", "")
        if not uid:
            continue

        feed = store.load_feed(uid, target_date)
        for_you = feed.get("for_you", [])
        deep_dives = feed.get("deep_dives", [])
        trending = feed.get("trending", [])
        total = len(for_you) + len(deep_dives) + len(trending)

        # Promote yesterday's feed URLs to seen
        yesterday_feed = store.load_feed(uid, yesterday)
        y_urls = []
        for section in ("for_you", "deep_dives", "trending"):
            for item in yesterday_feed.get(section, []):
                if isinstance(item, dict) and item.get("url"):
                    y_urls.append(item["url"])
        if y_urls:
            promoted = store.promote_feed_to_seen(uid, y_urls)
            stats["seen_promoted"] += promoted

        metadata = {
            "for_you_count": len(for_you),
            "deep_dives_count": len(deep_dives),
            "trending_count": len(trending),
            "total_items": total,
            "pipeline": "v3",
            "interests": sorted(profile.get("interests", [])),
            "summary_style": profile.get("summaryStyle", ""),
            "seniority": profile.get("seniority", ""),
        }
        store.write_feed_metadata(uid, target_date, metadata)

        stats["users"] += 1
        stats["total_items"] += total
        _log(f"  user={uid} assembled: fy={len(for_you)} dd={len(deep_dives)} tr={len(trending)}")

    store.record_run("assemble", {"date": target_date, **stats})
    _log(f"Assembly done: {stats}")
    return stats


def main() -> None:
    args = _parse_args()
    result = assemble(args)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
