#!/usr/bin/env python3
"""Copy an explicit Firestore collection allowlist into the local document store.

The Firestore side of this script is intentionally read-only.  It never calls a
delete operation and defaults to a dry run.
"""

from __future__ import annotations

import argparse
import hmac
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Iterator

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.localdb import (  # noqa: E402
    LocalDocumentStore,
    canonical_json,
    normalise_value,
    stable_document_hash,
    validate_collection_name,
    validate_document_path,
    validate_local_file_path,
)


def validate_collection_selector(selector: str) -> str:
    if not isinstance(selector, str) or not selector or "\x00" in selector:
        raise ValueError("collection selector must be a non-empty string")
    parts = selector.split("/")
    if len(parts) % 2 == 0:
        raise ValueError("collection selector must end at a collection")
    for index, part in enumerate(parts):
        if not part or part in {".", ".."}:
            raise ValueError("collection selector contains an invalid segment")
        if index % 2 == 0 and part == "*":
            raise ValueError("wildcards are only allowed for document IDs")
        if index % 2 == 1 and part != "*" and "/" in part:
            raise ValueError("invalid document selector")
    return "/".join(parts)


def selector_matches_path(selector: str, path: str) -> bool:
    selector_parts = validate_collection_selector(selector).split("/")
    path_parts = validate_document_path(path).split("/")
    if len(path_parts) != len(selector_parts) + 1:
        return False
    return all(
        expected == "*" or expected == actual
        for expected, actual in zip(selector_parts, path_parts[:-1])
    )


def validate_collection_group(collection_group: str) -> str:
    return validate_collection_name(collection_group)


def collection_group_matches_path(collection_group: str, path: str) -> bool:
    valid_group = validate_collection_group(collection_group)
    path_parts = validate_document_path(path).split("/")
    return path_parts[-2] == valid_group


def _record_from_snapshot(snapshot: Any) -> dict[str, Any]:
    path = validate_document_path(snapshot.reference.path)
    data = normalise_value(snapshot.to_dict() or {})
    return {"path": path, "data": data, "hash": stable_document_hash(path, data)}


def _ordered_stream(collection_ref: Any) -> Iterable[Any]:
    return collection_ref.order_by("__name__").stream()


def iter_firestore_selector(client: Any, selector: str) -> Iterator[dict[str, Any]]:
    """Yield only documents in one explicitly selected collection path."""

    valid_selector = validate_collection_selector(selector)
    parts = valid_selector.split("/")

    def walk(collection_ref: Any, collection_index: int) -> Iterator[dict[str, Any]]:
        if collection_index == len(parts) - 1:
            for snapshot in _ordered_stream(collection_ref):
                yield _record_from_snapshot(snapshot)
            return

        document_selector = parts[collection_index + 1]
        nested_collection = parts[collection_index + 2]
        if document_selector == "*":
            for snapshot in _ordered_stream(collection_ref):
                yield from walk(snapshot.reference.collection(nested_collection), collection_index + 2)
            return

        # Reading the exact document is unnecessary: Firestore subcollections
        # can outlive a deleted parent document.
        yield from walk(collection_ref.document(document_selector).collection(nested_collection), collection_index + 2)

    yield from walk(client.collection(parts[0]), 0)


def iter_firestore_collection_group(client: Any, collection_group: str) -> Iterator[dict[str, Any]]:
    valid_group = validate_collection_group(collection_group)
    for snapshot in _ordered_stream(client.collection_group(valid_group)):
        yield _record_from_snapshot(snapshot)


