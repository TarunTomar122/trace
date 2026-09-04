"""Small Firestore-shaped facade backed by :mod:`LocalDocumentStore`.

It intentionally implements only the operations used by this repository. The
shape keeps the application and scheduled jobs stable while the storage engine
changes underneath them.
"""

from __future__ import annotations

import copy
import math
import os
import secrets
from datetime import datetime, timezone
from typing import Any, Iterable, Iterator

from .codec import denormalise_value
from .store import LocalDocumentStore
from .paths import validate_document_path, validate_path_prefix


_MISSING = object()
_DELETE = object()


def _field_value(data: dict[str, Any], field_path: str) -> Any:
    if field_path == "__name__":
        return _MISSING
    current: Any = data
    for part in field_path.split("."):
        if not isinstance(current, dict) or part not in current:
            return _MISSING
        current = current[part]
    return current


def _set_field(data: dict[str, Any], field_path: str, value: Any) -> None:
    target = data
    parts = field_path.split(".")
    for part in parts[:-1]:
        child = target.get(part)
        if not isinstance(child, dict):
            child = {}
            target[part] = child
        target = child
    target[parts[-1]] = value


def _delete_field(data: dict[str, Any], field_path: str) -> None:
    target = data
    parts = field_path.split(".")
    for part in parts[:-1]:
        target = target.get(part)
        if not isinstance(target, dict):
            return
    target.pop(parts[-1], None)


def _transform_name(value: Any) -> str:
    return type(value).__name__.lower()


