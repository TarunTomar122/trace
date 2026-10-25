"""The morning push skips a top story it already pushed under another headline."""

from __future__ import annotations

import unittest
from unittest.mock import patch

from v2.flows import send_push_notification as P


def _topic(tid: str, title: str, summary: str = "", url: str = "") -> dict:
    return {"id": tid, "title": title, "summary": summary,
            "articles": [{"url": url or f"https://news.example/{tid}"}]}


ONE_PASSWORD = _topic("t1", "1Password Unveils AI Agent Login Feature",
                      "1Password lets AI agents log in to sites without seeing passwords.")
CANVA = _topic("t2", "Canva Launches AI Image Generation Model", "Canva has its own image model.")
SENT = P._push_story(_topic("old", "1Password Launches AI Agent Login Tool",
                            "1Password now lets AI agents sign in for you without exposing passwords."))


class PickTopicTests(unittest.TestCase):
    def test_no_history_pushes_the_top_story(self):
        self.assertIs(P._pick_topic(None, [ONE_PASSWORD, CANVA], []), ONE_PASSWORD)

    def test_same_link_is_a_repeat_without_asking(self):
        same_link = _topic("t3", "Something else entirely", url=SENT["url"])
        with patch("v3.lib.repeats.judge_repeats", return_value={}) as judge:
            self.assertIs(P._pick_topic(None, [same_link, CANVA], [SENT]), CANVA)
        self.assertEqual(judge.call_args.args[1], [])

    def test_unjudged_look_alike_is_skipped(self):
        # No model: the push errs towards silence, unlike the daily email.
        with patch("v3.lib.repeats.judge_repeats", return_value=None):
            self.assertIs(P._pick_topic(None, [ONE_PASSWORD, CANVA], [SENT]), CANVA)

    def test_model_can_clear_a_look_alike(self):
        with patch("v3.lib.repeats.judge_repeats", return_value={0: False}):
            self.assertIs(P._pick_topic(None, [ONE_PASSWORD, CANVA], [SENT]), ONE_PASSWORD)

    def test_all_repeats_means_no_push(self):
        with patch("v3.lib.repeats.judge_repeats", return_value={0: True}):
            self.assertIsNone(P._pick_topic(None, [ONE_PASSWORD], [SENT]))



class _Doc:
    def __init__(self, data):
        self._data = data
        self.exists = data is not None

    def to_dict(self):
        return self._data


class _Ref:
    def __init__(self, docs, key):
        self.docs, self.key = docs, key

    def get(self):
        return _Doc(self.docs.get(self.key))

    def set(self, data, merge=False):
        self.docs[self.key] = {**(self.docs.get(self.key) or {}), **data} if merge else data


class _Store:
    def __init__(self, docs=None):
        self.docs = docs or {}
        outer = self

        class _Collection:
            def document(self, key):
                return _Ref(outer.docs, key)

        class _Db:
            def collection(self, _name):
                return _Collection()

        self.db = _Db()


class HistoryTests(unittest.TestCase):
    def test_reads_today_and_the_three_days_before(self):
        store = _Store({
            "2026-10-25": {"stories": [{"title": "today"}]},
            "2026-10-22": {"stories": [{"title": "three back"}, "junk"]},
            "2026-10-21": {"stories": [{"title": "too old"}]},
            "2026-10-24": {"stories": "not a list"},
        })
        titles = [s["title"] for s in P._recent_pushes(store, "2026-10-25")]
        self.assertEqual(titles, ["today", "three back"])

    def test_a_second_push_the_same_day_keeps_the_first(self):
        store = _Store()
        P._record_push(store, "2026-10-25", {"title": "first"})
        P._record_push(store, "2026-10-25", {"title": "second"})
        self.assertEqual([s["title"] for s in store.docs["2026-10-25"]["stories"]], ["first", "second"])

    def test_raw_trending_item_keeps_its_link(self):
        self.assertEqual(P._push_story({"title": "x", "url": "https://a.co"})["urls"], ["https://a.co"])


if __name__ == "__main__":
    unittest.main()