def discover_firestore_selectors(client: Any) -> tuple[list[str], list[str]]:
    """Discover root collections and code-referenced collection groups.

    Listing subcollections per document is a network round-trip per document.
    Root collection reads plus collection-group scans cover the app's static
    Firestore paths without turning a migration into a multi-hour metadata walk.
    """

    selectors = {collection.id for collection in client.collections()}
    groups: set[str] = set()
    pattern = re.compile(r"\.collection(?:_group)?\(\s*[\"']([^\"']+)[\"']")
    for source_path in REPO_ROOT.rglob("*"):
        if source_path.is_dir() or any(part in {".git", "node_modules", ".venv"} for part in source_path.parts):
            continue
        if source_path.suffix not in {".py", ".ts", ".tsx", ".js", ".jsx"}:
            continue
        try:
            text = source_path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        for collection_id in pattern.findall(text):
            parts = collection_id.split("/")
            if len(parts) == 1:
                groups.add(parts[0])
            else:
                groups.add(parts[-1])
    groups.update({"stocks"})
    return sorted(selectors), sorted(groups - selectors)


def _read_selectors(values: list[str], config_path: str | None, *, allow_empty: bool = False) -> list[str]:
    raw_values = list(values)
    if config_path:
        if raw_values:
            raise ValueError("use --collection or --collections-file, not both")
        path = validate_local_file_path(config_path)
        text = path.read_text(encoding="utf-8")
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            raw_values = [line.strip() for line in text.splitlines() if line.strip() and not line.lstrip().startswith("#")]
        else:
            if isinstance(parsed, dict):
                parsed = parsed.get("collections")
            if not isinstance(parsed, list) or not all(isinstance(item, str) for item in parsed):
                raise ValueError("collection config must be a list or an object with collections")
            raw_values = parsed
    if not raw_values:
        raw_values = [item.strip() for item in os.getenv("FIRESTORE_MIGRATION_COLLECTIONS", "").split(",") if item.strip()]
    selectors = sorted({validate_collection_selector(item.strip()) for item in raw_values if item.strip()})
    if not selectors and not allow_empty:
        raise ValueError("at least one explicit collection selector is required")
    return selectors


def _read_collection_groups(values: list[str]) -> list[str]:
    return sorted({validate_collection_group(item.strip()) for item in values if item.strip()})


def _new_checkpoint(
    source: str,
    operation: str,
    selectors: list[str],
    collection_groups: list[str] | None = None,
) -> dict[str, Any]:
    return {
        "version": 1,
        "source": source,
        "operation": operation,
        "selectors": selectors,
        "collection_groups": list(collection_groups or []),
        "completed": {},
        "collection_group_completed": {},
        "updated_at": None,
    }


def _load_checkpoint(
    path: Path,
    source: str,
    operation: str,
    selectors: list[str],
    fresh: bool,
    collection_groups: list[str] | None = None,
) -> dict[str, Any]:
    if fresh or not path.exists():
        return _new_checkpoint(source, operation, selectors, collection_groups)
    try:
        state = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError("checkpoint is unreadable") from error
    if (
        state.get("version") != 1
        or state.get("source") != source
        or state.get("operation") != operation
        or state.get("selectors") != selectors
        or state.get("collection_groups", []) != (collection_groups or [])
    ):
        raise ValueError("checkpoint does not match this migration; use a new checkpoint path")
    if not isinstance(state.get("completed"), dict):
        raise ValueError("checkpoint is invalid")
    if not isinstance(state.get("collection_group_completed", {}), dict):
        raise ValueError("checkpoint is invalid")
    return state


