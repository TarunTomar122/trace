"""
Master Scheduler - orchestrates all daily jobs in correct order.

This is the ONE script to run via cron. It handles:
- 4:00 AM: run_daily_batch.py (Trend Discovery + Pool Harvest)
- 5:00 AM: run_user_feeds.py (Generate feeds for all users)
- 11:00 PM: run_daily_reflection.py (Process day's interactions)
- 11:30 PM: cleanup_expired_signals.py

Usage:
    python v1/scheduler.py --jobs all           # Run all jobs
    python v1/scheduler.py --jobs morning       # Run morning jobs (batch + feeds)
    python v1/scheduler.py --jobs evening       # Run evening jobs (reflection + cleanup)
    python v1/scheduler.py --jobs batch         # Run only batch job
    python v1/scheduler.py --jobs feeds         # Run only feeds job
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
    "all": ["batch", "feeds", "reflection", "cleanup"],
    "morning": ["batch", "feeds"],
    "evening": ["reflection", "cleanup"]
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
  all       - Run all jobs (batch, feeds, reflection, cleanup)
  morning   - Run morning jobs (batch, feeds)
  evening   - Run evening jobs (reflection, cleanup)

Individual Jobs:
  batch      - Trend Discovery + Pool Harvest (4:00 AM)
  feeds      - Generate feeds for all users (5:00 AM)
  reflection - Process day's interactions (11:00 PM)
  cleanup    - Cleanup expired signals (11:30 PM)

Examples:
  python v1/scheduler.py --jobs all
  python v1/scheduler.py --jobs morning
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

