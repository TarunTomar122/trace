"""Pure helpers of backend/vps/trace-analytics-snapshot.py.

    python3 -m unittest backend.tests.test_trace_analytics_snapshot
"""
from __future__ import annotations

import importlib.util
import json
import os
import sqlite3
import statistics
import unittest
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
_spec = importlib.util.spec_from_file_location("trace_analytics_snapshot", ROOT / "backend/vps/trace-analytics-snapshot.py")
snap = importlib.util.module_from_spec(_spec)
assert _spec and _spec.loader
_spec.loader.exec_module(snap)

UTC = timezone.utc
NOW = datetime(2026, 11, 23, 12, 0, tzinfo=UTC)
NOW_MS = int(NOW.timestamp() * 1000)
DAY = 24 * 3600 * 1000


def iso_ms(ms: int) -> str:
    return datetime.fromtimestamp(ms / 1000, UTC).isoformat()


class MsOf(unittest.TestCase):
    def test_formats(self):
        self.assertEqual(snap.ms_of("2026-11-23T12:00:00Z"), NOW_MS)
        self.assertEqual(snap.ms_of("2026-11-23T12:00:00.000+00:00"), NOW_MS)
        self.assertEqual(snap.ms_of({"__localdb_type__": "timestamp", "value": "2026-11-23T12:00:00+00:00"}), NOW_MS)
        self.assertEqual(snap.ms_of({"_seconds": NOW_MS // 1000}), NOW_MS)
        self.assertEqual(snap.ms_of(str(NOW_MS)), NOW_MS)  # Firebase REST sends ms as a string
        self.assertEqual(snap.ms_of(NOW_MS // 1000), NOW_MS)
        for bad in (None, "", "soon", True, {}, [], -5, 0):
            self.assertIsNone(snap.ms_of(bad), bad)


class Plans(unittest.TestCase):
    def test_paid_trial_free(self):
        self.assertEqual(snap.plan_of({"subscriptionStatus": "active", "subscriptionId": "sub"}, NOW_MS)["plan"], "paid")
        self.assertTrue(snap.plan_of({"subscriptionStatus": "active", "subscriptionId": "sub"}, NOW_MS)["paying"])
        self.assertEqual(snap.plan_of({"subscriptionStatus": "trial"}, NOW_MS)["plan"], "trial")
        self.assertEqual(snap.plan_of({"appSubscriptionStatus": "active"}, NOW_MS), {"plan": "paid", "note": "in the app", "paying": True, "lapsed": False})
        self.assertEqual(snap.plan_of({"subscriptionStatus": "none"}, NOW_MS)["plan"], "free")
        self.assertEqual(snap.plan_of({}, NOW_MS), {"plan": "free", "note": None, "paying": False, "lapsed": False})

    def test_lapsed_and_cancelled(self):
        held = snap.plan_of({"subscriptionStatus": "on_hold"}, NOW_MS)
        self.assertEqual((held["plan"], held["note"], held["lapsed"]), ("free", "on hold", True))
        ended = snap.plan_of({"subscriptionStatus": "active", "subscriptionId": "s", "cancelledAt": "x", "willCancelAt": iso_ms(NOW_MS - DAY)}, NOW_MS)
        self.assertEqual((ended["plan"], ended["lapsed"]), ("free", True))
        ending = snap.plan_of({"subscriptionStatus": "active", "subscriptionId": "s", "cancelledAt": "x", "willCancelAt": iso_ms(NOW_MS + DAY)}, NOW_MS)
        self.assertEqual((ending["plan"], ending["note"]), ("paid", "cancels at period end"))
        # Like hasPaidSubscription: cancelled with no end date on file keeps access.
        self.assertEqual(snap.plan_of({"subscriptionStatus": "active", "cancelledAt": "x"}, NOW_MS)["plan"], "paid")


class Attribution(unittest.TestCase):
    def test_order(self):
        self.assertEqual(snap.from_of({"channel": "YouTube", "referralSource": "friend"}), {"id": "youtube", "heard": False})
        self.assertEqual(snap.from_of({"referredBy": "abcdefgh", "utmSource": "x"}), {"id": "referral", "heard": False})
        self.assertEqual(snap.from_of({"utmSource": "peerpush"}), {"id": "peerpush", "heard": False})
        self.assertEqual(snap.from_of({"affiliateCode": "ab12"}), {"id": "affiliate", "heard": False})
        self.assertEqual(snap.from_of({"referralSource": "instagram"}), {"id": "instagram", "heard": True})
        self.assertIsNone(snap.from_of({"referralSource": "  "}))

    def test_photo_and_method(self):
        self.assertEqual(snap.safe_photo("https://lh3.googleusercontent.com/a/x=s96"), "https://lh3.googleusercontent.com/a/x=s96")
        self.assertIsNone(snap.safe_photo("https://evil.example/x.png"))
        self.assertIsNone(snap.safe_photo("http://lh3.googleusercontent.com/a"))
        self.assertIsNone(snap.safe_photo("https://googleusercontent.com.evil.example/a"))
        self.assertEqual(snap.method_of(["google.com", "password"]), "google")
        self.assertEqual(snap.method_of(["apple.com"]), "apple")
        self.assertIsNone(snap.method_of([]))


def account(uid, created, **extra):
    return {"uid": uid, "email": f"{uid}@example.com", "displayName": uid.title(), "photoURL": None, "providers": ["google.com"], "createdMs": created, "lastSignInMs": None, "lastRefreshMs": None, **extra}


class BuildSignups(unittest.TestCase):
    def test_join_and_counts(self):
        auth = [
            account("ann", NOW_MS - 3 * DAY, lastRefreshMs=NOW_MS - DAY),
            account("bob", NOW_MS - 2 * DAY),
            account("cat", NOW_MS - 3600_000),
            account("gone", NOW_MS - 5 * DAY),
        ]
        profiles = {
            "ann": {"subscriptionStatus": "active", "subscriptionId": "s", "signupPlatform": "web", "referralSource": "youtube"},
            "bob": {"subscriptionStatus": "on_hold"},
            "gone": {"deleted": True},
            "orphan": {"email": "orphan@example.com", "createdAt": iso_ms(NOW_MS - DAY)},  # no Auth record: not an account
        }
        subscribers = [
            ("s1", {"email": "BOB@example.com", "active": True, "source": "daily_page", "subscribedAt": iso_ms(NOW_MS - 4 * DAY)}),
            ("s2", {"email": "reader@example.com", "active": False, "source": "landing_page", "subscribedAt": iso_ms(NOW_MS - 10 * DAY), "channel": "x"}),
            ("s3", {"email": "reader@example.com", "active": True, "subscribedAt": iso_ms(NOW_MS - DAY)}),  # same person again
        ]
        view = snap.build_signups(auth, profiles, subscribers, {"count": 2, "readers": 1}, NOW_MS)
        rows = {r["email"]: r for r in view["rows"]}
        self.assertEqual(view["total"], 4)
        self.assertEqual(set(rows), {"ann@example.com", "bob@example.com", "cat@example.com", "reader@example.com"})
        self.assertEqual([r["email"] for r in view["rows"]][0], "cat@example.com")  # newest first
        bob = rows["bob@example.com"]
        self.assertEqual((bob["kind"], bob["newsletter"], bob["form"], bob["createdMs"]), ("both", "on", "daily_page", NOW_MS - 4 * DAY))
        reader = rows["reader@example.com"]
        self.assertEqual((reader["kind"], reader["newsletter"], reader["from"]), ("newsletter", "off", {"id": "x", "heard": False}))
        ann = rows["ann@example.com"]
        self.assertEqual((ann["plan"], ann["paying"], ann["form"], ann["cameBack"], ann["from"]["heard"]), ("paid", True, "app_web", True, True))
        self.assertIsNone(rows["cat@example.com"]["cameBack"])  # under a day old
        self.assertEqual(view["newsletter"], {"active": 1, "total": 2})
        self.assertEqual(view["accounts"], {"total": 3, "cameBack": 1, "eligible": 2})
        self.assertEqual(view["paid"], {"count": 1, "paying": 1, "trial": 0, "lapsed": 1})
        self.assertEqual(view["referred"], {"count": 2, "readers": 1})
        self.assertEqual(len(view["created"]), 4)
        self.assertFalse(view["authMissing"])
        self.assertNotIn("lapsed", view["rows"][0])

    def test_profiles_stand_in_without_auth(self):
        profiles = {"a": {"email": "a@example.com", "createdAt": iso_ms(NOW_MS)}, "b": {"onboarded": True}, "c": {"email": "c@example.com", "deleted": True}}
        view = snap.build_signups(None, profiles, [], {}, NOW_MS)
        self.assertTrue(view["authMissing"])
        self.assertEqual([r["id"] for r in view["rows"]], ["a"])

    def test_cap(self):
        subscribers = [(f"s{i}", {"email": f"r{i}@example.com", "active": True, "subscribedAt": iso_ms(NOW_MS - i * 1000)}) for i in range(snap.MAX_ROWS + 5)]
        view = snap.build_signups([], {}, subscribers, {}, NOW_MS)
        self.assertEqual((len(view["rows"]), view["rowsTotal"], len(view["created"])), (snap.MAX_ROWS, snap.MAX_ROWS + 5, snap.MAX_ROWS + 5))


class ReadFields(unittest.TestCase):
    def test_top_level_docs_and_objects(self):
        db = sqlite3.connect(":memory:")
        db.execute("CREATE TABLE documents (path TEXT, collection TEXT, document_id TEXT, data_json TEXT, document_hash TEXT, updated_at TEXT)")
        stamp = {"__localdb_type__": "timestamp", "value": "2026-11-23T12:00:00+00:00"}
        db.execute("INSERT INTO documents VALUES ('user_profiles/u1','user_profiles','u1',?, '', '')", (json.dumps({"email": "a@b.c", "createdAt": stamp, "other": 1}),))
        db.execute("INSERT INTO documents VALUES ('user_profiles/u1/sub/x','user_profiles','x',?, '', '')", (json.dumps({"email": "no"}),))
        rows = snap.read_fields(db, "user_profiles", ("email", "createdAt", "missing"))
        self.assertEqual(rows, [("u1", {"email": "a@b.c", "createdAt": stamp})])


class SystemHelpers(unittest.TestCase):
    def test_job_unit(self):
        self.assertEqual(snap.job_unit({"USER_UNIT": "trace-reel-2026-11-23-0600-delta-outage.service"}), "trace-reel.service")
        self.assertEqual(snap.job_unit({"UNIT": "trace-localdb-backup.service"}), "trace-localdb-backup.service")
        self.assertIsNone(snap.job_unit({"UNIT": "trace-web.service"}))
        self.assertIsNone(snap.job_unit({"UNIT": "tikrr-web@3000.service"}))
        self.assertIsNone(snap.job_unit({"USER_UNIT": "trace-pulse.timer"}))

    def test_summarize_jobs_aliases_round_trip(self):
        seen = []

        def fake(entries):
            entries = list(entries)
            seen.extend(e["UNIT"] for e in entries)
            return [{"unit": u} for u in sorted(set(seen))]

        rows = snap.summarize_jobs([{"USER_UNIT": "trace-pulse.service"}, {"UNIT": "trace-web.service"}, {"UNIT": "cron.service"}], fake)
        self.assertEqual(seen, ["tikrr-trace-pulse.service"])
        self.assertEqual(rows, [{"unit": "trace-pulse.service"}])

    def test_daily_brief(self):
        self.assertEqual(snap.daily_brief_check("daily_editions/2026-11-23", NOW)["status"], "ok")
        self.assertEqual(snap.daily_brief_check("daily_editions/2026-11-22", NOW.replace(hour=9))["status"], "ok")
        self.assertEqual(snap.daily_brief_check("daily_editions/2026-11-22", NOW)["status"], "warn")
        self.assertEqual(snap.daily_brief_check("daily_editions/2026-11-20", NOW)["status"], "fail")
        self.assertEqual(snap.daily_brief_check(None, NOW)["status"], "fail")

    def test_pipeline(self):
        self.assertEqual(snap.pipeline_check(NOW_MS - 600_000, NOW)["status"], "ok")
        self.assertEqual(snap.pipeline_check(NOW_MS - 2 * 3600_000, NOW)["status"], "warn")
        self.assertEqual(snap.pipeline_check(NOW_MS - 5 * 3600_000, NOW)["status"], "fail")
        self.assertEqual(snap.pipeline_check(None, NOW)["status"], "unknown")

    def test_backup(self):
        row, summary = snap.backup_summary([], NOW, False)
        self.assertEqual((row["status"], summary), ("warn", None))
        t = NOW.timestamp()
        files = [("b", t - 30 * 3600, 20), ("a", t - 6 * 3600, 30)]
        row, summary = snap.backup_summary(files, NOW, False)
        self.assertEqual(row["status"], "ok")
        self.assertIn("this box only", row["detail"])
        self.assertEqual((summary["compressed_bytes"], summary["dailies"], [f["bytes"] for f in summary["files"]]), (30, 2, [30, 20]))
        row, _ = snap.backup_summary([("a", t - 60 * 3600, 1)], NOW, True)
        self.assertEqual(row["status"], "fail")
        self.assertNotIn("this box only", row["detail"])

    def test_timers(self):
        rows = [
            {"unit": "trace-pulse.timer", "activates": "trace-pulse.service", "next": NOW_MS * 1000, "last": 0},
            {"unit": "tikrr-x.timer", "activates": "tikrr-x.service", "next": 1, "last": 1},
            {"unit": "trace-analytics-snapshot.timer", "activates": "trace-analytics-snapshot.service", "next": 1, "last": 1},
        ]
        self.assertEqual(snap.timer_rows(rows, True), [{"unit": "trace-pulse.service", "next_at": "2026-11-23T12:00:00+00:00", "last_at": None, "user": True}])

    def test_history_and_worst(self):
        self.assertEqual(snap.worst(["ok", "unknown", "warn"]), "warn")
        self.assertEqual(snap.worst(["unknown"]), "unknown")
        old = {"entries": [{"t": "2026-11-22T11:00:00+00:00"}, {"t": "2026-11-23T11:55:00+00:00"}]}
        result = {"generated_at": "2026-11-23T12:00:00+00:00", "overall": "ok", "checks": [{"id": "a", "status": "fail"}], "traffic": {}}
        entry = snap.history_entry(result)
        self.assertEqual(entry["c"], {"a": "r"})
        self.assertEqual([e["t"] for e in snap.merge_history(old, entry, NOW)], ["2026-11-23T11:55:00+00:00", "2026-11-23T12:00:00+00:00"])

    def test_cpu_share(self):
        previous = {"generated_at": "2026-11-23T11:55:00+00:00", "services": [{"name": "web", "cpu_usec": 1_000_000}]}
        rows = snap.with_cpu_share([{"name": "web", "cpu_usec": 31_000_000}, {"name": "db", "cpu_usec": 5}], previous, NOW)
        self.assertEqual([r["cpu_pct"] for r in rows], [10.0, None])


class ReusedHealthModule(unittest.TestCase):
    """When StocksBrew's checker sits next to this repo (on the laptop), the aliasing works against the real one."""

    def test_real_summarize_units(self):
        path = ROOT.parent / "tikrr/backend/ops/health.py"
        if not path.exists():
            self.skipTest("StocksBrew checkout not found")
        sb = snap.load_sb_health(str(path))
        self.assertIsNotNone(sb)
        entries = [
            {"USER_UNIT": "trace-pulse.service", "MESSAGE_ID": sb.RESOURCES_ID, "MESSAGE": "trace-pulse.service: Consumed 2s CPU time over 4s wall clock time", "CPU_USAGE_NSEC": "2000000000", "MEMORY_PEAK": "1000", "__REALTIME_TIMESTAMP": str(NOW_MS * 1000)},
            {"USER_UNIT": "trace-pulse.service", "MESSAGE_ID": sb.FAILED_ID, "MESSAGE": "failed", "__REALTIME_TIMESTAMP": str(NOW_MS * 1000 + 1)},
        ]
        rows = snap.summarize_jobs(entries, sb.summarize_units)
        self.assertEqual(len(rows), 1)
        self.assertEqual((rows[0]["unit"], rows[0]["runs"], rows[0]["failures"], rows[0]["median_s"], rows[0]["last_ok"]), ("trace-pulse.service", 1, 1, statistics.median([4.0]), False))
        self.assertEqual(sb.USER_AGENT, "trace-ops-health/1")


class LegacyCounts(unittest.TestCase):
    def test_counts_from_rows(self):
        subscribers = [
            ("s1", {"email": " A@x.com ", "active": True, "source": "daily_page", "subscribedAt": "2026-11-23T08:00:00Z", "channel": "youtube"}),
            ("s2", {"email": "b@x.com", "active": False, "subscribedAt": "2026-10-01T08:00:00Z", "referredBy": "ABCDEFGH"}),
            ("s3", {"email": "c@x.com", "active": True, "subscribedAt": "2026-11-22T08:00:00Z", "referredBy": "abcdefgh"}),
        ]
        profiles = {"u1": {"email": "a@x.com", "signupChannel": "x"}, "u2": {"email": "d@x.com", "signupChannel": "x"}}
        out = snap.newsletter_counts(profiles, subscribers, "", NOW)
        self.assertEqual((out["total"], out["active"]), (3, 2))
        self.assertEqual(out["daily"], {"2026-11-22": 1, "2026-11-23": 1})  # Oct 1 is outside the 30 days
        self.assertEqual(out["channels"], [{"label": "x", "n": 1}, {"label": "youtube", "n": 1}])  # d@ via profile; a@ counted once
        self.assertEqual(out["forms"], [{"label": "landing_page", "n": 2}, {"label": "daily_page", "n": 1}])
        self.assertEqual((out["referred"], out["_readers"], out["referrers"][0]["label"]), (2, 1, "code abcdefgh"))

    def test_own_link_is_not_a_referral(self):
        secret = "s3cret"
        code = snap.code_for("owner@x.com", secret)
        subscribers = [("s1", {"email": "owner@x.com", "referredBy": code}), ("s2", {"email": "friend@x.com", "referredBy": code})]
        out = snap.newsletter_counts({}, subscribers, secret, NOW)
        self.assertEqual((out["referred"], out["referrers"][0]["label"]), (1, "ow•••@x.com"))


class Safety(unittest.TestCase):
    def test_root_only(self):
        import tempfile
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder, "m.py")
            path.write_text("")
            # Owned by this (non-root) user: never good enough to run as root.
            self.assertFalse(snap.root_only(str(path)))
        self.assertTrue(snap.root_only("/bin/sh") or os.stat("/bin").st_uid != 0)

    def test_budget(self):
        saved = snap._STARTED
        try:
            snap._STARTED = snap.time.monotonic() - snap.BUDGET_S - 1
            self.assertEqual(snap.left(), 0.0)
            with self.assertRaises(TimeoutError):
                snap.run_command(["true"])
        finally:
            snap._STARTED = saved
        self.assertEqual(snap.run_command(["echo", "hi"]).strip(), "hi")


if __name__ == "__main__":
    unittest.main()
