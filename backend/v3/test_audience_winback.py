"""Audience split for the free launch: member / winback / landing.

  python3 -m unittest v3.test_audience_winback
"""

from __future__ import annotations

import os
import types
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import v3.flows.send_audience_newsletter as N

NOW = datetime.now(timezone.utc)
TODAY = NOW.strftime("%Y-%m-%d")


def _ago(days: int) -> str:
    return (NOW - timedelta(days=days)).isoformat()


class _Doc:
    def __init__(self, data: dict):
        self._data = data
        self.id = str(data.get("uid", ""))

    def to_dict(self) -> dict:
        return self._data


class _Query:
    def __init__(self, name: str, rows: list[dict], writes: list):
        self.name, self.rows, self.writes = name, rows, writes

    def where(self, field: str, op: str, value):
        tests = {">=": lambda a: str(a) >= str(value), "==": lambda a: a == value}
        rows = [r for r in self.rows if field in r and tests[op](r[field])]
        return _Query(self.name, rows, self.writes)

    def stream(self):
        return [_Doc(r) for r in self.rows]

    def document(self, doc_id: str):
        writes = self.writes
        path = f"{self.name}/{doc_id}"
        return types.SimpleNamespace(set=lambda data, merge=False: writes.append((path, data)))


PROFILES = [
    {"uid": "a", "email": "active@x.com", "lastActiveAt": _ago(1)},
    {"uid": "b", "email": "continuing@x.com", "lastActiveAt": _ago(40)},
    {"uid": "c", "email": "paid@x.com", "lastActiveAt": _ago(90), "subscriptionStatus": "active"},
    {"uid": "d", "email": "dormant1@x.com", "lastActiveAt": _ago(20)},
    {"uid": "e", "email": "dormant2@x.com", "lastActiveAt": _ago(60)},
    {"uid": "f", "email": "maxed@x.com", "lastActiveAt": _ago(30), "winbackSends": 3},
    {"uid": "g", "email": "recent@x.com", "lastActiveAt": _ago(30), "winbackSends": 1,
     "winbackLastSentAt": _ago(1)},
    {"uid": "h", "email": "optout@x.com", "lastActiveAt": _ago(1), "dailyNewsletterEnabled": False},
    {"uid": "i", "email": "wbonly@x.com", "lastActiveAt": _ago(30)},
    {"uid": "j", "email": "dormant-landing@x.com", "lastActiveAt": _ago(100)},
    {"uid": "k", "email": "deleted@x.com", "lastActiveAt": _ago(1), "deleted": True},
    # Paid before Trace went free; subscription cancelled since. Still a supporter.
    {"uid": "m", "email": "supporter@x.com", "lastActiveAt": _ago(90), "subscriptionStatus": "cancelled"},
]

COLLECTIONS = {
    # Saved a brief from /brief/customize before onboarding; "a" is already
    # onboarded and must not be counted twice.
    "user_profiles": [
        {"uid": "z", "email": "builder@x.com", "dailyNewsletterEnabled": True, "updatedAt": _ago(0)},
        {"uid": "a", "email": "active@x.com", "dailyNewsletterEnabled": True, "lastActiveAt": _ago(1)},
    ],
    "email_sends": [
        {"to": "continuing@x.com", "status": "sent", "bucket": "pro", "date": TODAY},
        # A win-back send must not count as "already gets the daily".
        {"to": "wbonly@x.com", "status": "sent", "bucket": "winback", "date": TODAY},
    ],
    "free_newsletter_subscribers": [
        {"email": "landing@x.com", "active": True},
        {"email": "dormant-landing@x.com", "active": True},
        {"email": "active@x.com", "active": True},
    ],
}

STORY = {"title": "T", "summary": "S", "url": "https://e.com/a", "source_name": "E",
         "sources": ["e.com"], "source_count": 2, "image": "https://img.e.com/a.jpg"}


def _emails(rows: list[dict]) -> list[str]:
    return sorted(r["email"] for r in rows)


