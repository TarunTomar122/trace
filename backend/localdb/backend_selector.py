"""Firestore backend selector for trace pipelines.

`TRACE_DB` controls which Firestore-shaped client every pipeline store uses:

  firebase (default) — the real Firestore client (unchanged behavior)
  local              — LocalDB (SQLite) only
  dual               — reads from Firestore, mirrors every write to LocalDB

The returned client implements the subset of the Firestore API that the
trace pipeline uses (collection/document navigation, where/order/limit
queries, get_all, set/update/create/delete), so callers cannot tell the
difference. Firebase credentials are only initialized when Firestore is
actually involved.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any, Iterable

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.localdb import LocalDocumentStore, canonical_json, normalise_value, stable_document_hash  # noqa: E402
from backend.localdb.firestore import LocalFirestoreClient  # noqa: E402

VALID_MODES = ("firebase", "local", "dual")
DEFAULT_LOCALDB_PATH = "data/localdb/documents.sqlite3"


def trace_db_mode() -> str:
    mode = os.getenv("TRACE_DB", "firebase").strip().lower() or "firebase"
    if mode not in VALID_MODES:
        raise ValueError(f"TRACE_DB must be one of {VALID_MODES}, got {mode!r}")
    return mode


def localdb_path() -> str:
    return os.getenv("TRACE_LOCALDB_PATH", "").strip() or DEFAULT_LOCALDB_PATH


def _split_document_path(path: str) -> list[str]:
    parts = path.split("/")
    if len(parts) < 2 or len(parts) % 2 != 0:
        raise ValueError(f"invalid document path: {path!r}")
    return parts


def _split_collection_path(path: str) -> list[str]:
    parts = path.split("/")
    if len(parts) % 2 == 0:
        raise ValueError(f"invalid collection path: {path!r}")
    return parts


class FirestoreClientAdapter:
    """Implements the LocalDocumentStore surface over the real Firestore client.

    Reads return JSON-normalised data (timestamps as ISO strings) so dual-mode
    reads have exactly the same shape as local-mode reads. Writes apply the
    already-resolved operations from the LocalFirestore facade.
    """

    def __init__(self, client: Any):
        self._client = client

    def _document_ref(self, path: str) -> Any:
        parts = _split_document_path(path)
        ref = self._client.collection(parts[0]).document(parts[1])
        for index in range(2, len(parts), 2):
            ref = ref.collection(parts[index]).document(parts[index + 1])
        return ref

    def _collection_ref(self, path: str) -> Any:
        parts = _split_collection_path(path)
        ref = self._client.collection(parts[0])
        for index in range(1, len(parts), 2):
            ref = ref.document(parts[index]).collection(parts[index + 1])
        return ref

    def get(self, path: str) -> dict[str, Any] | None:
        snapshot = self._document_ref(path).get()
        if not snapshot.exists:
            return None
        data = normalise_value(snapshot.to_dict() or {})
        return {"data": data, "hash": stable_document_hash(path, data)}

    def get_many(self, paths: Iterable[str]) -> list[dict[str, Any]]:
        found: dict[str, dict[str, Any]] = {}
        refs = [self._document_ref(path) for path in paths]
        # Firestore's get_all returns only existing docs; map results by ref id.
        by_ref_id = {ref.id: path for path, ref in zip(paths, refs)}
        for snapshot in self._client.get_all(refs):
            path = by_ref_id.get(snapshot.id)
            if not path or not snapshot.exists:
                continue
            data = normalise_value(snapshot.to_dict() or {})
            found[path] = {"data": data, "hash": stable_document_hash(path, data)}
        return [found[path] for path in paths if path in found]

    def list_collection_documents(self, path: str) -> list[dict[str, Any]]:
        documents = []
        for snapshot in self._collection_ref(path).order_by("__name__").stream():
            data = normalise_value(snapshot.to_dict() or {})
            documents.append({
                "path": snapshot.reference.path,
                "id": snapshot.id,
                "data": data,
            })
        return documents

    def iter_collection_group_documents(self, collection: str) -> Iterable[dict[str, Any]]:
        for snapshot in self._client.collection_group(collection).order_by("__name__").stream():
            data = normalise_value(snapshot.to_dict() or {})
            yield {
                "path": snapshot.reference.path,
                "id": snapshot.id,
                "data": data,
            }

    def apply_operations(
        self, operations: list[dict[str, Any]], expected_hashes: dict[str, str | None] | None = None,
    ) -> list[Any]:
        # Firestore has no compare-and-set; transactions are unused by the
        # trace pipeline, so expected_hashes are ignored here.
        for operation in operations:
            kind = operation.get("op", "set")
            ref = self._document_ref(operation["path"])
            if kind == "delete":
                ref.delete()
            else:
                ref.set(operation.get("data") or {}, merge=bool(operation.get("merge")))
        return [None] * len(operations)


class DualStore:
    """Reads go to the primary (Firestore); writes apply to both stores."""

    def __init__(self, primary: FirestoreClientAdapter, mirror: LocalDocumentStore):
        self._primary = primary
        self._mirror = mirror

    def get(self, path: str) -> dict[str, Any] | None:
        return self._primary.get(path)

    def get_many(self, paths: Iterable[str]) -> list[dict[str, Any]]:
        return self._primary.get_many(paths)

    def list_collection_documents(self, path: str) -> list[dict[str, Any]]:
        return self._primary.list_collection_documents(path)

    def iter_collection_group_documents(self, collection: str) -> Iterable[dict[str, Any]]:
        return self._primary.iter_collection_group_documents(collection)

    def apply_operations(
        self, operations: list[dict[str, Any]], expected_hashes: dict[str, str | None] | None = None,
    ) -> list[Any]:
        try:
            self._mirror.apply_operations(operations)
        except Exception as error:  # mirror failures never break the pipeline
            print(f"[trace-db] WARNING: LocalDB mirror write failed: {error}", file=sys.stderr)
        return self._primary.apply_operations(operations, expected_hashes)


def _firestore_client() -> Any:
    from backend.patches.firestore_stream import disable_broken_firestore_stream_retry

    disable_broken_firestore_stream_retry()
    from firebase_admin import credentials, firestore, initialize_app
    import firebase_admin

    if not firebase_admin._apps:
        service_account_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()
        service_account_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "").strip()
        if service_account_json:
            initialize_app(credentials.Certificate(json.loads(service_account_json)))
        elif service_account_path:
            initialize_app(credentials.Certificate(service_account_path))
        else:
            raise ValueError("Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH")
    return firestore.client()


def select_firestore_client() -> Any:
    """Return the Firestore-shaped client selected by TRACE_DB."""
    mode = trace_db_mode()
    if mode == "local":
        return LocalFirestoreClient(LocalDocumentStore(localdb_path()))
    if mode == "dual":
        primary = FirestoreClientAdapter(_firestore_client())
        mirror = LocalDocumentStore(localdb_path())
        return LocalFirestoreClient(DualStore(primary, mirror))
    return _firestore_client()
