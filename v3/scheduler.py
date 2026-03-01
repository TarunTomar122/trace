#!/usr/bin/env python3
"""
V3 pipeline scheduler.

Orchestrates the three feed builders + assembly step.

Usage:
  python3 -m v3.scheduler                             # run all (feeds + newsletter)
  python3 -m v3.scheduler --jobs for_you trending     # specific feed jobs
  python3 -m v3.scheduler --jobs pools                 # pool refresh only
  python3 -m v3.scheduler --jobs feeds                 # feed build only (skip pools)
  python3 -m v3.scheduler --jobs assemble              # assembly only
  python3 -m v3.scheduler --jobs newsletter            # build + send newsletter only
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

JOBS = {
    "for_you": {
        "module": "v3.build_for_you",
        "pool_cadence_days": 4,
        "description": (
            "For You (interest-matched articles with career-goal boost)"
        ),
    },
    "deep_dives": {
        "module": "v3.build_deep_dives",
        "pool_cadence_days": 4,
        "description": (
            "Deep Dives (expert content from user-selected sources)"
        ),
    },
    "trending": {
        "module": "v3.build_trending",
        "pool_cadence_days": 1,  # Trending should refresh daily for fresh news
        "description": "Trending (latest news across topics)",
    },
    "assemble": {
        "module": "v3.assemble_feeds",
        "pool_cadence_days": 0,
        "description": "Assemble final feeds from all 3 sections",
    },
    "newsletter_build": {
        "module": "v2.flows.build_unified_newsletter",
        "pool_cadence_days": 0,
        "description": "Build daily newsletter from trending feed",
    },
    "newsletter_send": {
        "module": "v2.flows.send_unified_newsletter",
        "pool_cadence_days": 0,
        "description": "Send daily newsletter to all signups",
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
        choices=[
            "all",
            "pools",
            "feeds",
            "for_you",
            "deep_dives",
            "trending",
            "assemble",
            "newsletter",
            "newsletter_build",
            "newsletter_send",
        ],
        help=(
            "Jobs to run. 'all' runs everything. "
            "'pools' runs pool refresh for all 3. "
            "'feeds' skips pools."
        ),
    )
    p.add_argument("--date", default="", help="Date override (YYYY-MM-DD)")
    p.add_argument("--user-id", default="", help="Single user")
    p.add_argument("--limit-users", type=int, default=0)
    p.add_argument(
        "--force-pools",
        action="store_true",
        help="Force pool refresh regardless of cadence",
    )
    p.add_argument(
        "--audience",
        choices=["subscribed", "unsubscribed", "all"],
        default="subscribed",
        help="Which audience to build feeds for",
    )
    p.add_argument(
        "--tier",
        choices=["pro", "free"],
        default="pro",
        help="User tier - 'free' generates fewer items",
    )
    return p.parse_args()


def _run_module(module: str, extra_args: list[str]) -> int:
    cmd = [sys.executable, "-m", module] + extra_args
    _log(f"Running: {' '.join(cmd)}")
    start = time.time()
    result = subprocess.run(cmd, cwd=str(REPO_ROOT))
    elapsed = time.time() - start
    _log(f"  Finished in {elapsed:.1f}s (exit={result.returncode})")
    return result.returncode


def _pool_mode_for_job(
    *,
    args: argparse.Namespace,
    job_name: str,
    cadence_days: int,
    store,
    run_all: bool,
    run_pools: bool,
    run_feeds: bool,
) -> str:
    """
    Returns one of:
      - "full": run pool + feeds
      - "skip_pool": run feed only
      - "pool_only": run pool only
      - "skip_job": nothing to do
    """
    if run_feeds:
        return "skip_pool"

    if run_pools:
        if args.force_pools:
            return "pool_only"
        pool_key = f"{job_name}_pool"
        should_refresh = cadence_days <= 0 or store.should_run(pool_key, cadence_days)
        return "pool_only" if should_refresh else "skip_job"

    if args.force_pools:
        return "full"

    if cadence_days <= 0:
        return "full"

    pool_key = f"{job_name}_pool"
    should_refresh = store.should_run(pool_key, cadence_days)
    return "full" if should_refresh else "skip_pool"


def _write_users_snapshot(audience: str, user_id: str = "") -> str:
    from v3.lib.store import V3Store

    store = V3Store()
    if user_id:
        profile = store.get_user_profile(user_id)
        users = [profile] if profile else []
    else:
        users = store.get_onboarded_users(audience)
    fd, path = tempfile.mkstemp(prefix="v3_users_", suffix=".json")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(users, f)
    _log(f"Wrote user snapshot: {len(users)} users -> {path}")
    return path


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
    if args.audience:
        extra.extend(["--audience", args.audience])
    if args.tier:
        extra.extend(["--tier", args.tier])

    run_all = "all" in requested
    run_pools = "pools" in requested
    run_feeds = "feeds" in requested

    build_jobs = ["for_you", "deep_dives", "trending"]
    users_file = ""

    _log("=== V3 Pipeline Start ===")
    _log(f"Audience: {args.audience}")
    start = time.time()

    needs_user_snapshot = (
        run_all
        or run_feeds
        or "assemble" in requested
        or any(job_name in requested for job_name in build_jobs)
    )

    if needs_user_snapshot:
        try:
            users_file = _write_users_snapshot(args.audience, args.user_id)
            extra.extend(["--users-file", users_file])
        except Exception as exc:
            _log(f"WARNING: Could not write users snapshot ({exc}); falling back to per-job user reads")

    try:
        from v3.lib.store import V3Store
        cadence_store = V3Store()
    except Exception as exc:
        _log(f"WARNING: Cadence store unavailable ({exc}); defaulting to pool refresh")
        cadence_store = None

    jobs_to_run: list[tuple[str, dict, str]] = []
    for job_name in build_jobs:
        job = JOBS[job_name]
        should_run = run_all or run_pools or run_feeds or job_name in requested
        if not should_run:
            continue

        cadence_days = int(job.get("pool_cadence_days", 0))
        mode = "full"
        if cadence_store is not None:
            mode = _pool_mode_for_job(
                args=args,
                job_name=job_name,
                cadence_days=cadence_days,
                store=cadence_store,
                run_all=run_all,
                run_pools=run_pools,
                run_feeds=run_feeds,
            )
        elif run_pools:
            mode = "pool_only"
        elif run_feeds:
            mode = "skip_pool"

        if mode == "skip_job":
            _log(
                f"--- {job['description']} --- skipped "
                f"(pool cadence={cadence_days}d, use --force-pools to override)"
            )
            continue
        jobs_to_run.append((job_name, job, mode))

    if len(jobs_to_run) > 1:
        _log(f"Running {len(jobs_to_run)} feed builders in parallel")

        def _run_job(name_job_mode: tuple[str, dict, str]) -> tuple[str, int, bool]:
            name, job, mode = name_job_mode
            _log(f"--- {job['description']} (parallel) ---")
            # Trending is global (not per-user), so skip user-specific args
            if name == "trending":
                job_extra = [a for i, a in enumerate(extra) if a not in ("--audience", "--users-file") and (i == 0 or extra[i-1] not in ("--audience", "--users-file"))]
            else:
                job_extra = list(extra)
            if mode == "pool_only":
                job_extra.append("--pool-only")
            elif mode == "skip_pool":
                job_extra.append("--skip-pool")
            rc = _run_module(job["module"], job_extra)
            return name, rc, mode in ("full", "pool_only")

        with ThreadPoolExecutor(max_workers=3) as executor:
            futures = {executor.submit(_run_job, j): j[0] for j in jobs_to_run}
            for f in as_completed(futures):
                name, rc, ran_pool = f.result()
                if rc != 0:
                    _log(f"WARNING: {name} exited with code {rc}")
                elif ran_pool and cadence_store is not None:
                    cadence_store.record_run(f"{name}_pool", {"mode": "scheduler"})
    else:
        for job_name, job, mode in jobs_to_run:
            _log(f"--- {job['description']} ---")
            # Trending is global (not per-user), so skip user-specific args
            if job_name == "trending":
                job_extra = [a for i, a in enumerate(extra) if a not in ("--audience", "--users-file") and (i == 0 or extra[i-1] not in ("--audience", "--users-file"))]
            else:
                job_extra = list(extra)
            if mode == "pool_only":
                job_extra.append("--pool-only")
            elif mode == "skip_pool":
                job_extra.append("--skip-pool")
            rc = _run_module(job["module"], job_extra)
            if rc != 0:
                _log(f"WARNING: {job_name} exited with code {rc}")
            elif mode in ("full", "pool_only") and cadence_store is not None:
                cadence_store.record_run(f"{job_name}_pool", {"mode": "scheduler"})

    if run_all or "assemble" in requested:
        _log("--- Assemble feeds ---")
        _run_module(JOBS["assemble"]["module"], extra)

    run_newsletter = (
        run_all
        or "newsletter" in requested
        or "newsletter_build" in requested
        or "newsletter_send" in requested
    )
    if run_newsletter:
        nl_date = args.date or ""
        nl_build_args = []
        if nl_date:
            nl_build_args.extend(["--date", nl_date])

        if run_all or "newsletter" in requested or "newsletter_build" in requested:
            _log("--- Build newsletter ---")
            _run_module(JOBS["newsletter_build"]["module"], nl_build_args)

        if run_all or "newsletter" in requested or "newsletter_send" in requested:
            _log("--- Send newsletter ---")
            nl_send_args = list(nl_build_args) + ["--recipient-mode", "all_signups"]
            _run_module(JOBS["newsletter_send"]["module"], nl_send_args)

    elapsed = time.time() - start
    _log(f"=== V3 Pipeline Done ({elapsed:.1f}s) ===")

    if users_file:
        try:
            os.remove(users_file)
            _log(f"Deleted user snapshot: {users_file}")
        except OSError:
            pass

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