class AudienceTests(unittest.TestCase):
    def setUp(self):
        self.writes: list = []
        self.store = types.SimpleNamespace(db=types.SimpleNamespace(
            collection=lambda name: _Query(name, COLLECTIONS.get(name, []), self.writes)
        ))
        self.v3 = types.SimpleNamespace(
            get_onboarded_users=lambda audience, max_inactive_days=7: [dict(p) for p in PROFILES]
        )

    def resolve(self, **env):
        clean = {k: "" for k in ("NEWSLETTER_WINBACK", "EMAIL_BREVO_BUCKETS", "NEWSLETTER_WINBACK_DAILY_CAP")}
        with patch.dict(os.environ, {**clean, **env}):
            return N._resolve_audience(self.store, self.v3)

    def test_members_keep_the_daily_and_winback_is_off_by_default(self):
        buckets = self.resolve()
        self.assertEqual(_emails(buckets["member"]),
                         ["active@x.com", "builder@x.com", "continuing@x.com", "paid@x.com", "supporter@x.com"])
        self.assertEqual(buckets["winback"], [])
        # Dormant account that also signed up on the landing page keeps that email.
        self.assertEqual(_emails(buckets["landing"]), ["dormant-landing@x.com", "landing@x.com"])

    def test_winback_refuses_to_send_from_our_mta(self):
        buckets = self.resolve(NEWSLETTER_WINBACK="1", EMAIL_BREVO_BUCKETS="pro")
        self.assertEqual(buckets["winback"], [])

    def test_winback_picks_most_recently_active_due_accounts_up_to_the_cap(self):
        buckets = self.resolve(NEWSLETTER_WINBACK="1", EMAIL_BREVO_BUCKETS="winback",
                               NEWSLETTER_WINBACK_DAILY_CAP="3")
        self.assertEqual([r["email"] for r in buckets["winback"]],
                         ["dormant1@x.com", "wbonly@x.com", "dormant2@x.com"])
        self.assertEqual(_emails(buckets["landing"]), ["dormant-landing@x.com", "landing@x.com"])

    def test_winback_send_is_counted(self):
        N._record_winback(self.store, {"uid": "d", "winback_sends": 1})
        path, data = self.writes[-1]
        self.assertEqual(path, "user_profiles/d")
        self.assertEqual(data["winbackSends"], 2)


class RenderTests(unittest.TestCase):
    def render(self, bucket: str):
        return N._render(bucket, [("ai", [dict(STORY)])], TODAY, "r@x.com", "tid")

    def test_no_paid_upsell_in_any_bucket(self):
        for bucket in ("member", "winback", "landing"):
            _, html, text = self.render(bucket)
            self.assertNotIn("Go Pro", html)
            self.assertNotIn("/subscribe", html)
            self.assertIn("Share today", html)
            self.assertIn(f"/brief/{TODAY}", text)

    def test_winback_leads_with_the_news_and_has_one_click_unsubscribe(self):
        subject, html, _ = self.render("winback")
        self.assertTrue(subject.startswith("Everything in Trace is unlocked"))
        self.assertIn("/api/unsubscribe?email=", html)
        self.assertIn("Open my feed", html)

    def test_formats_control_summaries_and_images(self):
        def html_for(story_format):
            return N._render("member", [("ai", [dict(STORY)])], TODAY, "r@x.com", "tid",
                             story_format=story_format)[1]
        summaries, headlines, images = html_for("summaries"), html_for("headlines"), html_for("images")
        self.assertIn(">S</p>", summaries)
        self.assertNotIn("img.e.com", summaries)
        self.assertNotIn(">S</p>", headlines)
        self.assertIn("img.e.com/a.jpg", images)
        self.assertIn(">S</p>", images)

    def test_video_thumbnails_are_not_used_as_images(self):
        self.assertEqual(N._image({"thumbnail": "https://e.com/clip.avi"}, {"thumbnail": "https://e.com/a.jpg"}),
                         "https://e.com/a.jpg")
        self.assertEqual(N._image({"thumbnail": "http://e.com/a.jpg"}), "")

    def test_reader_prefs_are_validated(self):
        prefs = N.newsletter_prefs({"newsletterTopics": ["ai", "bogus", "ai", "markets"],
                                    "newsletterStoryCount": 7, "newsletterFormat": "images"})
        self.assertEqual(prefs, {"interests": ["ai", "markets"], "count": 10, "format": "images"})
        fallback = N.newsletter_prefs({"interests": ["tech", "fintech"], "newsletterFormat": "x"})
        self.assertEqual(fallback, {"interests": ["tech"], "count": 10, "format": "summaries"})
        # Picking no topics in the builder means all of them, not feed interests.
        everything = N.newsletter_prefs({"newsletterTopics": [], "interests": ["tech"]})
        self.assertEqual(everything["interests"], [])
        # Lanes the pipeline does not publish are dropped.
        self.assertEqual(N.newsletter_prefs({"newsletterTopics": ["engineering", "ai"]})["interests"], ["ai"])

    def test_members_manage_settings_in_the_app(self):
        _, html, _ = self.render("member")
        self.assertIn("tab=profile", html)


if __name__ == "__main__":
    unittest.main()
