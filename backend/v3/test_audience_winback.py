"""Audience split for the free launch: member / winback / landing.

  python3 -m unittest v3.test_audience_winback
"""

from __future__ import annotations

import os
import re
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
        self.collections = {name: list(rows) for name, rows in COLLECTIONS.items()}
        self.store = types.SimpleNamespace(db=types.SimpleNamespace(
            collection=lambda name: _Query(name, self.collections.get(name, []), self.writes)
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

    def test_a_visit_from_an_email_moves_a_dormant_reader_onto_the_daily(self):
        self.collections["email_events"] = [
            {"kind": "visit", "email": "Dormant1@X.com", "date": TODAY},
            # Only browser-reported visits count, and only inside the window.
            {"kind": "click", "email": "dormant2@x.com", "date": TODAY},
            {"kind": "visit", "email": "wbonly@x.com", "date": _ago(30)[:10]},
        ]
        buckets = self.resolve(NEWSLETTER_WINBACK="1", EMAIL_BREVO_BUCKETS="winback")
        self.assertIn("dormant1@x.com", _emails(buckets["member"]))
        self.assertEqual(_emails(buckets["winback"]), ["dormant-landing@x.com", "dormant2@x.com", "wbonly@x.com"])

    def test_a_visit_never_overrides_opt_out_or_deletion(self):
        self.collections["email_events"] = [
            {"kind": "visit", "email": "optout@x.com", "date": TODAY},
            {"kind": "visit", "email": "deleted@x.com", "date": TODAY},
        ]
        buckets = self.resolve(NEWSLETTER_WINBACK="1", EMAIL_BREVO_BUCKETS="winback")
        everyone = _emails(buckets["member"] + buckets["winback"] + buckets["landing"])
        self.assertNotIn("optout@x.com", everyone)
        self.assertNotIn("deleted@x.com", everyone)

    def test_a_maxed_out_winback_reader_who_came_back_still_joins(self):
        self.collections["email_events"] = [{"kind": "visit", "email": "maxed@x.com", "date": TODAY}]
        buckets = self.resolve()
        self.assertIn("maxed@x.com", _emails(buckets["member"]))

    def test_an_unreadable_visit_log_does_not_stop_the_send(self):
        real = self.store.db.collection

        def collection(name):
            if name == "email_events":
                raise RuntimeError("down")
            return real(name)

        self.store.db.collection = collection
        buckets = self.resolve()
        self.assertIn("active@x.com", _emails(buckets["member"]))

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
        self.assertIn("Choose the topics you follow", html)

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
        # Lanes the pipeline does not publish (engineering was retired) are dropped.
        self.assertEqual(N.newsletter_prefs({"newsletterTopics": ["engineering", "ai"]})["interests"], ["ai"])
        # Robotics is a lane readers can pick, from the builder or feed interests.
        self.assertEqual(N.newsletter_prefs({"newsletterTopics": ["robotics", "ai"]})["interests"],
                         ["robotics", "ai"])
        self.assertEqual(N.newsletter_prefs({"interests": ["robotics"]})["interests"], ["robotics"])

    def test_come_read_links_carry_the_send_id_but_share_and_unsubscribe_do_not(self):
        with patch.dict(os.environ, {"EMAIL_TRACKING": "0"}):
            _, html, text = self.render("winback")
        self.assertIn("/feed?from=email&story=https%3A%2F%2Fe.com%2Fa&et=tid", html)
        self.assertIn("/feed?from=email&et=tid", html)
        self.assertIn("/brief/customize?from=email&et=tid", html)
        self.assertIn(f"/brief/{TODAY}?from=email-share\"", html)
        self.assertNotIn("from=email-share&et=", html)
        self.assertNotIn("unsubscribe?email=r%40x.com&et=", html)
        self.assertIn('href="https://e.com/a"', html)  # the source link is untouched
        self.assertIn("/brief/customize?from=email&et=tid", text)
        self.assertNotIn("&et=", N._render("member", [("ai", [dict(STORY)])], TODAY, "r@x.com", "")[1])

    def test_publisher_links_never_get_the_send_id(self):
        story = dict(STORY, url="https://pub.example/a?from=email&x=1")
        with patch.dict(os.environ, {"EMAIL_TRACKING": "0"}):
            html = N._render("member", [("ai", [story])], TODAY, "r@x.com", "tid")[1]
        self.assertNotIn("pub.example/a?from=email&x=1&et=", html)
        self.assertNotIn("pub.example/a?from=email&amp;x=1&amp;et=", html)
        # Our own story link for the same article still carries it.
        self.assertIn("&et=tid", html)
        tagged = N._tag_visit_links(
            '<a href="https://www.yourtrace.online/feed?from=email">'
            '<a href="https://evil-yourtrace.online/feed?from=email">', "tid")
        self.assertIn("www.yourtrace.online/feed?from=email&et=tid", tagged)
        self.assertIn('evil-yourtrace.online/feed?from=email"', tagged)

    def test_visit_url_keeps_fragments_and_escaping(self):
        self.assertEqual(N._visit_url("https://t.co/a", "x"), "https://t.co/a?et=x")
        self.assertEqual(N._visit_url("https://t.co/a?from=email#top", "x"), "https://t.co/a?from=email&et=x#top")
        self.assertEqual(N._visit_url("https://t.co/a?from=email&amp;b=1", "x"),
                         "https://t.co/a?from=email&amp;b=1&amp;et=x")

    def test_tracking_redirect_keeps_the_send_id_in_the_destination(self):
        with patch.dict(os.environ, {"EMAIL_TRACKING": "1"}):
            _, html, _ = self.render("member")
        self.assertIn("from%3Demail%26et%3Dtid", html)

    def test_members_manage_settings_in_the_app(self):
        _, html, _ = self.render("member")
        self.assertIn("tab=profile", html)

    def test_one_heading_per_run_of_the_same_label(self):
        sections = [
            (N.MODEL_RELEASE_LANE, [dict(STORY)]),
            ("ai", [dict(STORY)]),
            ("markets", [dict(STORY)]),
        ]

        def labels(bucket: str) -> list[str]:
            html = N._sections_html(bucket, sections)
            return re.findall(r'<span style="background-color: #ffef5f; padding: 0 5px;">([^<]+)</span>', html)

        # Landing labels every lane "Top stories": one heading for the run.
        self.assertEqual(labels("landing"), ["Model releases", "Top stories"])
        # Members see a heading per topic.
        self.assertEqual(labels("member"), ["Model releases", "Top in AI", "Top in Markets"])

    def test_landing_cta_opens_the_brief_builder(self):
        # No send id, so links stay plain instead of going through the tracker.
        _, html, _ = N._render("landing", [("ai", [dict(STORY)])], TODAY, "r@x.com", "")
        self.assertIn("/brief/customize?from=email", html)
        self.assertIn("Choose the topics you follow", html)
        self.assertNotIn("Personalize it", html)



class UnsubscribeHeaderTests(unittest.TestCase):
    def test_every_bucket_gets_the_one_click_endpoint(self):
        # Gmail's one-click POSTs to the header URL; a settings page would ignore it.
        story = {"title": "t", "url": "https://x.co"}
        for bucket in ("member", "winback", "landing"):
            with patch.object(N, "_select_from_groups", return_value=[("ai", [story])]), \
                    patch.object(N, "_render", return_value=("s", "<p>h</p>", "t")), \
                    patch.object(N, "send_newsletter_email", return_value={"success": True}) as send:
                N._send_one(None, [], "2026-10-24", bucket, {"email": "A+b@x.co", "count": 1}, False, {})
            self.assertEqual(send.call_args.kwargs["list_unsubscribe"],
                             f"{N.APP_URL}/api/unsubscribe?email=A%2Bb%40x.co", bucket)


if __name__ == "__main__":
    unittest.main()