def _save_checkpoint(path: Path, state: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    state["updated_at"] = datetime.now(timezone.utc).isoformat()
    temporary = path.with_name(f".{path.name}.tmp-{os.getpid()}")
    temporary.write_text(canonical_json(state) + "\n", encoding="utf-8")
    os.replace(temporary, path)


def _firestore_client(project_id: str | None) -> Any:
    from backend.patches.firestore_stream import disable_broken_firestore_stream_retry

    disable_broken_firestore_stream_retry()
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
    except ImportError as error:
        raise RuntimeError("firebase-admin is required for Firestore migration") from error

    try:
        app = firebase_admin.get_app()
    except ValueError:
        service_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()
        service_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "").strip() or os.getenv(
            "GOOGLE_APPLICATION_CREDENTIALS", ""
        ).strip()
        if service_json:
            try:
                credential = credentials.Certificate(json.loads(service_json))
            except Exception as error:
                raise RuntimeError("Firebase service-account configuration is invalid") from error
        elif service_path:
            try:
                credential = credentials.Certificate(service_path)
            except Exception as error:
                raise RuntimeError("Firebase service-account configuration is invalid") from error
        else:
            try:
                credential = credentials.ApplicationDefault()
            except Exception as error:
                raise RuntimeError("Firebase application credentials are unavailable") from error
        options = {"projectId": project_id} if project_id else None
        try:
            app = firebase_admin.initialize_app(credential, options=options)
        except Exception as error:
            raise RuntimeError("Firebase client initialization failed") from error
    return firestore.client(app=app)


def _record_from_archive(payload: Any, line_number: int) -> dict[str, Any]:
    if not isinstance(payload, dict) or not isinstance(payload.get("path"), str):
        raise ValueError(f"archive line {line_number} is invalid")
    path = validate_document_path(payload["path"])
    data = payload.get("data")
    if not isinstance(data, dict) or not isinstance(payload.get("hash"), str):
        raise ValueError(f"archive line {line_number} is invalid")
    expected = stable_document_hash(path, data)
    if not hmac.compare_digest(payload["hash"], expected):
        raise ValueError(f"archive line {line_number} has an invalid hash")
    return {"path": path, "data": data, "hash": expected}


def _iter_archive(
    path: Path,
    selectors: list[str],
    start_line: int = 0,
    collection_groups: list[str] | None = None,
) -> Iterator[tuple[int, dict[str, Any]]]:
    collection_groups = collection_groups or []
    with path.open(encoding="utf-8") as archive:
        for line_number, line in enumerate(archive, 1):
            if line_number <= start_line:
                continue
            if not line.strip():
                continue
            try:
                payload = json.loads(line)
                record = _record_from_archive(payload, line_number)
            except (json.JSONDecodeError, ValueError) as error:
                raise ValueError(str(error)) from error
            if (not selectors and not collection_groups) or any(selector_matches_path(selector, record["path"]) for selector in selectors) or any(
                collection_group_matches_path(collection_group, record["path"])
                for collection_group in collection_groups
            ):
                yield line_number, record


def _write_export_line(export_file: Any, record: dict[str, Any]) -> None:
    export_file.write(
        json.dumps(
            {"path": record["path"], "data": record["data"], "hash": record["hash"]},
            ensure_ascii=True,
            sort_keys=True,
            separators=(",", ":"),
        )
        + "\n"
    )


def _open_export(path: Path, checkpoint: dict[str, Any], fresh: bool) -> Any:
    if path.exists() and (fresh or not checkpoint.get("export_path")):
        raise ValueError("export file already exists; choose a new path")
    if checkpoint.get("export_path") and checkpoint["export_path"] != str(path):
        raise ValueError("checkpoint points to a different export file")
    path.parent.mkdir(parents=True, exist_ok=True)
    checkpoint["export_path"] = str(path)
    return path.open("a", encoding="utf-8")


