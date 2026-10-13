import argparse
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

from v3.flows import send_welcome as welcome

NOW = datetime(2026, 10, 14, 12, 0, tzinfo=timezone.utc)


class FakeDoc:
    def __init__(self, table, doc_id, fail_writes=False):
        self.table, self.id, self.fail_writes = table, doc_id, fail_writes

    def set(self, data, merge=False):
        if self.fail_writes:
            raise RuntimeError("database is locked")
        current = self.table.get(self.id, {}) if merge else {}
        self.table[self.id] = {**current, **data}


class FakeCollection:
    def __init__(self, table, fail_writes=False):
        self.table, self.fail_writes = table, fail_writes

    def stream(self):
        for doc_id, data in list(self.table.items()):
            snapshot = MagicMock()
            snapshot.id = doc_id
            snapshot.to_dict.return_value = dict(data)
            yield snapshot

    def document(self, doc_id):
        return FakeDoc(self.table, doc_id, self.fail_writes)


class FakeStore:
    def __init__(self, subscribers=None, profiles=None, markers=None, fail_writes=False):
        self.tables = {
            "free_newsletter_subscribers": dict(subscribers or {}),
            "user_profiles": dict(profiles or {}),
            welcome.MARKERS: dict(markers or {}),
        }
        self.db = MagicMock()
        self.db.collection.side_effect = lambda name: FakeCollection(
            self.tables[name], fail_writes and name == welcome.MARKERS
        )


def iso(minutes_ago):
    return (NOW - timedelta(minutes=minutes_ago)).isoformat()


def subscriber(email, minutes_ago=5, active=True):
    return {email: {"email": email, "subscribedAt": iso(minutes_ago), "active": active}}


class WhoTests(unittest.TestCase):
    def test_new_signups_in_the_window_only(self):
        store = FakeStore(
            subscribers={
                **subscriber("a@x.com"),
                **subscriber("old@x.com", minutes_ago=60 * 24 * 5),
                **subscriber("gone@x.com", active=False),
                "before@x.com": {"email": "before@x.com", "subscribedAt": "2026-10-12T23:00:00+00:00", "active": True},
            },
            profiles={
                "u1": {"email": "B@X.com", "displayName": "Bea Lane", "createdAt": NOW - timedelta(minutes=3)},
                "u2": {"email": "deleted@x.com", "createdAt": iso(10), "deleted": True},
                "u3": {"email": "", "createdAt": iso(10)},
                "u4": {"email": "old-account@x.com", "createdAt": "2026-09-01T00:00:00Z"},
                # Planted junk must not stop anyone else's welcome.
                "u5": {"email": "junk@x.com", "createdAt": 1e20},
                "u6": {"email": "junk2@x.com", "createdAt": {"seconds": "x"}},
            },
        )
        readers = welcome.new_readers(store, NOW)
        self.assertEqual([(r["email"], r["kind"]) for r in readers], [("a@x.com", "newsletter"), ("b@x.com", "account")])

    def test_joining_both_ways_gets_the_account_version_once(self):
        store = FakeStore(
            subscribers=subscriber("c@x.com", minutes_ago=50),
            profiles={"u1": {"email": "c@x.com", "name": "Cal", "createdAt": iso(40)}},
        )
        [reader] = welcome.new_readers(store, NOW)
        self.assertEqual((reader["kind"], reader["name"], reader["daily"]), ("account", "Cal", True))

    def test_daily_follows_the_newsletter_rules(self):
        store = FakeStore(profiles={
            "on": {"email": "on@x.com", "createdAt": iso(40), "onboarded": True},
            "off": {"email": "off@x.com", "createdAt": iso(40), "onboarded": True, "dailyNewsletterEnabled": False},
            "new": {"email": "new@x.com", "createdAt": iso(40), "onboarded": False},
            "builder": {"email": "builder@x.com", "createdAt": iso(40), "dailyNewsletterEnabled": True},
        })
        daily = {r["email"]: r["daily"] for r in welcome.new_readers(store, NOW)}
        self.assertEqual(daily, {"on@x.com": True, "off@x.com": False, "new@x.com": False, "builder@x.com": True})

    def test_accounts_wait_for_onboarding_or_half_an_hour(self):
        fresh = {"kind": "account", "joined": NOW - timedelta(minutes=5), "onboarded": False}
        self.assertFalse(welcome.ready(fresh, NOW))
        self.assertTrue(welcome.ready({**fresh, "onboarded": True}, NOW))
        self.assertTrue(welcome.ready({**fresh, "joined": NOW - timedelta(minutes=31)}, NOW))
        self.assertTrue(welcome.ready({"kind": "newsletter", "joined": NOW}, NOW))

    def test_markers_decide_who_is_due(self):
        self.assertTrue(welcome.due(None, NOW))
        for status in ("sending", "sent", "skipped"):
            self.assertFalse(welcome.due({"status": status}, NOW))
        failed = {"status": "failed", "attempts": 1, "updated_at": iso(10)}
        self.assertFalse(welcome.due(failed, NOW))
        self.assertTrue(welcome.due({**failed, "updated_at": iso(31)}, NOW))
        self.assertFalse(welcome.due({**failed, "attempts": 3, "updated_at": iso(120)}, NOW))

    def test_timestamps_in_every_stored_shape(self):
        for value in (NOW, NOW.isoformat(), NOW.isoformat().replace("+00:00", "Z"), NOW.timestamp(),
                      NOW.timestamp() * 1000, {"seconds": NOW.timestamp()}):
            self.assertEqual(welcome._when(value), NOW)
        for junk in ("soon", 1e20, {"seconds": "x"}, True, None, [1]):
            self.assertIsNone(welcome._when(junk))


