"""
Master Scheduler - orchestrates all daily jobs in correct order.

This is the ONE script to run via cron. It handles:
- 4:00 AM: run_daily_batch.py (Trend Discovery + Pool Harvest)
- 5:00 AM: run_user_feeds.py (Generate feeds for all users)
- 6:00 AM: build_newsletters_for_all_users.py (Build paid newsletters)
- 6:10 AM: build_free_newsletter.py (Build free newsletter from best summaries)
- 6:30 AM: send_newsletters_for_all_users.py (Send paid newsletters)
- 6:40 AM: send_free_newsletter.py (Send free newsletter to free subscribers)
- 11:00 PM: run_daily_reflection.py (Process day's interactions)
- 11:30 PM: cleanup_expired_signals.py

Usage:
    python v1/scheduler.py --jobs all           # Run all jobs
    python v1/scheduler.py --jobs morning       # Run morning jobs (batch + feeds + newsletters)
    python v1/scheduler.py --jobs evening       # Run evening jobs (reflection + cleanup)
    python v1/scheduler.py --jobs batch         # Run only batch job
    python v1/scheduler.py --jobs feeds         # Run only feeds job
    python v1/scheduler.py --jobs newsletters   # Run only newsletter jobs (build + send, paid + free)
    python v1/scheduler.py --jobs reflection    # Run only reflection job
    python v1/scheduler.py --jobs cleanup       # Run only cleanup job
"""
import argparse
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Callable

project_root = str(Path(__file__).parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")


def log(message: str):
    """Log with timestamp."""
    timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}")


def run_job(name: str, job_fn: Callable) -> dict:
    """
    Run a single job with timing and error handling.
    
    Args:
        name: Job name for logging
        job_fn: Function to run
    
    Returns:
        Dict with success, duration, result/error
    """
    log(f"Starting {name}...")
    start_time = time.time()
    
    try:
        result = job_fn()
        duration = time.time() - start_time
        log(f"✓ {name} complete ({duration:.1f}s)")
        return {
            "name": name,
            "success": True,
            "duration": duration,
            "result": result
        }
    except Exception as e:
        duration = time.time() - start_time
        log(f"✗ {name} failed: {e}")
        return {
            "name": name,
            "success": False,
            "duration": duration,
            "error": str(e)
        }


def job_daily_batch():
    """Run daily batch (Trend Discovery + Pool Harvest)."""
    from v1.run_daily_batch import run_daily_batch
    exit_code = run_daily_batch()
    if exit_code != 0:
        raise RuntimeError(f"Daily batch failed with exit code {exit_code}")
    return {"exit_code": exit_code}


def job_user_feeds():
    """Generate feeds for all subscribed users (trial or paid)."""
    from v1.run_user_feeds import run_user_feeds
    return run_user_feeds()


def job_daily_reflection():
    """Run reflection for all subscribed users (trial or paid)."""
    from v1.run_daily_reflection import run_daily_reflection
    return run_daily_reflection()


def job_cleanup_signals():
    """Cleanup expired signals."""
    from v1.scripts.cleanup_expired_signals import cleanup_expired_signals
    return cleanup_expired_signals()


def job_build_newsletters():
    """Build newsletters for all opted-in subscribed users."""
    from v1.flows.build_newsletters_for_all_users import build_newsletters_for_all_users
    return build_newsletters_for_all_users()


def job_send_newsletters():
    """Send newsletters for all users with draft newsletters."""
    from v1.flows.send_newsletter_for_user import send_newsletters_for_all_users
    return send_newsletters_for_all_users()


def job_build_free_newsletter():
    """Build free newsletter from best summaries across subscribed users."""
    from v1.flows.build_free_newsletter import build_free_newsletter
    return build_free_newsletter()


def job_send_free_newsletter():
    """Send free newsletter to all free subscribers."""
    from v1.flows.send_free_newsletter import send_free_newsletter
    return send_free_newsletter()


# Job definitions with scheduled times (for documentation)
JOBS = {
    "batch": {
        "fn": job_daily_batch,
        "description": "Trend Discovery + Pool Harvest",
        "scheduled_time": "4:00 AM"
    },
    "feeds": {
        "fn": job_user_feeds,
        "description": "Generate feeds for all users",
        "scheduled_time": "5:00 AM"
    },
    "build_newsletters": {
        "fn": job_build_newsletters,
        "description": "Build newsletters for subscribed users",
        "scheduled_time": "6:00 AM"
    },
    "build_free_newsletter": {
        "fn": job_build_free_newsletter,
        "description": "Build free newsletter from best summaries",
        "scheduled_time": "6:10 AM"
    },
    "send_newsletters": {
        "fn": job_send_newsletters,
        "description": "Send newsletters to subscribed users",
        "scheduled_time": "6:30 AM"
    },
    "send_free_newsletter": {
        "fn": job_send_free_newsletter,
        "description": "Send free newsletter to free subscribers",
        "scheduled_time": "6:40 AM"
    },
    "reflection": {
        "fn": job_daily_reflection,
        "description": "Process day's interactions",
        "scheduled_time": "11:00 PM"
    },
    "cleanup": {
        "fn": job_cleanup_signals,
        "description": "Cleanup expired signals",
        "scheduled_time": "11:30 PM"
    }
}

