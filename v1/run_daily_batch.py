"""
Daily Batch Orchestrator - runs the 4 AM cron job.

Current pipeline:
1. Build topic pools for all subscribed users (topics-based flows)

Usage:
    python v1/run_daily_batch.py
"""
import sys
from datetime import datetime
from pathlib import Path

# Add project root to path for imports (at end to not shadow external packages)
project_root = str(Path(__file__).parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from dotenv import load_dotenv  # noqa: E402
load_dotenv(Path(__file__).parent.parent / ".env")

from v1.flows.build_topics_for_all_users import (  # noqa: E402
    build_topics_for_all_users,
)
from v2.flows.build_trending_news_for_day import (  # noqa: E402
    build_trending_news_for_day,
)


def log(message: str):
    """Log with timestamp."""
    timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}")


def run_daily_batch() -> int:
    """
    Run the daily batch job.

    Returns:
        Exit code: 0 on success, 1 on critical failure
    """
    log("=" * 60)
    log("DAILY BATCH JOB STARTED")
    log("=" * 60)

    # =========================================================================
    # Phase 0: Topics build (every 4 days)
    # =========================================================================
    log("")
    log("PHASE 0: TOPICS BUILD (4-day cadence)")
    log("-" * 40)
    try:
        topics_result = build_topics_for_all_users()
        log(f"Topics build: {topics_result}")
    except Exception as e:
        log(f"✗ Topics build failed: {e}")

    # =========================================================================
    # Phase 0.5: Trending News Fetch
    # =========================================================================
    log("")
    log("PHASE 0.5: TRENDING NEWS FETCH")
    log("-" * 40)
    try:
        trending_result = build_trending_news_for_day()
        log(
            "Trending news: "
            f"{trending_result.get('total_articles', 0)} articles from "
            f"{trending_result.get('topics_with_news', 0)} topics"
        )
    except Exception as e:
        log(f"✗ Trending news fetch failed (non-critical): {e}")

    log("")
    log("=" * 60)
    log("DAILY BATCH JOB COMPLETE")
    log("=" * 60)
    return 0


def main():
    exit_code = run_daily_batch()
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