class WhatTests(unittest.TestCase):
    def test_first_brief_day_follows_the_daily_send(self):
        # Tuesday 13 October: before the 9:30 UK send it's today, after it tomorrow.
        self.assertEqual(welcome.first_brief_day(datetime(2026, 10, 13, 8, 29, tzinfo=timezone.utc)), "Tuesday")
        self.assertEqual(welcome.first_brief_day(datetime(2026, 10, 13, 8, 31, tzinfo=timezone.utc)), "Wednesday")
        # Winter: 9:30 UK is 09:30 UTC.
        self.assertEqual(welcome.first_brief_day(datetime(2026, 11, 2, 9, 29, tzinfo=timezone.utc)), "Monday")

    def test_newsletter_version(self):
        reader = {"email": "a+b@x.com", "name": "", "kind": "newsletter", "joined": NOW - timedelta(minutes=5)}
        subject, page, text = welcome.render(reader, NOW)
        self.assertEqual(subject, "You're in. Your first Trace brief lands Thursday")
        self.assertTrue(text.startswith("Hi there,"))
        self.assertIn("The latest brief is already up", text)
        self.assertIn("/brief/customize", page)
        self.assertIn("/api/unsubscribe?email=a%2Bb%40x.com", page)
        self.assertIn("Read the latest brief", page)

    def test_a_late_newsletter_welcome_promises_no_first_day(self):
        reader = {"email": "a@x.com", "name": "", "kind": "newsletter", "joined": NOW - timedelta(hours=26)}
        subject, _, text = welcome.render(reader, NOW)
        self.assertEqual(subject, "You're in. Welcome to the Trace daily brief")
        self.assertNotIn("first daily brief", text)

    def test_account_version_says_whether_the_daily_is_on(self):
        reader = {"email": "a@x.com", "name": "MICHELLE Valiukenas", "kind": "account", "joined": NOW, "daily": True}
        subject, page, text = welcome.render(reader, NOW)
        self.assertEqual(subject, "You're in. Welcome to Trace")
        self.assertTrue(text.startswith("Hi Michelle,"))
        self.assertIn("Your daily brief lands every morning", text)
        self.assertIn(f"{welcome.APP_URL}/feed", page)
        self.assertNotIn("unsubscribe", page.lower())
        _, _, off = welcome.render({**reader, "daily": False}, NOW)
        self.assertIn("Set up your daily email", off)

    def test_names(self):
        self.assertEqual(welcome._first_name("o'neil smith"), "O'Neil")
        self.assertEqual(welcome._first_name("DJ Khaled"), "DJ")
        self.assertEqual(welcome._first_name("tom.smith@gmail.com"), "")
        self.assertEqual(welcome._first_name("<b>Eve</b>"), "<b>Eve</b>")
        _, page, _ = welcome.render({"email": "e@x.com", "name": "<b>Eve</b>", "kind": "account", "joined": NOW}, NOW)
        self.assertIn("Hi &lt;b&gt;Eve&lt;/b&gt;,", page)