# Job groups
JOB_GROUPS = {
    "all": ["batch", "feeds", "build_newsletters", "build_free_newsletter", "send_newsletters", "send_free_newsletter", "reflection", "cleanup"],
    "morning": ["batch", "feeds", "build_newsletters", "build_free_newsletter", "send_newsletters", "send_free_newsletter"],
    "evening": ["reflection", "cleanup"],
    "newsletters": ["build_newsletters", "build_free_newsletter", "send_newsletters", "send_free_newsletter"]
}


def run_scheduler(jobs_arg: str) -> dict:
    """
    Run the scheduler with specified jobs.
    
    Args:
        jobs_arg: Job name, group name, or 'all'
    
    Returns:
        Summary dict with succeeded, failed, total_duration
    """
    # Determine which jobs to run
    if jobs_arg in JOB_GROUPS:
        job_names = JOB_GROUPS[jobs_arg]
    elif jobs_arg in JOBS:
        job_names = [jobs_arg]
    else:
        raise ValueError(f"Unknown job or group: {jobs_arg}. Available: {list(JOBS.keys())} or {list(JOB_GROUPS.keys())}")
    
    log("=" * 60)
    log(f"SCHEDULER STARTING - Jobs: {job_names}")
    log("=" * 60)
    
    start_time = time.time()
    results = []
    
    for job_name in job_names:
        job = JOBS[job_name]
        log("")
        log(f"--- {job_name.upper()}: {job['description']} ---")
        
        result = run_job(job_name, job["fn"])
        results.append(result)
    
    # Summary
    total_duration = time.time() - start_time
    succeeded = sum(1 for r in results if r["success"])
    failed = sum(1 for r in results if not r["success"])
    
    # Format duration
    if total_duration >= 60:
        duration_str = f"{int(total_duration // 60)}m {int(total_duration % 60)}s"
    else:
        duration_str = f"{total_duration:.1f}s"
    
    log("")
    log("=" * 60)
    log("SCHEDULER COMPLETE")
    log("=" * 60)
    
    for result in results:
        status = "✓" if result["success"] else "✗"
        log(f"  {status} {result['name']}: {result['duration']:.1f}s")
    
    log("")
    log(f"Daily pipeline complete: {succeeded} jobs succeeded, {failed} failed, {duration_str} total")
    
    return {
        "jobs_requested": jobs_arg,
        "jobs_run": job_names,
        "succeeded": succeeded,
        "failed": failed,
        "total_duration": total_duration,
        "results": results
    }


def main():
    parser = argparse.ArgumentParser(
        description="Master scheduler for daily jobs",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Job Groups:
  all         - Run all jobs (batch, feeds, newsletters, reflection, cleanup)
  morning     - Run morning jobs (batch, feeds, all newsletters)
  evening     - Run evening jobs (reflection, cleanup)
  newsletters - Run all newsletter jobs (build + send, paid + free)

Individual Jobs:
  batch                - Trend Discovery + Pool Harvest (4:00 AM)
  feeds                - Generate feeds for all users (5:00 AM)
  build_newsletters    - Build newsletters for subscribed users (6:00 AM)
  build_free_newsletter - Build free newsletter from best summaries (6:10 AM)
  send_newsletters     - Send newsletters to subscribed users (6:30 AM)
  send_free_newsletter - Send free newsletter to free subscribers (6:40 AM)
  reflection           - Process day's interactions (11:00 PM)
  cleanup              - Cleanup expired signals (11:30 PM)

Examples:
  python v1/scheduler.py --jobs all
  python v1/scheduler.py --jobs morning
  python v1/scheduler.py --jobs newsletters
  python v1/scheduler.py --jobs build_free_newsletter
  python v1/scheduler.py --jobs reflection
"""
    )
    parser.add_argument(
        "--jobs",
        required=True,
        help="Job name, group name (all/morning/evening), or individual job"
    )
    args = parser.parse_args()
    
    try:
        result = run_scheduler(args.jobs)
        
        # Exit with error code if any job failed
        if result["failed"] > 0:
            sys.exit(1)
    except ValueError as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()