def _resolve_value(value: Any, existing: Any = _MISSING) -> Any:
    name = _transform_name(value)
    if name == "sentinel":
        marker = str(value).lower()
        if "delete" in marker:
            return _DELETE
        return datetime.now(timezone.utc).isoformat()
    if name in {"increment", "numericincrementtransform"}:
        amount = getattr(value, "_value", getattr(value, "operand", 0))
        current = existing if isinstance(existing, (int, float)) and not isinstance(existing, bool) else 0
        result = current + amount
        return result if math.isfinite(float(result)) else result
    if name in {"arrayunion", "arrayuniontransform"}:
        values = list(getattr(value, "_values", getattr(value, "elements", [])))
        current = list(existing) if isinstance(existing, list) else []
        for item in values:
            resolved = _resolve_value(item)
            if resolved not in current:
                current.append(resolved)
        return current
    if name in {"arrayremove", "arrayremovetransform"}:
        values = list(getattr(value, "_values", getattr(value, "elements", [])))
        remove = {_stable_value(_resolve_value(item)) for item in values}
        return [item for item in (existing if isinstance(existing, list) else []) if _stable_value(item) not in remove]
    if name in {"deletetransform", "deletefield"}:
        return _DELETE
    if name in {"servertimestamptransform", "servertimestamp"}:
        return datetime.now(timezone.utc).isoformat()
    if isinstance(value, dict):
        return {key: _resolve_value(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_resolve_value(item) for item in value]
    return value


def _stable_value(value: Any) -> str:
    return repr(value)


def _compare(value: Any, operator: str, expected: Any) -> bool:
    if value is _MISSING:
        return operator in {"!=", "not-in"} and expected is not None
    try:
        if operator == "==":
            return value == expected
        if operator == "!=":
            return value != expected
        if operator == "<":
            return value < expected
        if operator == "<=":
            return value <= expected
        if operator == ">":
            return value > expected
        if operator == ">=":
            return value >= expected
        if operator in {"in", "not-in"}:
            result = value in expected
            return not result if operator == "not-in" else result
        if operator == "array_contains":
            return isinstance(value, list) and expected in value
        if operator == "array_contains_any":
            return isinstance(value, list) and any(item in value for item in expected)
    except (TypeError, ValueError):
        return False
    raise ValueError(f"unsupported query operator: {operator}")


class DocumentSnapshot:
    def __init__(self, reference: "DocumentReference", data: dict[str, Any] | None):
        self.reference = reference
        self.id = reference.id
        self.exists = data is not None
        self._data = copy.deepcopy(data) if data is not None else None

    def to_dict(self) -> dict[str, Any] | None:
        return copy.deepcopy(self._data) if self._data is not None else None

    def get(self, field_path: str) -> Any:
        if self._data is None:
            raise KeyError(field_path)
        value = _field_value(self._data, field_path)
        if value is _MISSING:
            raise KeyError(field_path)
        return copy.deepcopy(value)


class QuerySnapshot(list[DocumentSnapshot]):
    @property
    def docs(self) -> list[DocumentSnapshot]:
        return list(self)

    @property
    def empty(self) -> bool:
        return not self

    @property
    def size(self) -> int:
        return len(self)


class DocumentReference:
    def __init__(self, client: "LocalFirestoreClient", path: str):
        self._client = client
        self.path = validate_document_path(path)
        self.id = self.path.rsplit("/", 1)[-1]

    def collection(self, collection_id: str) -> "CollectionReference":
        return CollectionReference(self._client, f"{self.path}/{collection_id}")

    def get(self, transaction: "LocalTransaction | None" = None, **_kwargs: Any) -> DocumentSnapshot:
        return transaction.get(self) if transaction is not None else self._client._snapshot(self)

    def set(self, data: dict[str, Any], merge: bool | None = False, **_kwargs: Any) -> None:
        operation = {"op": "set", "path": self.path, "data": data, "merge": bool(merge)}
        self._client._write(operation)

    def update(self, data: dict[str, Any], **_kwargs: Any) -> None:
        self._client._write({"op": "set", "path": self.path, "data": data, "merge": True})

    def create(self, data: dict[str, Any], **_kwargs: Any) -> None:
        self._client._write({"op": "create", "path": self.path, "data": data})

    def delete(self, **_kwargs: Any) -> None:
        self._client._write({"op": "delete", "path": self.path})


class Query:
    def __init__(
        self,
        client: "LocalFirestoreClient",
        collection_path: str,
        *,
        collection_group: bool = False,
        filters: list[tuple[str, str, Any]] | None = None,
        orders: list[tuple[str, str]] | None = None,
        limit_count: int | None = None,
        selected: list[str] | None = None,
    ):
        self._client = client
        self._collection_path = validate_path_prefix(collection_path)
        self._collection_group = collection_group
        self._filters = list(filters or [])
        self._orders = list(orders or [])
        self._limit_count = limit_count
        self._selected = selected

    def _clone(self, **changes: Any) -> "Query":
        values = {
            "client": self._client,
            "collection_path": self._collection_path,
            "collection_group": self._collection_group,
            "filters": self._filters,
            "orders": self._orders,
            "limit_count": self._limit_count,
            "selected": self._selected,
        }
        values.update(changes)
        return Query(**values)

    def where(self, field_path: str | None = None, op_string: str | None = None, value: Any = _MISSING, *, filter: Any = None) -> "Query":
        if filter is not None:
            field_path = getattr(filter, "field_path", getattr(filter, "field", None))
            op_string = getattr(filter, "op_string", getattr(filter, "op", None))
            value = getattr(filter, "value", _MISSING)
        if not isinstance(field_path, str) or not isinstance(op_string, str) or value is _MISSING:
            raise ValueError("where requires field, operator, and value")
        return self._clone(filters=[*self._filters, (field_path, op_string, value)])

    def order_by(self, field_path: str, direction: str = "ASCENDING") -> "Query":
        return self._clone(orders=[*self._orders, (field_path, direction)])

    def limit(self, count: int) -> "Query":
        return self._clone(limit_count=count)

    def select(self, field_paths: Iterable[str]) -> "Query":
        return self._clone(selected=list(field_paths))

    def offset(self, count: int) -> "Query":
        # Offset is uncommon in this app; applying it after ordering preserves
        # Firestore's observable result without adding another storage index.
        clone = self._clone()
        clone._offset_count = count
        return clone

    def stream(self, **_kwargs: Any) -> Iterator[DocumentSnapshot]:
        documents = self._client._documents_for_query(self._collection_path, self._collection_group)
        for field_path, operator, expected in self._filters:
            documents = [
                document
                for document in documents
                if _compare(
                    document["id"] if field_path == "__name__" else _field_value(document["data"], field_path),
                    operator,
                    expected,
                )
            ]
        for field_path, direction in reversed(self._orders):
            reverse = str(direction).upper() in {"DESC", "DESCENDING"}
            documents.sort(
                key=lambda item: _sortable(item["id"] if field_path == "__name__" else _field_value(item["data"], field_path)),
                reverse=reverse,
            )
        offset = getattr(self, "_offset_count", 0)
        documents = documents[offset:]
        if self._limit_count is not None:
            documents = documents[: self._limit_count]
        for document in documents:
            data = document["data"]
            if self._selected is not None:
                data = _select_data(data, self._selected)
            yield DocumentSnapshot(DocumentReference(self._client, document["path"]), data)

    def get(self, **kwargs: Any) -> QuerySnapshot:
        return QuerySnapshot(self.stream(**kwargs))


def _sortable(value: Any) -> tuple[int, str]:
    if value is _MISSING or value is None:
        return (0, "")
    return (1, str(value))


def _select_data(data: dict[str, Any], fields: list[str]) -> dict[str, Any]:
    selected: dict[str, Any] = {}
    for field in fields:
        value = _field_value(data, field)
        if value is not _MISSING:
            _set_field(selected, field, copy.deepcopy(value))
    return selected


class CollectionReference(Query):
    def __init__(self, client: "LocalFirestoreClient", collection_path: str):
        super().__init__(client, collection_path)

    def document(self, document_id: str) -> DocumentReference:
        return DocumentReference(self._client, f"{self._collection_path}/{document_id}")

    def doc(self, document_id: str) -> DocumentReference:
        return self.document(document_id)

    def add(self, data: dict[str, Any], **_kwargs: Any) -> tuple[Any, DocumentReference]:
        document_id = secrets.token_urlsafe(16).replace("-", "").replace("_", "")[:20]
        ref = self.document(document_id)
        ref.set(data)
        return datetime.now(timezone.utc), ref


class LocalWriteBatch:
    def __init__(self, client: "LocalFirestoreClient"):
        self._client = client
        self._operations: list[dict[str, Any]] = []

    def set(self, reference: DocumentReference, data: dict[str, Any], merge: bool = False, **_kwargs: Any) -> "LocalWriteBatch":
        self._operations.append({"op": "set", "path": reference.path, "data": data, "merge": merge})
        return self

    def update(self, reference: DocumentReference, data: dict[str, Any], **_kwargs: Any) -> "LocalWriteBatch":
        return self.set(reference, data, merge=True)

    def create(self, reference: DocumentReference, data: dict[str, Any], **_kwargs: Any) -> "LocalWriteBatch":
        self._operations.append({"op": "create", "path": reference.path, "data": data})
        return self

    def delete(self, reference: DocumentReference, **_kwargs: Any) -> "LocalWriteBatch":
        self._operations.append({"op": "delete", "path": reference.path})
        return self

    def commit(self, **_kwargs: Any) -> list[Any]:
        return self._client._write_many(self._operations)


class LocalTransaction(LocalWriteBatch):
    def __init__(self, client: "LocalFirestoreClient"):
        super().__init__(client)
        self._read_hashes: dict[str, str | None] = {}

    def get(self, reference: DocumentReference, **_kwargs: Any) -> DocumentSnapshot:
        snapshot = self._client._snapshot(reference)
        row = self._client._store.get(reference.path)
        self._read_hashes[reference.path] = row["hash"] if row else None
        return snapshot

    def commit(self, **_kwargs: Any) -> list[Any]:
        return self._client._write_many(self._operations, self._read_hashes)

    def rollback(self) -> None:
        self._operations.clear()


class LocalFirestoreClient:
    def __init__(self, db_path: str | os.PathLike[str] | LocalDocumentStore):
        # Any object implementing the store surface (get/get_many/
        # list_collection_documents/iter_collection_group_documents/
        # apply_operations) is accepted as-is; strings become SQLite stores.
        if isinstance(db_path, LocalDocumentStore) or hasattr(db_path, "apply_operations"):
            self._store = db_path
        else:
            self._store = LocalDocumentStore(db_path)

    def collection(self, collection_id: str) -> CollectionReference:
        return CollectionReference(self, collection_id)

    def collection_group(self, collection_id: str) -> Query:
        return Query(self, collection_id, collection_group=True)

    def get_all(self, references: Iterable[DocumentReference], **_kwargs: Any) -> Iterator[DocumentSnapshot]:
        refs = list(references)
        rows = {row["path"]: row for row in self._store.get_many(reference.path for reference in refs)}
        return iter([
            DocumentSnapshot(reference, rows[reference.path]["data"] if reference.path in rows else None)
            for reference in refs
        ])

    def batch(self) -> LocalWriteBatch:
        return LocalWriteBatch(self)

    def transaction(self, **_kwargs: Any) -> LocalTransaction:
        return LocalTransaction(self)

    def _snapshot(self, reference: DocumentReference) -> DocumentSnapshot:
        row = self._store.get(reference.path)
        return DocumentSnapshot(reference, row["data"] if row else None)

    def _documents_for_query(self, collection_path: str, collection_group: bool) -> list[dict[str, Any]]:
        if collection_group:
            return [
                {"path": row["path"], "id": row["path"].rsplit("/", 1)[-1], "data": row["data"]}
                for row in self._store.iter_collection_group_documents(collection_path)
            ]
        return [
            {"path": row["path"], "id": row["path"].rsplit("/", 1)[-1], "data": row["data"]}
            for row in self._store.list_collection_documents(collection_path)
        ]

    def _write(self, operation: dict[str, Any]) -> None:
        self._write_many([operation])

    def _write_many(self, operations: list[dict[str, Any]], expected_hashes: dict[str, str | None] | None = None) -> list[Any]:
        resolved: list[dict[str, Any]] = []
        working: dict[str, dict[str, Any]] = {}
        for operation in operations:
            path = validate_document_path(operation["path"])
            existing = working.get(path)
            if existing is None:
                row = self._store.get(path)
                existing = row["data"] if row else {}
            kind = operation.get("op", "set")
            if kind == "delete":
                resolved.append({"op": "delete", "path": path})
                working.pop(path, None)
                continue
            data = operation.get("data")
            if not isinstance(data, dict):
                raise ValueError("document data must be an object")
            merge = bool(operation.get("merge") or kind == "update")
            current = copy.deepcopy(existing) if merge else {}
            for field_path, value in data.items():
                previous = _field_value(existing, field_path)
                resolved_value = _resolve_value(value, previous)
                if resolved_value is _DELETE:
                    _delete_field(current, field_path)
                else:
                    _set_field(current, field_path, resolved_value)
            resolved.append({"op": "create" if kind == "create" else "set", "path": path, "data": current, "merge": False})
            working[path] = current
        return self._store.apply_operations(resolved, expected_hashes)


def local_firestore_path() -> str | None:
    value = os.getenv("LOCALDB_PATH", "").strip()
    return value or None


__all__ = [
    "DocumentReference",
    "DocumentSnapshot",
    "LocalFirestoreClient",
    "LocalTransaction",
    "QuerySnapshot",
]
