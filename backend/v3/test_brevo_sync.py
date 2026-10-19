"""Brevo sync: blocks become opt-outs, events on our sends land in email_events.

  python3 -m unittest v3.test_brevo_sync
"""

from __future__ import annotations

import os
import sys
import tempfile
import types
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.localdb.firestore import LocalFirestoreClient  # noqa: E402

import v3.flows.sync_brevo as S  # noqa: E402

OURS = "newsletter@mail.yourtrace.online"
OTHER = "yourtrace.online@gmail.com"
TODAY = date(2026, 10, 19)


def _blocked(email: str, code: str, sender: str | None = OURS, at: str = "2026-10-18T12:00:00.000Z") -> dict:
    return {"email": email, "senderEmail": sender, "reason": {"code": code, "message": ""}, "blockedAt": at}


def _event(event: str, message_id: str, email: str = "a@x.com", link: str = "",
           at: str = "2026-10-19T14:05:00.000+05:30") -> dict:
    return {"email": email, "event": event, "messageId": message_id, "date": at, "link": link,
            "subject": "s", "from": OURS}


class _HTTPError(Exception):
    def __init__(self, response):
        super().__init__(str(response.status_code))
        self.response = response


class FakeBrevo:
    def __init__(self, blocked: list[dict], events: list[dict]):
        self.blocked, self.events, self.calls = blocked, events, []

    def __call__(self, path: str, params: dict) -> dict:
        self.calls.append((path, dict(params)))
        offset, limit = params["offset"], params["limit"]
        if path == "/smtp/blockedContacts":
            return {"contacts": self.blocked[offset:offset + limit]}
        # Brevo filters events by the day in the account's time zone.
        window = [e for e in self.events if params["startDate"] <= e["date"][:10] <= params["endDate"]]
        return {"events": window[offset:offset + limit]}


class SyncTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = LocalFirestoreClient(os.path.join(self.tmp.name, "db.sqlite3"))
        profiles = self.db.collection("user_profiles")
        profiles.document("u1").set({"email": "unsub@x.com", "name": "U"})
        profiles.document("u2").set({"email": "bounce@x.com"})
        profiles.document("u3").set({"email": "market-only@x.com"})
        profiles.document("u4").set({"email": "already-off@x.com", "dailyNewsletterEnabled": False})
        profiles.document("u5").set({"email": "spam@x.com", "newsletterOptIn": True})
        profiles.document("u6").set({"email": "oldsender@x.com"})
        landing = self.db.collection("free_newsletter_subscribers")
        landing.document("unsub@x.com").set({"email": "unsub@x.com", "active": True})
        landing.document("form-only@x.com").set({"email": "form-only@x.com", "active": True})
        self.db.collection("email_sends").document("s1").set(
            {"to": "a@x.com", "bucket": "member", "date": "2026-10-19", "track_id": "t1",
             "message_id": "<202610190831.1@smtp-relay.mailin.fr>", "transport": "brevo"})
        self.db.collection("email_sends").document("s2").set(
            {"to": "b@x.com", "bucket": "winback", "date": "2026-10-18", "track_id": "t2",
             "message_id": "<202610180831.2@smtp-relay.mailin.fr>", "transport": "brevo"})
        self.db.collection("email_sends").document("s3").set(
            {"to": "oldsender@x.com", "bucket": "pro", "date": "2026-09-25", "track_id": "t3",
             "message_id": "<202609250831.3@smtp-relay.mailin.fr>", "transport": "brevo"})
        self.blocked = [
            _blocked("Unsub@X.com", "unsubscribedViaEmail"),
            _blocked("bounce@x.com", "hardBounce", sender=None),
            _blocked("market-only@x.com", "unsubscribedViaEmail", sender=OTHER),
            _blocked("already-off@x.com", "unsubscribedViaEmail"),
            _blocked("spam@x.com", "contactFlaggedAsSpam"),
            _blocked("form-only@x.com", "hardBounce", sender=OTHER),
            _blocked("load1@example.com", "hardBounce", sender=None),
            _blocked("stranger@x.com", "unsubscribedViaEmail"),
            # Filed under the old Gmail sender, but it was one of our sends (event below).
            _blocked("oldsender@x.com", "unsubscribedViaEmail", sender=OTHER),
            {"email": "broken@x.com", "reason": "not an object", "blockedAt": "2026-10-18T12:00:00Z"},
        ]
        self.events = [
            _event("opened", "<202610190831.1@smtp-relay.mailin.fr>"),
            _event("loadedByProxy", "<202610190831.1@smtp-relay.mailin.fr>"),
            _event("delivered", "<202610190831.1@smtp-relay.mailin.fr>"),
            _event("clicks", "<202610180831.2@smtp-relay.mailin.fr>", email="b@x.com",
                   link="https://yourtrace.online/feed?from=email&et=t2&story=abc"),
            _event("unsubscribed", "<202610180831.2@smtp-relay.mailin.fr>", email="b@x.com"),
            _event("unsubscribed", "<202609250831.3@smtp-relay.mailin.fr>", email="oldsender@x.com",
                   at="2026-10-02T10:00:00.000+05:30"),
            # The account's other mail.
            _event("opened", "<202610190900.9@smtp-relay.mailin.fr>", email="trader@x.com"),
        ]
        self.env = patch.dict(os.environ, {"EMAIL_SENDER_BREVO": OURS})
        self.env.start()

    def tearDown(self):
        self.env.stop()
        self.tmp.cleanup()

    def doc(self, collection: str, doc_id: str) -> dict:
        return self.db.collection(collection).document(doc_id).get().to_dict() or {}

    def run_sync(self, **kwargs):
        brevo = FakeBrevo(self.blocked, self.events)
        return S.sync_brevo(self.db, get=brevo, today=TODAY, **kwargs), brevo

    def test_blocks_turn_the_daily_off_like_our_unsubscribe_link(self):
        result, _ = self.run_sync()
        unsub = self.doc("user_profiles", "u1")
        self.assertIs(unsub["dailyNewsletterEnabled"], False)
        self.assertIs(unsub["newsletterOptIn"], False)
        self.assertEqual(unsub["newsletterSuppressedReason"], "unsubscribe")
        self.assertTrue(unsub["newsletterUnsubscribedAt"].startswith("2026-10-18T12:00"))
        self.assertIs(self.doc("free_newsletter_subscribers", "unsub@x.com")["active"], False)

        bounce = self.doc("user_profiles", "u2")
        self.assertIs(bounce["dailyNewsletterEnabled"], False)
        self.assertEqual(bounce["newsletterSuppressedReason"], "hard_bounce")
        # A dead address is not an unsubscribe.
        self.assertNotIn("newsletterUnsubscribedAt", bounce)
        self.assertEqual(self.doc("user_profiles", "u5")["newsletterSuppressedReason"], "complaint")
        # Hard bounces count whoever sent; opt-outs only count against our sender.
        self.assertIs(self.doc("free_newsletter_subscribers", "form-only@x.com")["active"], False)
        self.assertNotIn("dailyNewsletterEnabled", self.doc("user_profiles", "u3"))

        # An opt-out Brevo filed under the old sender still counts when the
        # event shows it came from one of our sends.
        old = self.doc("user_profiles", "u6")
        self.assertIs(old["dailyNewsletterEnabled"], False)
        self.assertTrue(old["newsletterUnsubscribedAt"].startswith("2026-10-02T04:30"))

        s = result["suppressions"]
        self.assertEqual(s["new"], 5)
        self.assertEqual(s["reasons"], {"unsubscribe": 2, "hard_bounce": 2, "complaint": 1})
        self.assertEqual((s["profiles"], s["landing"]), (4, 2))
        self.assertIn({"email": "un***@x.com", "reason": "unsubscribe", "source": "blocked:unsubscribedViaEmail",
                       "at": "2026-10-18T12:00:00+00:00", "detail": OURS}, s["changes"])

    def test_a_block_is_applied_once_so_turning_the_daily_back_on_sticks(self):
        self.run_sync()
        self.db.collection("user_profiles").document("u1").set({"dailyNewsletterEnabled": True}, merge=True)
        result, _ = self.run_sync(full=True)
        self.assertIs(self.doc("user_profiles", "u1")["dailyNewsletterEnabled"], True)
        self.assertEqual(result["suppressions"]["new"], 0)
        # A new block for the same address is applied again.
        self.blocked[0] = _blocked("unsub@x.com", "unsubscribedViaEmail", at="2026-10-19T09:00:00.000Z")
        self.run_sync(full=True)
        self.assertIs(self.doc("user_profiles", "u1")["dailyNewsletterEnabled"], False)

    def test_a_block_on_an_address_already_off_still_counts_as_applied(self):
        # Unsubscribed through our footer link as well as Gmail's button.
        self.run_sync()
        self.db.collection("user_profiles").document("u4").set({"dailyNewsletterEnabled": True}, merge=True)
        self.run_sync(full=True)
        self.assertIs(self.doc("user_profiles", "u4")["dailyNewsletterEnabled"], True)

    def test_sender_and_reason_rules(self):
        ours = {OURS}
        self.assertEqual(S.suppression_reason(_blocked("a@x.com", "adminBlocked"), ours), "blocked_in_brevo")
        self.assertEqual(S.suppression_reason(_blocked("a@x.com", "unsubscribedViaApi", sender=""), ours), "unsubscribe")
        self.assertEqual(S.suppression_reason(_blocked("a@x.com", "unsubscribedViaEmail", sender=OTHER), ours), "")
        self.assertEqual(S.suppression_reason(_blocked("a@x.com", "hardBounce", sender=OTHER), ours), "hard_bounce")
        self.assertEqual(S.suppression_reason({"email": "a@x.com", "reason": "junk"}, ours), "")

    def test_a_hard_bounce_on_our_send_turns_the_daily_off(self):
        self.blocked = []
        self.events.append(dict(_event("hardBounces", "<202610190831.1@smtp-relay.mailin.fr>"),
                                reason="550-5.1.1 no such user"))
        self.db.collection("user_profiles").document("u7").set({"email": "a@x.com"})
        result, _ = self.run_sync()
        self.assertEqual(self.doc("user_profiles", "u7")["newsletterSuppressedReason"], "hard_bounce")
        bounced = [c for c in result["suppressions"]["changes"] if c["reason"] == "hard_bounce"]
        self.assertEqual([(c["email"], c["detail"]) for c in bounced], [("a***@x.com", "550-5.1.1 no such user")])
        bounce = [d.to_dict() for d in self.db.collection("email_events").stream() if d.to_dict()["kind"] == "bounce"]
        self.assertEqual(bounce[0]["detail"], "550-5.1.1 no such user")

    def test_events_on_our_sends_land_with_the_send_track_id(self):
        result, _ = self.run_sync()
        rows = [d.to_dict() for d in self.db.collection("email_events").stream()]
        by_kind = {r["kind"]: r for r in rows}
        self.assertEqual(sorted(by_kind), ["click", "open", "proxy_open", "unsubscribe"])
        self.assertEqual(len(rows), 5)
        self.assertEqual(by_kind["open"]["track_id"], "t1")
        self.assertEqual(by_kind["open"]["bucket"], "member")
        # Brevo's +05:30 timestamps are stored in UTC.
        self.assertEqual(by_kind["open"]["at"], "2026-10-19T08:35:00+00:00")
        self.assertEqual(by_kind["open"]["date"], "2026-10-19")
        self.assertEqual(by_kind["click"]["target"], "https://yourtrace.online/feed?from=email&story=abc")
        self.assertEqual(by_kind["click"]["bucket"], "winback")
        self.assertEqual(result["events"]["not_ours"], 1)
        self.assertEqual(result["events"]["stored"], 5)
        # Repeating the sync skips what is already stored.
        again, _ = self.run_sync(full=True)
        self.assertEqual(again["events"]["stored"], 0)
        self.assertEqual(len(list(self.db.collection("email_events").stream())), 5)

    def test_later_runs_only_read_since_the_last_sync(self):
        _, first = self.run_sync()
        blocked_params = [p for path, p in first.calls if path == "/smtp/blockedContacts"][0]
        self.assertNotIn("startDate", blocked_params)
        event_windows = [(p["startDate"], p["endDate"]) for path, p in first.calls if path != "/smtp/blockedContacts"]
        self.assertEqual(event_windows[0][0], "2026-09-19")
        self.assertEqual(event_windows[-1][1], "2026-10-19")
        self.assertEqual(self.doc("email_sync", "brevo")["synced_through"], "2026-10-19")

        brevo = FakeBrevo(self.blocked, self.events)
        S.sync_brevo(self.db, get=brevo, today=date(2026, 10, 20))
        starts = {p["startDate"] for _, p in brevo.calls}
        self.assertEqual(starts, {"2026-10-17"})

    def test_a_brevo_failure_leaves_the_cursor_alone(self):
        def down(path, params):
            raise RuntimeError("brevo down")
        with self.assertRaises(RuntimeError):
            S.sync_brevo(self.db, get=down, today=TODAY)
        self.assertFalse(self.db.collection("email_sync").document("brevo").get().exists)
        self.assertNotIn("dailyNewsletterEnabled", self.doc("user_profiles", "u1"))

    def test_an_end_date_past_brevo_today_retries_a_day_earlier(self):
        brevo = FakeBrevo(self.blocked, self.events)
        refusal = types.SimpleNamespace(
            status_code=400, text='{"message":"End date should not be greater than current date"}')

        def get(path, params):
            if params.get("endDate") == TODAY.isoformat():
                raise _HTTPError(refusal)
            return brevo(path, params)

        result = S.sync_brevo(self.db, get=get, today=TODAY)
        self.assertEqual(result["window"][1], "2026-10-18")
        self.assertEqual(self.doc("email_sync", "brevo")["synced_through"], "2026-10-18")

    def test_paging_reads_every_page(self):
        self.blocked = [_blocked(f"user{i}@x.com", "hardBounce", sender=None) for i in range(250)]
        _, brevo = self.run_sync()
        offsets = [p["offset"] for path, p in brevo.calls if path == "/smtp/blockedContacts"]
        self.assertEqual(offsets, [0, 100, 200])

    def test_dry_run_writes_nothing(self):
        result, _ = self.run_sync(dry_run=True)
        self.assertEqual(result["suppressions"]["new"], 5)
        self.assertEqual(list(self.db.collection("email_suppressions").stream()), [])
        self.assertNotIn("dailyNewsletterEnabled", self.doc("user_profiles", "u1"))
        self.assertEqual(list(self.db.collection("email_events").stream()), [])
        self.assertFalse(self.db.collection("email_sync").document("brevo").get().exists)
        self.assertIn("would turn", S.summary(result))

    def test_no_api_key_skips(self):
        with patch.dict(os.environ, {"BREVO_API_KEY": ""}):
            result = S.sync_brevo(self.db, today=TODAY)
        self.assertEqual(result, {"skipped": "BREVO_API_KEY is not set"})
        self.assertEqual(S.summary(result), "skipped: BREVO_API_KEY is not set")


