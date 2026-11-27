"""The daily send adds its emails to each sponsor's view count (sponsor_views.emails).

  python3 -m unittest v3.test_sponsor_email_count
"""

from __future__ import annotations

import types
import unittest
from datetime import datetime, timezone

import v3.flows.send_audience_newsletter as N


class _Store:
    def __init__(self, fail: bool = False):
        self.writes: list[tuple[str, dict, bool]] = []
        self.fail = fail

    @property
    def db(self):
        store = self

        def document(name):
            def doc(doc_id):
                def set_(data, merge=False):
                    if store.fail:
                        raise RuntimeError("db down")
                    store.writes.append((f"{name}/{doc_id}", data, merge))
                return types.SimpleNamespace(set=set_)
            return types.SimpleNamespace(document=doc)

        return types.SimpleNamespace(collection=document)


class SponsorEmailCount(unittest.TestCase):
    def test_each_sponsor_gets_the_runs_sends(self):
        store = _Store()
        N._record_sponsor_emails(store, [{"id": "a1"}, {"id": "b2"}], 240)
        day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        self.assertEqual([w[0] for w in store.writes], [f"sponsor_views/a1_{day}", f"sponsor_views/b2_{day}"])
        data = store.writes[0][1]
        self.assertTrue(store.writes[0][2])  # merged, so the site's views stay
        self.assertEqual(data["sponsor_id"], "a1")
        self.assertEqual(data["day"], day)
        self.assertEqual(data["emails"].value, 240)  # firestore.Increment

    def test_no_sponsors_no_writes_and_failures_never_raise(self):
        store = _Store()
        N._record_sponsor_emails(store, [], 240)
        self.assertEqual(store.writes, [])
        N._record_sponsor_emails(_Store(fail=True), [{"id": "a1"}], 10)


if __name__ == "__main__":
    unittest.main()
