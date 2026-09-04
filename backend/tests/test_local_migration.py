from __future__ import annotations

import tempfile
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.localdb import LocalDocumentStore, stable_document_hash
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


class LocalMigrationTest(unittest.TestCase):
    def test_collection_group_preserves_orphan_paths_and_hashes(self) -> None:
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

    def test_collection_group_verification_scans_all_local_roots(self) -> None:
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


if __name__ == "__main__":
    unittest.main()