def _migrate_firestore(
    client: Any,
    store: LocalDocumentStore | None,
    selectors: list[str],
    apply: bool,
    export_path: Path | None,
    checkpoint_path: Path,
    checkpoint_every: int,
    fresh: bool,
    collection_groups: list[str] | None = None,
) -> dict[str, int]:
    collection_groups = collection_groups or []
    operation = "firestore-apply" if apply else "firestore-export"
    checkpoint_enabled = apply or export_path is not None
    checkpoint = _load_checkpoint(
        checkpoint_path,
        "firestore",
        operation,
        selectors,
        fresh or not checkpoint_enabled,
        collection_groups,
    )
    export_file = _open_export(export_path, checkpoint, fresh) if export_path else None
    scanned = 0
    written = 0
    seen_paths: set[str] = set()
    try:
        for selector in selectors:
            progress = checkpoint["completed"].setdefault(selector, {"last_path": "", "count": 0, "done": False})
            last_path = progress.get("last_path", "")
            for record in iter_firestore_selector(client, selector):
                scanned += 1
                if last_path and record["path"] <= last_path:
                    continue
                progress["last_path"] = record["path"]
                progress["last_hash"] = record["hash"]
                if record["path"] in seen_paths:
                    continue
                seen_paths.add(record["path"])
                if apply:
                    if store is None:
                        raise RuntimeError("local store is required for apply mode")
                    store.upsert(record["path"], record["data"], record["hash"])
                    written += 1
                if export_file:
                    _write_export_line(export_file, record)
                    export_file.flush()
                progress["count"] = progress.get("count", 0) + 1
                if checkpoint_enabled and (progress["count"] % checkpoint_every) == 0:
                    if export_file:
                        export_file.flush()
                    _save_checkpoint(checkpoint_path, checkpoint)
            progress["done"] = True
            if checkpoint_enabled:
                _save_checkpoint(checkpoint_path, checkpoint)
        group_progresses = checkpoint.setdefault("collection_group_completed", {})
        for collection_group in collection_groups:
            progress = group_progresses.setdefault(
                collection_group, {"last_path": "", "count": 0, "done": False}
            )
            last_path = progress.get("last_path", "")
            for record in iter_firestore_collection_group(client, collection_group):
                scanned += 1
                if last_path and record["path"] <= last_path:
                    continue
                progress["last_path"] = record["path"]
                progress["last_hash"] = record["hash"]
                if record["path"] in seen_paths:
                    continue
                seen_paths.add(record["path"])
                if apply:
                    if store is None:
                        raise RuntimeError("local store is required for apply mode")
                    store.upsert(record["path"], record["data"], record["hash"])
                    written += 1
                if export_file:
                    _write_export_line(export_file, record)
                    export_file.flush()
                progress["count"] = progress.get("count", 0) + 1
                if checkpoint_enabled and (progress["count"] % checkpoint_every) == 0:
                    if export_file:
                        export_file.flush()
                    _save_checkpoint(checkpoint_path, checkpoint)
            progress["done"] = True
            if checkpoint_enabled:
                _save_checkpoint(checkpoint_path, checkpoint)
    finally:
        if export_file:
            export_file.close()
    return {"scanned": scanned, "written": written}


