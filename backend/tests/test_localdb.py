from __future__ import annotations

import json
import sqlite3
import sys
import tempfile
import threading
import unittest
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.localdb import LocalDocumentStore, canonical_json, normalise_value, stable_document_hash
from backend.localdb.server import make_server
from backend.scripts.migrate_firestore_to_local import (
    _migrate_archive,
    _migrate_firestore,
    collection_group_matches_path,
    iter_firestore_collection_group,
)
from backend.scripts.verify_local_migration import _local_hashes


class _FakeSnapshot:
    def __init__(self, path: str, data: dict):
        self.reference = type("Reference", (), {"path": path})()
        self._data = data

    def to_dict(self) -> dict:
        return self._data


class _FakeQuery:
    def __init__(self, snapshots: list[_FakeSnapshot]):
        self.snapshots = snapshots

    def order_by(self, field: str) -> "_FakeQuery":
        return self

    def stream(self):
        return iter(self.snapshots)


class _FakeFirestoreClient:
    def __init__(self, snapshots: list[_FakeSnapshot]):
        self.snapshots = snapshots
        self.collection_group_calls: list[str] = []

    def collection_group(self, name: str) -> _FakeQuery:
        self.collection_group_calls.append(name)
        return _FakeQuery(self.snapshots)


class LocalDBTest(unittest.TestCase):
    def test_collection_group_matching_and_selection_preserve_orphan_paths(self) -> None:
        self.assertTrue(collection_group_matches_path("watchlist", "users/deleted/watchlist/orphan"))
        self.assertFalse(collection_group_matches_path("watchlist", "users/deleted/other/document"))

        snapshots = [
            _FakeSnapshot("users/u1/watchlist/one", {"ticker": "AAPL"}),
            _FakeSnapshot("users/deleted/watchlist/orphan", {"ticker": "MSFT"}),
        ]
        client = _FakeFirestoreClient(snapshots)
        records = list(iter_firestore_collection_group(client, "watchlist"))

        self.assertEqual(client.collection_group_calls, ["watchlist"])
        self.assertEqual([record["path"] for record in records], [snapshot.reference.path for snapshot in snapshots])
        for record in records:
            self.assertEqual(record["hash"], stable_document_hash(record["path"], record["data"]))

    def test_collection_group_local_matching_scans_all_roots(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            store = LocalDocumentStore(Path(temporary) / "documents.sqlite3")
            orphan = store.upsert("users/deleted/watchlist/orphan", {"ticker": "MSFT"})
            store.upsert("accounts/a1/other/document", {"ticker": "AAPL"})

            actual = _local_hashes(store, [], ["watchlist"])

            self.assertEqual(actual, {orphan["path"]: orphan["hash"]})

    def test_export_then_archive_apply_uses_distinct_checkpoints(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            export_path = root / "firebase.jsonl"
            export_checkpoint = root / "firebase-export-checkpoint.json"
            import_checkpoint = root / "archive-import-checkpoint.json"
            snapshots = [_FakeSnapshot("users/deleted/watchlist/orphan", {"ticker": "MSFT"})]

            export_result = _migrate_firestore(
                _FakeFirestoreClient(snapshots),
                None,
                [],
                False,
                export_path,
                export_checkpoint,
                25,
                False,
                collection_groups=["watchlist"],
            )
            store = LocalDocumentStore(root / "documents.sqlite3")
            import_result = _migrate_archive(
                export_path,
                store,
                [],
                True,
                import_checkpoint,
                25,
                False,
                collection_groups=["watchlist"],
            )

            self.assertEqual(export_result, {"scanned": 1, "written": 0})
            self.assertEqual(import_result, {"scanned": 1, "written": 1})
            self.assertEqual(store.get("users/deleted/watchlist/orphan")["data"], {"ticker": "MSFT"})

    def test_non_finite_values_are_tagged_and_stable(self) -> None:
        value = {
            "nan": float("nan"),
            "positive": float("inf"),
            "negative": float("-inf"),
            "finite": 1.5,
        }
        expected = {
            "finite": 1.5,
            "nan": {"__localdb_type__": "nan"},
            "negative": {"__localdb_type__": "negative_infinity"},
            "positive": {"__localdb_type__": "positive_infinity"},
        }

        self.assertEqual(normalise_value(value), expected)
        self.assertEqual(json.loads(canonical_json(value)), expected)
        self.assertEqual(canonical_json(value), canonical_json(dict(reversed(list(value.items())))))
        self.assertEqual(stable_document_hash("users/u1", value), stable_document_hash("users/u1", expected))

    def test_store_and_authenticated_http_api(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            db_path = Path(temporary) / "documents.sqlite3"
            store = LocalDocumentStore(db_path)
            data = {"ticker": "AAPL", "nested": {"enabled": True}}
            stored = store.upsert("users/u1/watchlist/w1", data)
            self.assertEqual(stored["hash"], stable_document_hash(stored["path"], data))
            store.batch_upsert([{"path": "users/u1", "data": {"name": "test"}}])
            self.assertEqual(len(store.list_documents("users")), 2)
            with sqlite3.connect(db_path) as connection:
                self.assertEqual(connection.execute("PRAGMA journal_mode").fetchone()[0], "wal")

            server = make_server("127.0.0.1", 0, store, "test-token", {"users"})
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            base_url = f"http://127.0.0.1:{server.server_port}"
            try:
                with urlopen(f"{base_url}/health") as response:
                    self.assertEqual(json.load(response)["ok"], True)
                try:
                    urlopen(f"{base_url}/documents/users/u1")
                except HTTPError as error:
                    self.assertEqual(error.code, 401)
                    error.close()
                else:
                    self.fail("unauthenticated request unexpectedly succeeded")

                request = Request(
                    f"{base_url}/documents/users/u1",
                    data=json.dumps({"data": {"name": "updated"}}).encode(),
                    method="PUT",
                    headers={"Authorization": "Bearer test-token", "Content-Type": "application/json"},
                )
                with urlopen(request) as response:
                    self.assertEqual(json.load(response)["document"]["data"]["name"], "updated")

                request = Request(
                    f"{base_url}/documents:batchUpsert",
                    data=json.dumps(
                        {"documents": [{"path": "users/u1/watchlist/w2", "data": {"ticker": "MSFT"}}]}
                    ).encode(),
                    method="POST",
                    headers={"Authorization": "Bearer test-token", "Content-Type": "application/json"},
                )
                with urlopen(request) as response:
                    self.assertEqual(json.load(response)["count"], 1)

                request = Request(
                    f"{base_url}/documents:batchGet",
                    data=json.dumps(
                        {
                            "paths": ["users/u1", "users/u1/watchlist/w2", "users/missing"],
                            "select": ["name", "ticker"],
                        }
                    ).encode(),
                    method="POST",
                    headers={"Authorization": "Bearer test-token", "Content-Type": "application/json"},
                )
                with urlopen(request) as response:
                    payload = json.load(response)
                    self.assertEqual(payload["count"], 2)
                    self.assertEqual(payload["documents"][0]["data"], {"name": "updated"})
                    self.assertEqual(payload["documents"][1]["data"], {"ticker": "MSFT"})

                request = Request(
                    f"{base_url}/documents?collection=users&limit=10",
                    headers={"Authorization": "Bearer test-token"},
                )
                with urlopen(request) as response:
                    self.assertEqual(json.load(response)["count"], 3)
            finally:
                server.shutdown()
                thread.join(timeout=2)
                server.server_close()


class EqualityPrefilterTests(unittest.TestCase):
    """Equality filters narrowed in SQLite must give the same answers as Python alone."""

    def setUp(self):
        from datetime import datetime, timezone

        from backend.localdb.firestore import LocalFirestoreClient

        self.tmp = tempfile.TemporaryDirectory()
        self.client = LocalFirestoreClient(Path(self.tmp.name) / "db.sqlite3")
        pool = self.client.collection("pool")
        pool.document("a").set({"is_active": True, "lane": "ai", "n": 1})
        pool.document("b").set({"is_active": False, "lane": "ai", "n": 2})
        pool.document("c").set({"is_active": 1, "lane": "markets", "n": 2.0})  # Python: 1 == True
        pool.document("d").set({"lane": "ai"})  # field missing
        pool.document("e").set({"is_active": True, "when": datetime(2026, 10, 28, tzinfo=timezone.utc)})
        pool.document("f").set({"meta": {"kind": "x"}, "is_active": "true"})
        pool.document("a").collection("child").document("z").set({"is_active": True})  # not a direct child

    def tearDown(self):
        self.tmp.cleanup()

    def ids(self, query, prefilter=True):
        store = self.client._store
        if not prefilter:
            store.supports_equality_prefilter = False
        try:
            return sorted(doc.id for doc in query.stream())
        finally:
            store.supports_equality_prefilter = True

    def assertSame(self, query, expected):
        self.assertEqual(self.ids(query), expected)
        self.assertEqual(self.ids(query, prefilter=False), expected)

    def test_bool_matches_python_equality(self):
        pool = self.client.collection("pool")
        self.assertSame(pool.where("is_active", "==", True), ["a", "c", "e"])
        self.assertSame(pool.where("is_active", "==", False), ["b"])

    def test_strings_numbers_nested_and_combined(self):
        pool = self.client.collection("pool")
        self.assertSame(pool.where("lane", "==", "ai"), ["a", "b", "d"])
        self.assertSame(pool.where("n", "==", 2), ["b", "c"])
        self.assertSame(pool.where("meta.kind", "==", "x"), ["f"])
        self.assertSame(pool.where("is_active", "==", "true"), ["f"])
        self.assertSame(pool.where("is_active", "==", True).where("lane", "==", "ai"), ["a"])

    def test_timestamps_still_match_their_string_form(self):
        pool = self.client.collection("pool")
        self.assertSame(pool.where("when", "==", "2026-10-28T00:00:00+00:00"), ["e"])

    def test_other_operators_and_odd_paths_fall_back(self):
        pool = self.client.collection("pool")
        self.assertSame(pool.where("n", ">=", 2), ["b", "c"])
        self.assertSame(pool.where("is_active", "==", None), [])
        self.assertSame(pool.where("weird-key", "==", "x"), [])
        self.assertSame(pool.where("n", "==", 2**70), [])  # beyond SQLite's 64-bit ints
        self.assertSame(pool.where("lane", "==", "a\udc80"), [])  # lone surrogate


if __name__ == "__main__":
    unittest.main()
