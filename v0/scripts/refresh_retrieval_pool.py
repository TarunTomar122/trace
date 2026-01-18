#!/usr/bin/env python3
import argparse
import json
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path

sys.path.append(str(Path(__file__).parent.parent))

from storage import get_store


def run_fetch(source: str, query: str, content_type: str | None, max_results: int) -> list:
    if source == "arxiv":
        result = subprocess.run(
            ["python", "scripts/fetch_arxiv.py", query, str(max_results)],
            capture_output=True,
            text=True,
            check=False,
        )
    elif source == "youtube":
        result = subprocess.run(
            ["python", "scripts/fetch_youtube.py", query, str(max_results)],
            capture_output=True,
            text=True,
            check=False,
        )
    elif source == "exa":
        if not content_type:
            raise ValueError("content_type is required for exa")
        result = subprocess.run(
            ["python", "scripts/fetch_exa.py", query, content_type, str(max_results)],
            capture_output=True,
            text=True,
            check=False,
        )
    else:
        raise ValueError(f"Unsupported source: {source}")

    if result.returncode != 0:
        raise RuntimeError(result.stderr)
    return json.loads(result.stdout)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, choices=["arxiv", "youtube", "exa"])
    parser.add_argument("--content-type", default=None)
    parser.add_argument("--topics", required=True, help="Comma-separated list of topics")
    parser.add_argument("--max-results", type=int, default=10)
    parser.add_argument("--ttl-hours", type=int, default=24)
    args = parser.parse_args()

    store = get_store()
    topics = [t.strip() for t in args.topics.split(",") if t.strip()]
    source_label = f"{args.source}" + (f" ({args.content_type})" if args.content_type else "")

    print(f"    📥 Fetching from {source_label} for {len(topics)} topics...")
    total_items = 0
    for i, topic in enumerate(topics, 1):
        try:
            items = run_fetch(args.source, topic, args.content_type, args.max_results)
            now = datetime.utcnow()
            key = f"{args.source}:{args.content_type or 'all'}:{topic}".lower().replace(" ", "_")
            payload = {
                "items": items,
                "updated_at": now.isoformat(),
                "expires_at": (now + timedelta(hours=args.ttl_hours)).isoformat(),
                "source": args.source,
                "content_type": args.content_type,
                "topic": topic,
            }
            store.set_retrieval_pool_entry(key, payload)
            total_items += len(items)
            print(f"      [{i}/{len(topics)}] {topic}: {len(items)} items")
        except Exception as e:
            print(f"      [{i}/{len(topics)}] {topic}: ❌ Failed - {e}")
    print(f"    ✅ {source_label}: {total_items} total items stored")


if __name__ == "__main__":
    main()