class NewsletterHookTests(unittest.TestCase):
    """The daily syncs before it resolves the audience, and goes out if Brevo is down."""

    def run_newsletter(self, sync, dry_run: bool):
        import v3.flows.send_audience_newsletter as N

        order: list[str] = []

        def audience(store, v3_store):
            order.append("audience")
            return {"member": [], "winback": [], "landing": []}

        def tracked_sync(db, dry_run=False):
            order.append(f"sync dry_run={dry_run}")
            return sync()

        with patch.multiple(
            N,
            FirestoreStore=lambda: types.SimpleNamespace(db=None),
            V3Store=lambda: None,
            _load_global_feed=lambda store, day: {"stories": []},
            _send_worthy_verdicts=lambda v3_store, candidates: {},
            _candidates=lambda feed: [],
            _publish_edition=lambda *args, **kwargs: 1,
            _resolve_audience=audience,
            sync_brevo=tracked_sync,
        ):
            result = N.send_audience_newsletter(date="2026-10-19", dry_run=dry_run)
        return result, order

    def test_sync_runs_first_and_a_dry_run_only_reports(self):
        ok = {"dry_run": True, "suppressions": {"new": 0, "profiles": 0, "landing": 0, "reasons": {}},
              "events": {"kinds": {}}}
        result, order = self.run_newsletter(lambda: ok, dry_run=True)
        self.assertEqual(order, ["sync dry_run=True", "audience"])
        self.assertTrue(result["brevo_sync"].startswith("would turn the daily off for 0"))

    def test_a_brevo_failure_does_not_stop_the_send(self):
        def down():
            raise RuntimeError("brevo down")
        result, order = self.run_newsletter(down, dry_run=False)
        self.assertEqual(order, ["sync dry_run=False", "audience"])
        self.assertEqual(result["brevo_sync"], "skipped: brevo down")


if __name__ == "__main__":
    unittest.main()
