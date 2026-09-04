#!/usr/bin/env python3
"""Compare local document hashes with an export manifest or live Firestore."""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.localdb import LocalDocumentStore, stable_document_hash, validate_document_path, validate_local_file_path  # noqa: E402
from backend.scripts.migrate_firestore_to_local import (  # noqa: E402
    _firestore_client,
    _read_collection_groups,
    _read_selectors,
    collection_group_matches_path,
    iter_firestore_collection_group,
    iter_firestore_selector,
    selector_matches_path,
)


def _expected_from_manifest(
    path: Path,
    selectors: list[str],
    collection_groups: list[str] | None = None,
    all_documents: bool = False,
) -> dict[str, str]:
    collection_groups = collection_groups or []
    expected: dict[str, str] = {}
    with path.open(encoding="utf-8") as manifest:
        for line_number, line in enumerate(manifest, 1):
            if not line.strip():
                continue
            try:
                payload = json.loads(line)
                if not isinstance(payload, dict) or not isinstance(payload.get("path"), str):
                    raise ValueError
                document_path = validate_document_path(payload["path"])
                data = payload.get("data")
                document_hash = payload.get("hash")
                if not isinstance(data, dict) or not isinstance(document_hash, str):
                    raise ValueError
                if stable_document_hash(document_path, data) != document_hash:
                    raise ValueError
            except (json.JSONDecodeError, ValueError) as error:
                raise ValueError(f"manifest line {line_number} is invalid") from error
            if all_documents or any(selector_matches_path(selector, document_path) for selector in selectors) or any(
                collection_group_matches_path(collection_group, document_path)
                for collection_group in collection_groups
            ):
                previous = expected.get(document_path)
                if previous is not None and previous != document_hash:
                    raise ValueError("manifest contains conflicting hashes for one path")
                expected[document_path] = document_hash
    return expected


def _expected_from_firestore(
    client: Any,
    selectors: list[str],
    collection_groups: list[str] | None = None,
) -> dict[str, str]:
    collection_groups = collection_groups or []
    expected: dict[str, str] = {}
    for selector in selectors:
        for record in iter_firestore_selector(client, selector):
            previous = expected.get(record["path"])
            if previous is not None and previous != record["hash"]:
                raise ValueError("Firestore selectors returned conflicting hashes for one path")
            expected[record["path"]] = record["hash"]
    for collection_group in collection_groups:
        for record in iter_firestore_collection_group(client, collection_group):
            previous = expected.get(record["path"])
            if previous is not None and previous != record["hash"]:
                raise ValueError("Firestore selectors returned conflicting hashes for one path")
            expected[record["path"]] = record["hash"]
    return expected


def _local_hashes(
    store: LocalDocumentStore,
    selectors: list[str],
    collection_groups: list[str] | None = None,
    all_documents: bool = False,
) -> dict[str, str]:
    collection_groups = collection_groups or []
    actual: dict[str, str] = {}
    roots = sorted({selector.split("/", 1)[0] for selector in selectors})
    if all_documents:
        return {document["path"]: document["hash"] for document in store.iter_all_documents()}
    if collection_groups:
        with sqlite3.connect(str(store.db_path)) as connection:
            roots = sorted(
                set(roots).union(
                    row[0] for row in connection.execute("SELECT DISTINCT collection FROM documents")
                )
            )
    for root in roots:
        for document in store.iter_documents(root):
            if any(selector_matches_path(selector, document["path"]) for selector in selectors) or any(
                collection_group_matches_path(collection_group, document["path"])
                for collection_group in collection_groups
            ):
                actual[document["path"]] = document["hash"]
    return actual


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="verify local document hash parity")
    parser.add_argument("--collection", dest="collections", action="append", default=[])
    parser.add_argument("--collection-group", dest="collection_groups", action="append", default=[])
    parser.add_argument("--collections-file")
    parser.add_argument("--all", action="store_true", help="verify every document in the manifest and local store")
    parser.add_argument("--db", default="localdb.sqlite3")
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--manifest")
    source.add_argument("--firestore", action="store_true")
    parser.add_argument("--project-id")
    parser.add_argument("--max-items", type=int, default=20)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        if args.max_items < 1:
            raise ValueError("--max-items must be positive")
        collection_groups = _read_collection_groups(args.collection_groups)
        selectors = _read_selectors(args.collections, args.collections_file, allow_empty=bool(collection_groups or args.all))
        if args.all and (args.collections or args.collections_file or args.collection_groups):
            raise ValueError("--all cannot be combined with explicit collection selectors")
        if not selectors and not collection_groups and not args.all:
            raise ValueError("at least one explicit collection selector is required")
        db_path = validate_local_file_path(args.db)
        if not db_path.exists():
            raise ValueError("local database does not exist")
        store = LocalDocumentStore(db_path)
        if args.manifest:
            expected = _expected_from_manifest(
                validate_local_file_path(args.manifest), selectors, collection_groups, args.all
            )
            source = "manifest"
        else:
            expected = _expected_from_firestore(
                _firestore_client(args.project_id), selectors, collection_groups
            )
            source = "firestore"
        actual = _local_hashes(store, selectors, collection_groups, args.all)
        missing = sorted(set(expected) - set(actual))
        extra = sorted(set(actual) - set(expected))
        mismatches = sorted(path for path in set(expected) & set(actual) if expected[path] != actual[path])
        report = {
            "ok": not missing and not extra and not mismatches,
            "source": source,
            "selectors": len(selectors) + len(collection_groups),
            "expected_count": len(expected),
            "local_count": len(actual),
            "missing_count": len(missing),
            "extra_count": len(extra),
            "hash_mismatch_count": len(mismatches),
            "missing": missing[: args.max_items],
            "extra": extra[: args.max_items],
            "hash_mismatches": mismatches[: args.max_items],
        }
        print(json.dumps(report, sort_keys=True))
        return 0 if report["ok"] else 1
    except Exception as error:
        print(f"verification failed: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
