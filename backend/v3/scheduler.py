#!/usr/bin/env python3
"""
V3 pipeline scheduler.

Orchestrates the active feed builders + assembly step.

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

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

JOBS = {
    "for_you": {
        "module": "v3.build_for_you",
        "pool_cadence_days": 1,
        "description": (
            "For You (interest-matched articles with career-goal boost)"
        ),
    },
    "trending": {
        "module": "v3.build_trending",
        # Trending uses a tight freshness window (hours), so pool refresh must
        # run every execution to avoid starving the feed with stale pool data.
        "pool_cadence_days": 0,
        "description": "Trending (latest news across topics)",
    },
    "pulse": {
        "module": "v3.build_daily_pulse",
        "pool_cadence_days": 1,
        "description": "Developer Pulse (reads + community + tools)",
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
        "module": "v3.flows.send_audience_newsletter",
        "description": "Send audience newsletters (member / winback / landing buckets)",
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
            "trending",
            "pulse",
            "assemble",
            "newsletter",
            "newsletter_build",
            "newsletter_send",
        ],
        help=(
            "Jobs to run. 'all' runs everything. "
            "'pools' runs pool refresh for active feed builders. "
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
        default="all",
        help="Which audience to build feeds for",
    )
    p.add_argument(
        "--tier",
        choices=["pro", "free"],
        default="pro",
        help="User tier - 'free' generates fewer items",
    )
    p.add_argument(
        "--enrich-coverage",
        action="store_true",
        help="Enrich thin trending topics via Firecrawl (trending job only)",
    )
    p.add_argument(
        "--skip-notifications",
        action="store_true",
        help="Skip interest push notifications (trending job only)",
    )
    p.add_argument("--enrich-top", type=int, default=10)
    p.add_argument("--enrich-max-per-topic", type=int, default=4)
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Build the newsletter but do not send it",
    )
    return p.parse_args()


def _run_module(module: str, extra_args: list[str]) -> int:
    cmd = [sys.executable, "-m", module] + extra_args
    _log(f"Running: {' '.join(cmd)}")
    start = time.time()
    result = subprocess.run(cmd, cwd=str(BACKEND_ROOT))
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
    user_scoped: bool,
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

    # User-scoped builds should be cheap by default: reuse existing pool data.
    # Callers can still force pool refresh via --force-pools / --jobs pools.
    if user_scoped and not run_pools and not args.force_pools:
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
    run_all = "all" in requested

    # Guardrail: user-scoped "all" should only build that user's For You lane.
    if args.user_id and run_all:
        requested = {"for_you"}
        run_all = False
        _log(
            "User-scoped run with --jobs all detected; "
            "limiting to for_you."
        )

    run_pools = "pools" in requested
    run_feeds = "feeds" in requested
    user_scoped = bool(args.user_id)

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
    # enrichment flags travel only to the trending job (stripped elsewhere)
    if args.enrich_coverage:
        extra.append("--enrich-coverage")
    if args.skip_notifications:
        extra.append("--skip-notifications")
    if args.enrich_top != 10:
        extra.extend(["--enrich-top", str(args.enrich_top)])
    if args.enrich_max_per_topic != 4:
        extra.extend(["--enrich-max-per-topic", str(args.enrich_max_per_topic)])

    def _strip_enrich(args_list: list[str]) -> list[str]:
        """Remove valueless --enrich-coverage and valued enrich flags."""
        out: list[str] = []
        skip_next = False
        for a in args_list:
            if skip_next:
                skip_next = False
                continue
            if a in ("--enrich-top", "--enrich-max-per-topic"):
                skip_next = True
                continue
            if a in ("--enrich-coverage", "--skip-notifications"):
                continue
            out.append(a)
        return out

    extra_no_enrich = _strip_enrich(extra)

    build_jobs = ["for_you", "pulse", "trending"]
    users_file = ""

    _log("=== V3 Pipeline Start ===")
    _log(f"Audience: {args.audience}")
    start = time.time()

    # Only assemble still truly needs a precomputed user snapshot.
    # For You now builds shared role pulses and can read users directly.
    needs_user_snapshot = run_all or "assemble" in requested

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
                user_scoped=user_scoped,
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

        def _filter_args(args: list[str], exclude: tuple[str, ...]) -> list[str]:
            """Filter out arguments and their values from the args list."""
            result = []
            skip_next = False
            for i, arg in enumerate(args):
                if skip_next:
                    skip_next = False
                    continue
                if arg in exclude:
                    skip_next = True  # Skip the value too
                    continue
                result.append(arg)
            return result

        def _run_job(name_job_mode: tuple[str, dict, str]) -> tuple[str, int, bool]:
            name, job, mode = name_job_mode
            _log(f"--- {job['description']} (parallel) ---")
            # Filter out unsupported args per job
            # --tier is not yet supported by any build script
            # Trending is global, doesn't need user-specific args
            if name == "trending":
                job_extra = _filter_args(extra, ("--audience", "--users-file", "--tier", "--user-id"))
            else:
                job_extra = _filter_args(extra_no_enrich, ("--tier",))
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
        def _filter_args_seq(args: list[str], exclude: tuple[str, ...]) -> list[str]:
            """Filter out arguments and their values from the args list."""
            result = []
            skip_next = False
            for i, arg in enumerate(args):
                if skip_next:
                    skip_next = False
                    continue
                if arg in exclude:
                    skip_next = True
                    continue
                result.append(arg)
            return result

        for job_name, job, mode in jobs_to_run:
            _log(f"--- {job['description']} ---")
            # Filter out unsupported args per job
            if job_name == "trending":
                job_extra = _filter_args_seq(extra, ("--audience", "--users-file", "--tier", "--user-id"))
            else:
                job_extra = _filter_args_seq(extra_no_enrich, ("--tier",))
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
        # Filter out --tier as assemble doesn't support it
        assemble_extra = [a for i, a in enumerate(_strip_enrich(extra)) if a != "--tier" and (i == 0 or _strip_enrich(extra)[i-1] != "--tier")]
        _run_module(JOBS["assemble"]["module"], assemble_extra)

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

        # Unified newsletter generation remains available as an explicit legacy job.
        # The normal daily newsletter uses each user's already-built v3 feed.
        if "newsletter_build" in requested:
            _log("--- Build newsletter ---")
            nl_rc = _run_module(JOBS["newsletter_build"]["module"], nl_build_args)
            if nl_rc != 0:
                _log(f"ERROR: newsletter build exited with code {nl_rc}")
                sys.exit(nl_rc)

        if run_all or "newsletter" in requested or "newsletter_send" in requested:
            _log("--- Send newsletter ---")
            # The audience newsletter resolves its own buckets (member /
            # winback / landing), so it takes no --user-id or --audience flags.
            nl_send_args = []
            if nl_date:
                nl_send_args.extend(["--date", nl_date])
            if args.dry_run:
                nl_send_args.append("--dry-run")
            nl_send_rc = _run_module(JOBS["newsletter_send"]["module"], nl_send_args)
            if nl_send_rc != 0:
                _log(f"ERROR: newsletter send exited with code {nl_send_rc}")
                sys.exit(nl_send_rc)

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
