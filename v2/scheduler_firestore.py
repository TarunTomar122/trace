#!/usr/bin/env python3
"""
V2 Firestore scheduler for:
1) pool refresh (every N days)
2) daily subscribed feed generation
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Callable

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
load_dotenv(REPO_ROOT / ".env")

from v1.storage import FirestoreStore  # noqa: E402
from v2.flows.generate_daily_subscribed_feeds_from_pool import (  # noqa: E402
    generate_daily_subscribed_feeds_from_pool,
)
from v2.flows.build_trending_news_for_day import (  # noqa: E402
    build_trending_news_for_day,
)
from v2.flows.build_unified_newsletter import (  # noqa: E402
    build_unified_newsletter,
)
from v2.flows.send_unified_newsletter import (  # noqa: E402
    send_unified_newsletter,
)
from v2.flows.refresh_article_pool_firestore import (  # noqa: E402
    refresh_article_pool_firestore,
)
from v2.flows.build_learning_pool import (  # noqa: E402
    build_learning_pool,
)
from v2.flows.generate_daily_insights import (  # noqa: E402
    generate_daily_insights,
)
from v2.flows.generate_weekly_wrap import (  # noqa: E402
    generate_weekly_wraps,
)

RUNS_COLLECTION = "pipeline_runs_v2"


def _log(message: str) -> None:
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{stamp}] {message}")


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run V2 Firestore feed scheduler."
    )
    parser.add_argument(
        "--jobs",
        required=True,
        choices=[
            "all",
            "pool",
            "learning",
            "trending",
            "feeds",
            "insights",
            "weekly_wrap",
            "newsletter_build",
            "newsletter_send",
            "newsletters",
        ],
        help="Jobs to run.",
    )
    parser.add_argument(
        "--pool-cadence-days",
        type=int,
        default=1,
        help="Pool refresh cadence in days.",
    )
    parser.add_argument(
        "--force-pool",
        action="store_true",
        help="Run pool refresh even if cadence says not due.",
    )
    parser.add_argument(
        "--learning-cadence-days",
        type=int,
        default=7,
        help="Learning pool refresh cadence in days.",
    )
    parser.add_argument(
        "--force-learning",
        action="store_true",
        help="Run learning pool refresh even if cadence says not due.",
    )
    parser.add_argument(
        "--date",
        default="",
        help="Optional feed date YYYY-MM-DD.",
    )
    parser.add_argument(
        "--limit-users",
        type=int,
        default=0,
        help="Optional cap on users for feed generation.",
    )
    parser.add_argument(
        "--items-per-user",
        type=int,
        default=8,
        help="Final feed cap per user after curation.",
    )
    parser.add_argument(
        "--user-id",
        default="",
        help="Run feeds for one specific user.",
    )
    return parser.parse_args()


def _run_job(name: str, job_fn: Callable[[], dict]) -> dict:
    _log(f"Starting {name}...")
    started = time.time()
    try:
        result = job_fn()
        duration = time.time() - started
        _log(f"Done {name} ({duration:.1f}s)")
        return {
            "name": name,
            "success": True,
            "duration": duration,
            "result": result,
        }
    except Exception as exc:
        duration = time.time() - started
        _log(f"Failed {name}: {exc}")
        return {
            "name": name,
            "success": False,
            "duration": duration,
            "error": str(exc),
        }


def _is_job_due(
    store: FirestoreStore, doc_id: str, cadence_days: int,
) -> bool:
    doc = store.db.collection(RUNS_COLLECTION).document(doc_id).get()
    if not doc.exists:
        return True
    data = doc.to_dict() or {}
    last_run_at = data.get("last_run_at", "")
    if not last_run_at:
        return True
    try:
        dt = datetime.fromisoformat(last_run_at.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        dt = dt.astimezone(timezone.utc)
    except ValueError:
        return True
    return dt <= datetime.now(timezone.utc) - timedelta(
        days=max(0, cadence_days)
    )


def _is_pool_due(store: FirestoreStore, cadence_days: int) -> bool:
    return _is_job_due(store, "pool_refresh", cadence_days)


def run_scheduler(args: argparse.Namespace) -> dict:
    store = FirestoreStore()
    _log(
        "Scheduler config: "
        f"jobs={args.jobs}, pool_cadence={args.pool_cadence_days}d, "
        f"learning_cadence={args.learning_cadence_days}d, "
        f"force_pool={args.force_pool}, "
        f"force_learning={args.force_learning}, "
        f"date={args.date or 'today_ist'}, "
        f"user_id={args.user_id or '-'}, limit_users={args.limit_users}, "
        f"items_per_user={args.items_per_user}"
    )
    job_names: list[str]
    if args.jobs == "all":
        job_names = [
            "pool", "learning", "trending", "feeds",
            "insights", "newsletters",
        ]
    elif args.jobs == "newsletters":
        job_names = ["newsletter_build", "newsletter_send"]
    else:
        job_names = [args.jobs]

    results: list[dict] = []

    if "pool" in job_names:
        if args.force_pool or _is_pool_due(store, args.pool_cadence_days):
            results.append(
                _run_job(
                    "pool_refresh",
                    lambda: refresh_article_pool_firestore(
                        argparse.Namespace(
                            sources_config=(
                                "v2/config/interest_source_links.json"
                            ),
                            limit_per_source=5,
                            days_rss=7,
                            days_atom=7,
                            days_html=14,
                            days_sitemap=14,
                            default_days=14,
                            retention_days=14,
                            summary_skill_level="intermediate",
                            summary_model="gpt-4o-mini",
                            summary_temperature=0.3,
                            summary_timeout_seconds=60,
                            content_ttl_days=3,
                            summary_ttl_days=14,
                            force_refresh=False,
                            http_timeout=25,
                            interest_id=[],
                            subinterest_id=[],
                        )
                    ),
                )
            )
        else:
            _log("Skipping pool_refresh (not due yet).")
            results.append(
                {
                    "name": "pool_refresh",
                    "success": True,
                    "duration": 0,
                    "result": {"skipped": True, "reason": "not_due"},
                }
            )

    if "learning" in job_names:
        learning_due = (
            args.force_learning
            or _is_job_due(store, "learning_pool", args.learning_cadence_days)
        )
        if learning_due:
            results.append(
                _run_job(
                    "learning_pool",
                    lambda: build_learning_pool(
                        argparse.Namespace(
                            config="v2/config/learning_source_links.json",
                            limit_per_source=5,
                            max_age_days=60,
                            retention_days=90,
                            content_ttl_days=7,
                            summary_ttl_days=30,
                            summary_model="gpt-4o-mini",
                            summary_skill_level="intermediate",
                            summary_temperature=0.3,
                            summary_timeout=60,
                            http_timeout=25,
                            force=False,
                        )
                    ),
                )
            )
        else:
            _log(
                "Skipping learning_pool "
                f"(not due, cadence={args.learning_cadence_days}d)."
            )
            results.append({
                "name": "learning_pool",
                "success": True,
                "duration": 0,
                "result": {"skipped": True, "reason": "not_due"},
            })

    if "trending" in job_names:
        results.append(
            _run_job(
                "trending_news",
                lambda: build_trending_news_for_day(
                    date=(args.date.strip() or None)
                ),
            )
        )

    if "feeds" in job_names:
        results.append(
            _run_job(
                "daily_subscribed_feeds",
                lambda: generate_daily_subscribed_feeds_from_pool(
                    argparse.Namespace(
                        date=args.date,
                        limit_users=args.limit_users,
                        user_id=args.user_id,
                        items_per_user=args.items_per_user,
                        max_age_days=14,
                        interest_id=[],
                        add_suggested=True,
                        add_trending=True,
                        add_learning=True,
                        learning_items=3,
                        suggested_max_topics=2,
                        suggested_items_per_topic=1,
                        min_suggested_items=1,
                        min_trending_items=1,
                    )
                ),
            )
        )

    if "insights" in job_names:
        results.append(
            _run_job(
                "daily_insights",
                lambda: generate_daily_insights(
                    date=(args.date.strip() or None),
                ),
            )
        )

    if "weekly_wrap" in job_names:
        results.append(
            _run_job(
                "weekly_wrap",
                lambda: generate_weekly_wraps(
                    date=(args.date.strip() or None),
                ),
            )
        )

    if "newsletter_build" in job_names:
        results.append(
            _run_job(
                "newsletter_build",
                lambda: build_unified_newsletter(
                    date=(args.date.strip() or None),
                    max_items=8,
                    force=False,
                ),
            )
        )

    if "newsletter_send" in job_names:
        results.append(
            _run_job(
                "newsletter_send",
                lambda: send_unified_newsletter(
                    date=(args.date.strip() or None),
                    dry_run=False,
                    force=False,
                ),
            )
        )

    failed = sum(1 for r in results if not r.get("success"))
    return {"jobs": job_names, "failed": failed, "results": results}


def main() -> None:
    args = _parse_args()
    result = run_scheduler(args)
    print(json.dumps(result, indent=2))
    if result.get("failed", 0) > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
