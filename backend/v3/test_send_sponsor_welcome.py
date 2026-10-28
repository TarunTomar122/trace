import argparse
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from v3.flows import send_sponsor_welcome as sponsor_welcome
from v3.test_send_welcome import FakeCollection

NOW = datetime(2026, 10, 28, 12, 0, tzinfo=timezone.utc)


class FakeStore:
    def __init__(self, tools):
        self.tables = {"promoted_tools": tools, "user_profiles": {}}
        self.db = type("DB", (), {"collection": lambda _, name: FakeCollection(self.tables[name])})()


def tool(**extra):
    return {
        "status": "active",
        "email": "maker@calenteri.com",
        "title": "Calenteri",
        "host": "calenteri.com",
        "created_at": (NOW - timedelta(hours=2)).isoformat(),
        "activated_at": (NOW - timedelta(hours=2)).isoformat(),
        "expires_at": (NOW + timedelta(days=29)).isoformat(),
        **extra,
    }


def args(**extra):
    return argparse.Namespace(**{"dry_run": False, "out": "/tmp/x", "test_to": None, "id": None, **extra})


class DueTests(unittest.TestCase):
    def test_new_active_sponsor_is_due(self):
        self.assertTrue(sponsor_welcome.due(tool(), NOW))

    def test_pending_old_or_welcomed_sponsors_are_not(self):
        self.assertFalse(sponsor_welcome.due(tool(status="pending"), NOW))
        self.assertFalse(sponsor_welcome.due(tool(created_at="2026-10-06T12:41:32Z"), NOW))
        # An old sponsor's renewal resets activated_at; still not welcomed.
        self.assertFalse(sponsor_welcome.due(tool(created_at="2026-10-06T12:41:32Z", activated_at=NOW.isoformat()), NOW))
        self.assertFalse(sponsor_welcome.due(tool(welcome_status="sent"), NOW))
        self.assertFalse(sponsor_welcome.due(tool(welcome_status="sending"), NOW))
        self.assertFalse(sponsor_welcome.due(tool(email=""), NOW))

    def test_failed_send_retries_after_a_wait_and_gives_up(self):
        recent = (NOW - timedelta(minutes=5)).isoformat()
        old = (NOW - timedelta(hours=1)).isoformat()
        self.assertFalse(sponsor_welcome.due(tool(welcome_status="failed", welcome_attempts=1, welcome_updated_at=recent), NOW))
        self.assertTrue(sponsor_welcome.due(tool(welcome_status="failed", welcome_attempts=1, welcome_updated_at=old), NOW))
        self.assertFalse(sponsor_welcome.due(tool(welcome_status="failed", welcome_attempts=3, welcome_updated_at=old), NOW))


class RenderTests(unittest.TestCase):
    def test_email_has_places_tracking_and_stats_link(self):
        subject, page, text = sponsor_welcome.render({"id": "abc12345", "stats_token": "tok", **tool()}, "Aleksi Suoknuuti")
        self.assertEqual(subject, "Calenteri is live on Trace")
        self.assertIn("Hi Aleksi,", text)
        self.assertIn("until 26 November", text)
        self.assertIn("utm_source=trace", text)
        self.assertIn("/sponsor/abc12345?k=tok", text)
        self.assertIn("/sponsor/abc12345?k=tok", page)
        self.assertIn("/brief", text)
        self.assertNotIn("None", text)
        renewing = sponsor_welcome.render({"id": "abc12345", "stats_token": "tok", "subscription_id": "sub_1", **tool()}, "")[2]
        self.assertIn("renews on 26 November", renewing)
        self.assertIn("Hi there,", renewing)


class SendTests(unittest.TestCase):
    def test_sends_once_with_a_token_and_records_it(self):
        store = FakeStore({"t1abcdefg": tool()})
        with patch.object(sponsor_welcome, "_send", return_value={"success": True, "transport": "brevo"}) as send:
            self.assertEqual(sponsor_welcome.welcome_all(store, args(), NOW), 0)
            self.assertEqual(sponsor_welcome.welcome_all(store, args(), NOW), 0)
        self.assertEqual(send.call_count, 1)
        saved = store.tables["promoted_tools"]["t1abcdefg"]
        self.assertEqual(saved["welcome_status"], "sent")
        self.assertGreaterEqual(len(saved["stats_token"]), 16)

    def test_failed_send_is_recorded_for_retry(self):
        store = FakeStore({"t1abcdefg": tool()})
        with patch.object(sponsor_welcome, "_send", return_value={"success": False, "error": "boom"}):
            self.assertEqual(sponsor_welcome.welcome_all(store, args(), NOW), 1)
        saved = store.tables["promoted_tools"]["t1abcdefg"]
        self.assertEqual((saved["welcome_status"], saved["welcome_attempts"]), ("failed", 1))

    def test_dry_run_sends_and_saves_nothing(self):
        store = FakeStore({"t1abcdefg": tool()})
        with patch.object(sponsor_welcome, "_send") as send, patch("pathlib.Path.write_text"), patch("pathlib.Path.mkdir"):
            sponsor_welcome.welcome_all(store, args(dry_run=True), NOW)
        send.assert_not_called()
        self.assertNotIn("welcome_status", store.tables["promoted_tools"]["t1abcdefg"])
        self.assertNotIn("stats_token", store.tables["promoted_tools"]["t1abcdefg"])

    def test_id_limits_the_run(self):
        store = FakeStore({"t1abcdefg": tool(), "t2abcdefg": tool(email="other@x.com")})
        with patch.object(sponsor_welcome, "_send", return_value={"success": True}) as send:
            sponsor_welcome.welcome_all(store, args(id="t2abcdefg"), NOW)
        self.assertEqual([c.args[2] for c in send.call_args_list], ["other@x.com"])


if __name__ == "__main__":
    unittest.main()