class SendTests(unittest.TestCase):
    def args(self, **overrides):
        self.lock = tempfile.NamedTemporaryFile()
        return argparse.Namespace(**{"dry_run": False, "out": "/tmp/trace-welcome-test", "test_to": None,
                                     "lock": self.lock.name, **overrides})

    def store(self, count=3, **kwargs):
        subscribers = {}
        for i in range(count):
            subscribers.update(subscriber(f"r{i}@x.com", minutes_ago=5 + i))
        return FakeStore(subscribers=subscribers, **kwargs)

    def run_job(self, store, send, **kwargs):
        with patch.object(welcome, "FirestoreStore", return_value=store), \
                patch("v1.tools.email_sender.send_email", side_effect=send) as mock:
            return welcome.run(self.args(**kwargs), NOW), mock

    def ok(self, *args, **kwargs):
        return {"success": True, "transport": "brevo"}

    def test_sends_once_to_each_new_reader(self):
        store = self.store(3, markers={welcome._marker_id("r1@x.com"): {"status": "sent"}})
        code, mock = self.run_job(store, self.ok)
        self.assertEqual(code, 0)
        self.assertEqual(sorted(call.args[0] for call in mock.call_args_list), ["r0@x.com", "r2@x.com"])
        self.assertTrue(all(call.kwargs["bucket"] == "welcome" for call in mock.call_args_list))
        # A second run sends nothing: the markers say sent.
        code, mock = self.run_job(store, self.ok)
        mock.assert_not_called()
        self.assertEqual({m["status"] for m in store.tables[welcome.MARKERS].values()}, {"sent"})

    def test_failures_back_off_then_stop(self):
        store = self.store(1)
        code, _ = self.run_job(store, lambda *a, **k: {"success": False, "error": "quota"})
        [marker] = store.tables[welcome.MARKERS].values()
        self.assertEqual((code, marker["status"], marker["attempts"]), (1, "failed", 1))
        # Too soon for a retry.
        code, mock = self.run_job(store, self.ok)
        mock.assert_not_called()

    def test_undeliverable_addresses_are_skipped_for_good(self):
        store = FakeStore(subscribers=subscriber("test@example.com"))
        code, mock = self.run_job(store, self.ok)
        mock.assert_not_called()
        [marker] = store.tables[welcome.MARKERS].values()
        self.assertEqual((code, marker["status"]), (0, "skipped"))

    def test_no_marker_no_email(self):
        store = self.store(2, fail_writes=True)
        code, mock = self.run_job(store, self.ok)
        self.assertEqual(code, 1)
        mock.assert_not_called()

    def test_dry_run_sends_and_writes_nothing(self):
        store = self.store(2)
        code, mock = self.run_job(store, self.ok, dry_run=True)
        self.assertEqual(code, 0)
        mock.assert_not_called()
        self.assertEqual(store.tables[welcome.MARKERS], {})

    def test_caps_each_run_and_each_hour(self):
        code, mock = self.run_job(self.store(welcome.MAX_PER_RUN + 5), self.ok)
        self.assertEqual(mock.call_count, welcome.MAX_PER_RUN)
        busy = {f"m{i}": {"status": "sent", "created_at": iso(10)} for i in range(welcome.HOURLY_CAP - 2)}
        code, mock = self.run_job(self.store(10, markers=busy), self.ok)
        self.assertEqual(mock.call_count, 2)


if __name__ == "__main__":
    unittest.main()
