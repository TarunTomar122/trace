#!/usr/bin/env python3
import argparse
import sys
from datetime import datetime
from pathlib import Path

sys.path.append(str(Path(__file__).parent.parent))

from storage import get_store


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--queries", required=True, help="Comma-separated list of trending queries")
    args = parser.parse_args()

    queries = [q.strip() for q in args.queries.split(",") if q.strip()]
    payload = {"updated_at": datetime.utcnow().isoformat(), "queries": queries}
    store = get_store()
    store.set_trending_queries(payload)
    print(f"Updated trending queries: {len(queries)} items")


if __name__ == "__main__":
    main()

