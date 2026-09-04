"""Minimal authenticated HTTP API for the local document store."""

from __future__ import annotations

import argparse
import copy
import hmac
import json
import os
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import parse_qs, unquote, urlsplit

from .firestore import LocalFirestoreClient, _MISSING, _delete_field, _field_value, _select_data, _set_field
from .paths import validate_collection_name, validate_document_path, validate_path_prefix
from .store import LocalDocumentStore

MAX_BODY_BYTES = 16 * 1024 * 1024
MAX_BATCH_DOCUMENTS = 500
MAX_BATCH_GET_DOCUMENTS = 500
MAX_LIST_DOCUMENTS = 5_000


def _resolve_value(value: Any, existing: Any = _MISSING) -> Any:
    if isinstance(value, dict):
        transform = value.get("__localdb_transform__")
        if transform == "delete":
            return _MISSING
        if transform == "server_timestamp":
            return datetime.now(timezone.utc).isoformat()
        if transform == "increment":
            current = existing if isinstance(existing, (int, float)) and not isinstance(existing, bool) else 0
            return current + value.get("value", 0)
        if transform in {"array_union", "array_remove"}:
            current = list(existing) if isinstance(existing, list) else []
            values = value.get("values") if isinstance(value.get("values"), list) else []
            if transform == "array_union":
                for item in values:
                    if item not in current:
                        current.append(item)
                return current
            remove = {repr(item) for item in values}
            return [item for item in current if repr(item) not in remove]
        return {key: _resolve_value(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_resolve_value(item) for item in value]
    return value


def _resolve_operations(store: LocalDocumentStore, operations: list[dict[str, Any]]) -> list[dict[str, Any]]:
    resolved: list[dict[str, Any]] = []
    working: dict[str, dict[str, Any]] = {}
    for operation in operations:
        path = validate_document_path(operation.get("path"))
        if operation.get("op") == "delete":
            resolved.append({"op": "delete", "path": path})
            working.pop(path, None)
            continue
        data = operation.get("data")
        if not isinstance(data, dict):
            raise ValueError("document data must be an object")
        existing = working.get(path)
        if existing is None:
            row = store.get(path)
            existing = row["data"] if row else {}
        merge = bool(operation.get("merge") or operation.get("op") == "update")
        current = copy.deepcopy(existing) if merge else {}
        for field_path, value in data.items():
            resolved_value = _resolve_value(value, _field_value(existing, field_path))
            if resolved_value is _MISSING:
                _delete_field(current, field_path)
            else:
                _set_field(current, field_path, resolved_value)
        resolved.append({"op": "create" if operation.get("op") == "create" else "set", "path": path, "data": current, "merge": False})
        working[path] = current
    return resolved


class _HTTPServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


class LocalDBRequestHandler(BaseHTTPRequestHandler):
    server: _HTTPServer

    def log_message(self, _format: str, *_args: Any) -> None:
        return

    def _send_json(self, payload: dict[str, Any], status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=True, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _error(self, message: str, status: int) -> None:
        self._send_json({"error": message}, status)

    def _authorised(self) -> bool:
        header = self.headers.get("Authorization", "")
        token = header[7:] if header.startswith("Bearer ") else self.headers.get("X-LocalDB-Token", "")
        # Pasted env values often carry stray whitespace (Vercel dashboard,
        # trailing newlines). Bearer tokens never contain it legitimately.
        token = token.strip()
        return bool(token) and hmac.compare_digest(token, self.server.api_token)

    def _require_auth(self) -> bool:
        if self._authorised():
            return True
        self._error("authentication required", 401)
        return False

    def _read_json(self) -> Any:
        raw_length = self.headers.get("Content-Length")
        try:
            length = int(raw_length or "-1")
        except ValueError as error:
            raise ValueError("invalid request body") from error
        if length < 0 or length > MAX_BODY_BYTES:
            raise ValueError("request body is too large or missing")
        try:
            return json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise ValueError("request body must be valid JSON") from error

    def _allowed(self, path: str) -> bool:
        allowed = self.server.allowed_collections
        return isinstance(path, str) and (not allowed or path.split("/", 1)[0] in allowed)

    def do_GET(self) -> None:
        parsed = urlsplit(self.path)
        if parsed.path == "/health":
            try:
                self._send_json({"ok": self.server.store.health(), "service": "localdb"})
            except Exception:
                self._send_json({"ok": False, "service": "localdb"}, 503)
            return
        if not self._require_auth():
            return
        try:
            if parsed.path == "/documents":
                query = parse_qs(parsed.query, strict_parsing=True)
                collection = validate_collection_name(query.get("collection", [""])[0])
                if not self._allowed(collection):
                    self._error("collection is not allowed", 403)
                    return
                prefix_value = query.get("prefix", [None])[0]
                prefix = validate_path_prefix(prefix_value) if prefix_value else None
                raw_limit = query.get("limit", ["1000"])[0]
                limit = int(raw_limit)
                if limit < 0 or limit > MAX_LIST_DOCUMENTS:
                    raise ValueError("limit is out of range")
                documents = self.server.store.list_documents(collection, prefix=prefix, limit=limit)
                self._send_json({"documents": documents, "count": len(documents)})
                return
            if parsed.path.startswith("/documents/"):
                path = validate_document_path(unquote(parsed.path[len("/documents/") :]))
                if not self._allowed(path):
                    self._error("collection is not allowed", 403)
                    return
                document = self.server.store.get(path)
                if document is None:
                    self._error("document not found", 404)
                else:
                    self._send_json({"document": document})
                return
            self._error("not found", 404)
        except ValueError as error:
            self._error(str(error), 400)
        except RuntimeError as error:
            self._error(str(error), 409)
        except Exception:
            self._error("internal error", 500)

    def do_PUT(self) -> None:
        if not self._require_auth():
            return
        parsed = urlsplit(self.path)
        try:
            if not parsed.path.startswith("/documents/"):
                self._error("not found", 404)
                return
            path = validate_document_path(unquote(parsed.path[len("/documents/") :]))
            if not self._allowed(path):
                self._error("collection is not allowed", 403)
                return
            body = self._read_json()
            if not isinstance(body, dict) or "data" not in body:
                raise ValueError("body must contain data")
            operations = _resolve_operations(
                self.server.store,
                [{"op": "create" if body.get("create") else "set", "path": path, "data": body["data"], "merge": bool(body.get("merge"))}],
            )
            document = self.server.store.apply_operations(operations)[0]
            self._send_json({"document": document})
        except ValueError as error:
            self._error(str(error), 400)
        except Exception:
            self._error("internal error", 500)

    def do_POST(self) -> None:
        if not self._require_auth():
            return
        endpoint = urlsplit(self.path).path
        if endpoint == "/documents:batchGet":
            try:
                body = self._read_json()
                paths = body.get("paths") if isinstance(body, dict) else None
                select = body.get("select") if isinstance(body, dict) else None
                if not isinstance(paths, list) or len(paths) > MAX_BATCH_GET_DOCUMENTS:
                    raise ValueError("paths must be a list of at most 500 items")
                if select is not None and (not isinstance(select, list) or not all(isinstance(item, str) for item in select)):
                    raise ValueError("select must be a list of field paths")
                valid_paths = [validate_document_path(path) for path in paths]
                for path in valid_paths:
                    if not self._allowed(path):
                        self._error("collection is not allowed", 403)
                        return
                documents = self.server.store.get_many(valid_paths)
                payload = []
                for document in documents:
                    data = document["data"]
                    if select is not None:
                        data = _select_data(data, select)
                    payload.append({
                        "path": document["path"],
                        "data": data,
                        "hash": document["hash"],
                        "updated_at": document["updated_at"],
                    })
                self._send_json({"documents": payload, "count": len(payload)})
            except ValueError as error:
                self._error(str(error), 400)
            except Exception:
                self._error("internal error", 500)
            return
        if endpoint == "/query":
            try:
                body = self._read_json()
                collection = body.get("collection") if isinstance(body, dict) else None
                if not isinstance(collection, str) or not collection:
                    raise ValueError("collection is required")
                if not self._allowed(collection):
                    self._error("collection is not allowed", 403)
                    return
                client = LocalFirestoreClient(self.server.store)
                query = client.collection_group(collection) if body.get("collection_group") else client.collection(collection)
                for item in body.get("filters", []):
                    if not isinstance(item, dict):
                        raise ValueError("invalid query filter")
                    query = query.where(item.get("field"), item.get("op"), item.get("value"))
                for item in body.get("orders", []):
                    if not isinstance(item, dict):
                        raise ValueError("invalid query order")
                    query = query.order_by(item.get("field"), item.get("direction", "ASCENDING"))
                if body.get("select") is not None:
                    query = query.select(body["select"])
                if body.get("limit") is not None:
                    query = query.limit(int(body["limit"]))
                documents = [
                    {"path": snap.reference.path, "data": snap.to_dict() or {}}
                    for snap in query.stream()
                ]
                self._send_json({"documents": documents, "count": len(documents)})
            except ValueError as error:
                self._error(str(error), 400)
            except Exception:
                self._error("internal error", 500)
            return
        if endpoint not in {"/documents:batchUpsert", "/documents:batchWrite", "/transactions:commit"}:
            self._error("not found", 404)
            return
        try:
            body = self._read_json()
            if endpoint == "/transactions:commit":
                reads = body.get("reads", {}) if isinstance(body, dict) else {}
                operations = body.get("operations", []) if isinstance(body, dict) else []
                if not isinstance(reads, dict) or not isinstance(operations, list):
                    raise ValueError("transaction body is invalid")
                for path in [*reads.keys(), *(operation.get("path", "") for operation in operations)]:
                    valid_path = validate_document_path(path)
                    if not self._allowed(valid_path):
                        self._error("collection is not allowed", 403)
                        return
                resolved = _resolve_operations(self.server.store, operations)
                expected = {validate_document_path(path): value for path, value in reads.items()}
                result = self.server.store.apply_operations(resolved, expected)
                self._send_json({"count": len(result), "documents": [item for item in result if item]})
                return
            if endpoint == "/documents:batchWrite":
                operations = body.get("operations") if isinstance(body, dict) else None
                if not isinstance(operations, list) or len(operations) > MAX_BATCH_DOCUMENTS:
                    raise ValueError("operations must be a list of at most 500 items")
                for operation in operations:
                    path = validate_document_path(operation.get("path", ""))
                    if not self._allowed(path):
                        self._error("collection is not allowed", 403)
                        return
                result = self.server.store.apply_operations(_resolve_operations(self.server.store, operations))
                self._send_json({"count": len(result), "documents": [item for item in result if item]})
                return
            documents = body.get("documents") if isinstance(body, dict) else None
            if not isinstance(documents, list) or len(documents) > MAX_BATCH_DOCUMENTS:
                raise ValueError("documents must be a list of at most 500 items")
            for document in documents:
                if not isinstance(document, dict):
                    raise ValueError("each document must be an object")
                path = validate_document_path(document.get("path", ""))
                if not self._allowed(path):
                    self._error("collection is not allowed", 403)
                    return
            result = self.server.store.batch_upsert(documents)
            self._send_json({"documents": result, "count": len(result)})
        except ValueError as error:
            self._error(str(error), 400)
        except RuntimeError as error:
            self._error(str(error), 409)
        except Exception:
            self._error("internal error", 500)

    def do_DELETE(self) -> None:
        if not self._require_auth():
            return
        parsed = urlsplit(self.path)
        try:
            if not parsed.path.startswith("/documents/"):
                self._error("not found", 404)
                return
            path = validate_document_path(unquote(parsed.path[len("/documents/") :]))
            if not self._allowed(path):
                self._error("collection is not allowed", 403)
                return
            self.server.store.delete(path)
            self._send_json({"deleted": path})
        except ValueError as error:
            self._error(str(error), 400)
        except Exception:
            self._error("internal error", 500)


def make_server(
    host: str,
    port: int,
    store: LocalDocumentStore,
    token: str,
    allowed_collections: set[str] | None = None,
) -> _HTTPServer:
    if not token:
        raise ValueError("API token is required")
    server = _HTTPServer((host, port), LocalDBRequestHandler)
    server.store = store
    server.api_token = token
    server.allowed_collections = allowed_collections or set()
    return server


def _env_collections() -> set[str] | None:
    raw = os.getenv("LOCALDB_ALLOWED_COLLECTIONS", "")
    if not raw.strip():
        return None
    return {validate_collection_name(item.strip()) for item in raw.split(",") if item.strip()}


def main() -> None:
    parser = argparse.ArgumentParser(description="serve the local document store")
    parser.add_argument("--db", default=os.getenv("LOCALDB_PATH", "localdb.sqlite3"))
    parser.add_argument("--host", default=os.getenv("LOCALDB_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.getenv("LOCALDB_PORT", "8500")))
    args = parser.parse_args()
    store = LocalDocumentStore(args.db)
    server = make_server(args.host, args.port, store, os.getenv("LOCALDB_API_TOKEN", ""), _env_collections())
    print(f"localdb listening on {args.host}:{args.port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