def _migrate_archive(
    archive_path: Path,
    store: LocalDocumentStore | None,
    selectors: list[str],
    apply: bool,
    checkpoint_path: Path,
    checkpoint_every: int,
    fresh: bool,
    collection_groups: list[str] | None = None,
) -> dict[str, int]:
    collection_groups = collection_groups or []
    operation = "archive-apply" if apply else "archive-verify"
    checkpoint_enabled = apply
    checkpoint = _load_checkpoint(
        checkpoint_path,
        str(archive_path),
        operation,
        selectors,
        fresh or not checkpoint_enabled,
        collection_groups,
    )
    stat = archive_path.stat()
    fingerprint = {"size": stat.st_size, "mtime_ns": stat.st_mtime_ns}
    if checkpoint.get("fingerprint") and checkpoint["fingerprint"] != fingerprint:
        raise ValueError("archive changed since the checkpoint was created")
    checkpoint["fingerprint"] = fingerprint
    start_line = int(checkpoint.get("last_line", 0))
    pending: list[dict[str, Any]] = []
    scanned = 0
    written = 0
    last_line = start_line
    pending_last_line = start_line

    def flush(line_number: int) -> None:
        nonlocal written, pending, last_line, pending_last_line
        if apply and pending:
            if store is None:
                raise RuntimeError("local store is required for apply mode")
            store.batch_upsert(pending)
            written += len(pending)
        pending = []
        last_line = line_number
        pending_last_line = last_line
        checkpoint["last_line"] = line_number
        checkpoint["count"] = checkpoint.get("count", 0) + 1
        if checkpoint_enabled and checkpoint["count"] % checkpoint_every == 0:
            _save_checkpoint(checkpoint_path, checkpoint)

    for line_number, record in _iter_archive(archive_path, selectors, start_line, collection_groups):
        scanned += 1
        pending.append(record)
        pending_last_line = line_number
        if len(pending) >= 100:
            flush(line_number)
    if pending:
        flush(pending_last_line)
    if checkpoint_enabled:
        checkpoint["done"] = True
        _save_checkpoint(checkpoint_path, checkpoint)
    return {"scanned": scanned, "written": written}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="migrate Firestore into local SQLite")
    parser.add_argument("--all", action="store_true", help="discover and copy every reachable Firestore collection")
    parser.add_argument("--collection", dest="collections", action="append", default=[])
    parser.add_argument("--collection-group", dest="collection_groups", action="append", default=[])
    parser.add_argument("--collections-file")
    parser.add_argument("--db", default=os.getenv("LOCALDB_PATH", "localdb.sqlite3"))
    parser.add_argument(
        "--checkpoint",
        default=os.getenv("LOCALDB_MIGRATION_CHECKPOINT", "localdb-migration/checkpoint.json"),
    )
    parser.add_argument("--export", dest="export_path")
    parser.add_argument("--import", dest="import_path")
    parser.add_argument("--project-id", default=os.getenv("FIREBASE_PROJECT_ID") or os.getenv("NEXT_PUBLIC_FIREBASE_PROJECT_ID"))
    parser.add_argument("--apply", action="store_true", help="write to local SQLite; default is dry-run")
    parser.add_argument("--fresh", action="store_true", help="ignore an existing checkpoint")
    parser.add_argument("--checkpoint-every", type=int, default=25)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        if args.import_path and args.export_path:
            raise ValueError("--export and --import cannot be used together")
        if args.checkpoint_every < 1:
            raise ValueError("--checkpoint-every must be positive")
        collection_groups = _read_collection_groups(args.collection_groups)
        selectors = _read_selectors(args.collections, args.collections_file, allow_empty=bool(collection_groups or args.all))
        if args.all and (args.collections or args.collections_file or args.collection_groups):
            raise ValueError("--all cannot be combined with explicit collection selectors")
        if not selectors and not collection_groups and not args.all:
            raise ValueError("at least one explicit collection selector is required")
        db_path = validate_local_file_path(args.db)
        checkpoint_path = validate_local_file_path(args.checkpoint)
        store = LocalDocumentStore(db_path) if args.apply else None
        if args.import_path:
            archive_path = validate_local_file_path(args.import_path)
            result = _migrate_archive(
                archive_path,
                store,
                selectors,
                args.apply,
                checkpoint_path,
                args.checkpoint_every,
                args.fresh,
                collection_groups=collection_groups,
            )
            source = "archive"
        else:
            export_path = validate_local_file_path(args.export_path) if args.export_path else None
            client = _firestore_client(args.project_id)
            if args.all:
                selectors, discovered_groups = discover_firestore_selectors(client)
                collection_groups = sorted(set(collection_groups).union(discovered_groups))
            result = _migrate_firestore(
                client,
                store,
                selectors,
                args.apply,
                export_path,
                checkpoint_path,
                args.checkpoint_every,
                args.fresh,
                collection_groups=collection_groups,
            )
            source = "firestore"
        mode = "apply" if args.apply else "dry-run"
        print(
            json.dumps(
                {
                    "source": source,
                    "mode": mode,
                    "selectors": len(selectors) + len(collection_groups),
                    **result,
                },
                sort_keys=True,
            )
        )
        return 0
    except Exception as error:
        print(f"migration failed: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
