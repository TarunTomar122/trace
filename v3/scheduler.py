#!/usr/bin/env python3
"""
V3 pipeline scheduler.

Orchestrates the three feed builders + assembly step.

Usage:
  python3 -m v3.scheduler                             # run all
  python3 -m v3.scheduler --jobs for_you trending     # specific jobs
  python3 -m v3.scheduler --jobs pools                 # pool refresh only
  python3 -m v3.scheduler --jobs feeds                 # feed build only (skip pools)
  python3 -m v3.scheduler --jobs assemble              # assembly only
"""

from __future__ import annotations

import argparse
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

JOBS = {
    "for_you": {
        "module": "v3.build_for_you",
        "pool_cadence_days": 1,
        "description": "For You (interest-matched articles with career-goal boost)",
    },
    "deep_dives": {
        "module": "v3.build_deep_dives",
        "pool_cadence_days": 3,
        "description": "Deep Dives (expert content from user-selected sources)",
    },
    "trending": {
        "module": "v3.build_trending",
        "pool_cadence_days": 0,
        "description": "Trending (latest news across topics)",
    },
    "assemble": {
        "module": "v3.assemble_feeds",
        "pool_cadence_days": 0,
        "description": "Assemble final feeds from all 3 sections",
    },
}


def _log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] [v3-scheduler] {msg}")


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="V3 pipeline scheduler")
    p.add_argument(
        "--jobs",
        nargs="+",
        default=["all"],
        choices=["all", "pools", "feeds", "for_you", "deep_dives", "trending", "assemble"],
        help="Jobs to run. 'all' runs everything. 'pools' runs pool refresh for all 3. 'feeds' skips pools.",
    )
    p.add_argument("--date", default="", help="Date override (YYYY-MM-DD)")
    p.add_argument("--user-id", default="", help="Single user")
    p.add_argument("--limit-users", type=int, default=0)
    p.add_argument("--force-pools", action="store_true", help="Force pool refresh regardless of cadence")
    return p.parse_args()


def _run_module(module: str, extra_args: list[str]) -> int:
    cmd = [sys.executable, "-m", module] + extra_args
    _log(f"Running: {' '.join(cmd)}")
    start = time.time()
    result = subprocess.run(cmd, cwd=str(REPO_ROOT))
    elapsed = time.time() - start
    _log(f"  Finished in {elapsed:.1f}s (exit={result.returncode})")
    return result.returncode


def main() -> None:
    args = _parse_args()
    requested = set(args.jobs)

    extra: list[str] = []
    if args.date:
        extra.extend(["--date", args.date])
    if args.user_id:
        extra.extend(["--user-id", args.user_id])
    if args.limit_users > 0:
        extra.extend(["--limit-users", str(args.limit_users)])

    run_all = "all" in requested
    run_pools = "pools" in requested
    run_feeds = "feeds" in requested

    build_jobs = ["for_you", "deep_dives", "trending"]

    _log("=== V3 Pipeline Start ===")
    start = time.time()

    for job_name in build_jobs:
        job = JOBS[job_name]
        should_run = (
            run_all
            or run_pools
            or run_feeds
            or job_name in requested
        )
        if not should_run:
            continue

        _log(f"--- {job['description']} ---")

        job_extra = list(extra)
        if run_pools:
            job_extra.append("--pool-only")
        elif run_feeds:
            job_extra.append("--skip-pool")

        rc = _run_module(job["module"], job_extra)
        if rc != 0:
            _log(f"WARNING: {job_name} exited with code {rc}")

    if run_all or "assemble" in requested:
        _log("--- Assemble feeds ---")
        _run_module(JOBS["assemble"]["module"], extra)

    elapsed = time.time() - start
    _log(f"=== V3 Pipeline Done ({elapsed:.1f}s) ===")

    if args.user_id:
        try:
            from v3.lib.store import V3Store
            store = V3Store()
            store.set_feed_build_status(args.user_id, "ready")
            _log(f"Set feedBuildStatus=ready for user {args.user_id}")
        except Exception as e:
            _log(f"WARNING: Could not set feedBuildStatus: {e}")


if __name__ == "__main__":
    main()
