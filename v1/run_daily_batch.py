"""
Daily Batch Orchestrator - runs the 4 AM cron job.

1. Runs Trend Discovery for each umbrella (refreshes sub_queries)
2. Runs Pool Harvester to populate retrieval_pool

Usage:
    python v1/run_daily_batch.py
"""
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Add project root to path for imports (at end to not shadow external packages)
project_root = str(Path(__file__).parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from v1.storage import FirestoreStore
from v1.models import SubQuery
from v1.core_agents.trend_discovery import discover_trends
from v1.algorithm.pool_harvester import harvest_pool


def log(message: str):
    """Log with timestamp."""
    timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}")


REFRESH_INTERVAL_DAYS = 3


def should_refresh_umbrella(umbrella: dict) -> bool:
    last_refresh = umbrella.get("last_discovery_refresh")
    if not last_refresh:
        return True
    try:
        last_dt = datetime.fromisoformat(last_refresh.replace("Z", "+00:00"))
        return datetime.utcnow() - last_dt >= timedelta(days=REFRESH_INTERVAL_DAYS)
    except (ValueError, TypeError):
        return True


def refresh_umbrella_queries(umbrella_id: str, store: FirestoreStore) -> bool:
    """
    Refresh sub-queries for a single umbrella using Trend Discovery.
    
    Returns True on success, False on failure.
    """
    try:
        log(f"  Discovering trends for '{umbrella_id}'...")
        queries = discover_trends(umbrella_id)
        
        # Create sub-queries from discovered trends
        sub_queries = []
        for i, query_text in enumerate(queries):
            sub_query = SubQuery(
                id=f"{umbrella_id}-{i}",
                text=query_text,
                source_hint="blog",
                user_count=0,
                last_searched=None
            )
            sub_queries.append(sub_query.model_dump())
        
        # Update umbrella
        store.update_umbrella(umbrella_id, {
            "sub_queries": sub_queries,
            "last_discovery_refresh": datetime.utcnow().isoformat()
        })
        
        log(f"  ✓ Updated {umbrella_id} with {len(sub_queries)} queries")
        return True
        
    except Exception as e:
        log(f"  ✗ Error refreshing {umbrella_id}: {e}")
        return False


def run_daily_batch() -> int:
    """
    Run the daily batch job.
    
    Returns:
        Exit code: 0 on success, 1 on critical failure
    """
    log("=" * 60)
    log("DAILY BATCH JOB STARTED")
    log("=" * 60)
    
    store = FirestoreStore()
    
    # =========================================================================
    # Phase 1: Trend Discovery
    # =========================================================================
    log("")
    log("PHASE 1: TREND DISCOVERY")
    log("-" * 40)
    
    umbrellas = store.get_all_umbrellas()
    log(f"Found {len(umbrellas)} umbrellas to refresh")
    
    success_count = 0
    fail_count = 0
    skipped_count = 0
    
    for umbrella in umbrellas:
        umbrella_id = umbrella.get("id")
        if not umbrella_id:
            continue
        if not should_refresh_umbrella(umbrella):
            skipped_count += 1
            log(f"  Skipping trend refresh for '{umbrella_id}' (recently updated)")
            continue
        
        if refresh_umbrella_queries(umbrella_id, store):
            success_count += 1
        else:
            fail_count += 1
    
    log(
        "Trend Discovery complete: "
        f"{success_count} succeeded, "
        f"{fail_count} failed, "
        f"{skipped_count} skipped"
    )
    
    # =========================================================================
    # Phase 2: Pool Harvesting
    # =========================================================================
    log("")
    log("PHASE 3: POOL HARVESTING")
    log("-" * 40)
    
    try:
        # Search all active queries to ensure all umbrellas get content
        # With ~35 umbrellas × 2 queries = ~70 queries
        stats = harvest_pool(max_umbrellas=30, max_queries=60, subqueries_per_umbrella=3)
        log(f"Pool Harvesting complete: {stats}")
    except Exception as e:
        log(f"✗ Pool Harvesting failed: {e}")
        return 1
    
    # =========================================================================
    # Summary
    # =========================================================================
    log("")
    log("=" * 60)
    log("DAILY BATCH JOB COMPLETE")
    log("=" * 60)
    log(f"Umbrellas refreshed: {success_count}/{len(umbrellas)}")
    log(f"Queries searched: {stats.get('queries_searched', 0)}")
    log(f"Items stored: {stats.get('items_stored', 0)}")
    log(f"Old items deleted: {stats.get('items_deleted', 0)}")
    
    # Return 0 if at least one umbrella succeeded OR everything was skipped
    if success_count > 0 or skipped_count > 0:
        return 0
    else:
        log("CRITICAL: No umbrellas were refreshed")
        return 1


def main():
    exit_code = run_daily_batch()
    sys.exit(exit_code)


if __name__ == "__main__":
    main()

