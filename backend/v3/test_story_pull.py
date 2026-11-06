import json
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

from v3.flows import post_instagram as ig
from v3.lib import story_pull as sp
from v3.test_post_instagram import FakeStore

NOW = datetime(2026, 11, 5, 18, 0, tzinfo=timezone.utc)


def client_returning(payload=None, error=None):
    client = MagicMock()
    if error:
        client.chat.completions.create.side_effect = error
    else:
        message = MagicMock(content=json.dumps(payload))
        client.chat.completions.create.return_value = MagicMock(choices=[MagicMock(message=message)])
    return client


class RankTests(unittest.TestCase):
    stories = [{"title": f"Story {i}", "text": f"Text {i}"} for i in range(4)]

    def test_order_and_reasons_cover_every_story_once(self):
        client = client_returning({"ranking": [{"index": 2, "reason": "launch"}, {"index": 2, "reason": "dup"},
                                               {"index": 9, "reason": "bad"}, {"index": 0, "reason": "AI"}]})
        self.assertEqual(sp.rank(self.stories, {}, client=client), [(2, "launch"), (0, "AI"), (1, ""), (3, "")])
        kwargs = client.chat.completions.create.call_args.kwargs
        self.assertEqual(kwargs["model"], sp.MODEL)
        self.assertEqual(kwargs["reasoning_effort"], sp.EFFORT)
        self.assertNotIn("temperature", kwargs)

    def test_the_prompt_carries_audience_evidence_and_stories(self):
        client = client_returning({"ranking": [{"index": 0, "reason": ""}]})
        found = {"shorts": [{"hook": "Pi price tripled", "views": 1330, "age_days": 3.0}],
                 "clicked": [{"title": "Samsung record profit", "readers": 3}]}
        sp.rank(self.stories, found, client=client)
        prompt = client.chat.completions.create.call_args.kwargs["messages"][0]["content"]
        for text in (sp.AUDIENCE, "1330 views (3.0 days old): Pi price tripled", "3 readers: Samsung record profit",
                     "[3] Story 3\nText 3"):
            self.assertIn(text, prompt)

    def test_failures_return_none(self):
        self.assertIsNone(sp.rank(self.stories, {}, client=client_returning(error=RuntimeError("offline"))))
        self.assertIsNone(sp.rank(self.stories, {}, client=client_returning({"ranking": []})))

    def test_one_story_needs_no_call(self):
        client = client_returning(error=AssertionError("called"))
        self.assertEqual(sp.rank(self.stories[:1], {}, client=client), [(0, "")])

    def test_no_evidence_says_so(self):
        self.assertIn("No evidence yet", sp.evidence_text({}))


class EvidenceTests(unittest.TestCase):
    def test_email_clicks_count_distinct_readers_and_ignore_click_everything(self):
        topic = {"title": "Samsung posts record AI chip profit",
                 "articles": [{"url": "https://fortune.com/2026/10/29/samsung-record/"},
                              {"url": "https://www.cnbc.com/samsung/"}]}
        other = {"title": "Lonely story", "articles": [{"url": "https://x.com/lonely"}]}
        store = FakeStore([topic, other])
        events = store.db.data.setdefault("email_events", {})
        link = "https://yourtrace.online/feed?from=email&story="
        fortune, cnbc = link + "https%3A%2F%2Ffortune.com%2F2026%2F10%2F29%2Fsamsung-record", link + "https%3A%2F%2Fcnbc.com%2Fsamsung"

        def click(key, email, target, date="2026-11-02", kind="click", msg="m1"):
            events[key] = {"date": date, "kind": kind, "target": target, "email": email, "message_id": msg}

        click("a", "ann@x", fortune)
        click("a2", "ann@x", cnbc)  # same reader, same story: one reader
        click("b", "bob@x", cnbc)
        click("c", "cat@x", cnbc, kind="open")
        click("d", "dan@x", "https://yourtrace.online/feed?from=email")
        click("old", "eve@x", cnbc, date="2026-09-01")
        click("lonely", "ann@x", link + "https%3A%2F%2Fx.com%2Flonely")  # one reader only
        for i in range(sp.CLICK_EVERYTHING):  # a bot opening every story in one email
            click(f"bot{i}", "bot@x", fortune if i == 0 else link + f"https%3A%2F%2Fz.com%2F{i}", msg="m2")
        self.assertEqual(sp.clicked_stories(store, NOW), [{"title": "Samsung posts record AI chip profit", "readers": 2}])

    def test_shorts_keep_recent_ones_with_views_most_viewed_first(self):
        posts = {"posts": {"edges": [
            {"node": {"sentAt": "2026-11-04T06:00:00Z", "externalLink": "https://yt/a", "text": "Hook A\nmore"}},
            {"node": {"sentAt": "2026-11-03T06:00:00Z", "externalLink": "https://yt/b", "text": "Hook B"}},
            {"node": {"sentAt": "2026-11-03T07:00:00Z", "externalLink": "https://yt/c", "text": "No count"}},
            {"node": {"sentAt": "2026-09-01T06:00:00Z", "externalLink": "https://yt/old", "text": "Old"}},
            {"node": {"sentAt": "2026-11-05T12:00:00Z", "externalLink": "https://yt/new", "text": "Too new"}},
        ]}}
        replies = [({"account": {"organizations": [{"id": "org"}]}}, []), (posts, [])]
        views = {"https://yt/a": 50, "https://yt/b": 1330, "https://yt/c": None, "https://yt/new": 1}
        with patch.object(ig, "youtube_channel", return_value="yt"), patch.object(ig, "buffer", side_effect=replies):
            shorts, missing = sp.recent_shorts(NOW, views=views.get)
        self.assertEqual(missing, 1)
        self.assertEqual([(s["hook"], s["views"]) for s in shorts], [("Hook B", 1330), ("Hook A", 50)])
        self.assertEqual(shorts[1]["age_days"], 1.5)

    def test_evidence_is_cached_for_hours_when_complete(self):
        store = FakeStore()
        with patch.object(sp, "recent_shorts", return_value=([{"hook": "h", "views": 5, "age_days": 2}], 0)), \
                patch.object(sp, "clicked_stories", return_value=[{"title": "T", "readers": 3}]) as clicked:
            first = sp.evidence(store, NOW)
            again = sp.evidence(store, NOW + timedelta(hours=1))
            later = sp.evidence(store, NOW + timedelta(hours=sp.EVIDENCE_HOURS + 1))
        self.assertEqual(first["clicked"], [{"title": "T", "readers": 3}])
        self.assertEqual(again["at"], first["at"])
        self.assertNotEqual(later["at"], first["at"])
        self.assertEqual(clicked.call_count, 2)

    def test_a_failed_or_mostly_unreadable_fetch_is_retried_soon(self):
        for shorts in (RuntimeError("buffer down"), ([{"hook": "h", "views": 5, "age_days": 2}], 3)):
            store = FakeStore()
            kwargs = {"side_effect": shorts} if isinstance(shorts, Exception) else {"return_value": shorts}
            with patch.object(sp, "recent_shorts", **kwargs), patch.object(sp, "clicked_stories", return_value=[]):
                first = sp.evidence(store, NOW)
                soon = sp.evidence(store, NOW + timedelta(hours=1))
            self.assertEqual(first["ttl_hours"], sp.RETRY_HOURS)
            self.assertNotEqual(soon["at"], first["at"])

    def test_many_shorts_keep_the_best_and_the_worst(self):
        posts = {"posts": {"edges": [{"node": {"sentAt": "2026-11-01T06:00:00Z", "externalLink": f"https://yt/{i}",
                                                "text": f"S{i}"}} for i in range(40)]}}
        replies = [({"account": {"organizations": [{"id": "org"}]}}, []), (posts, [])]
        with patch.object(ig, "youtube_channel", return_value="yt"), patch.object(ig, "buffer", side_effect=replies):
            shorts, _ = sp.recent_shorts(NOW, views=lambda link: int(link.rsplit("/", 1)[1]))
        views = [s["views"] for s in shorts]
        self.assertEqual(len(views), 2 * sp.SHORTS_EACH_END)
        self.assertEqual((views[0], views[-1]), (39, 0))
        self.assertNotIn(20, views)


class OwnerCallTests(unittest.TestCase):
    def test_calls_are_newest_first_fresh_and_in_the_prompt(self):
        store = FakeStore()
        with patch.object(sp, "recent_shorts", return_value=([], 0)), patch.object(sp, "clicked_stories", return_value=[]):
            sp.evidence(store, NOW)  # caches the measured part
            sp.add_owner_call(store, "bad", "Apple scans public iCloud links", "nobody cares", now=NOW)
            sp.add_owner_call(store, "good", "iPhone Duo sells out", now=NOW)
            found = sp.evidence(store, NOW + timedelta(minutes=5))
        self.assertEqual([c["story"] for c in found["owner"]], ["iPhone Duo sells out", "Apple scans public iCloud links"])
        self.assertNotIn("owner", store.db.data["story_pull"]["evidence"])
        text = sp.evidence_text(found)
        self.assertIn("- BAD: Apple scans public iCloud links (nobody cares)", text)
        self.assertIn("- GOOD: iPhone Duo sells out", text)

    def test_verdict_must_be_good_or_bad(self):
        with self.assertRaises(ValueError):
            sp.add_owner_call(FakeStore(), "meh", "x")
        with self.assertRaises(ValueError):
            sp.add_owner_call(FakeStore(), "bad", "  ")
        store = FakeStore()
        sp.add_owner_call(store, " Bad ", "x")
        self.assertEqual(sp.owner_calls(store)[0]["verdict"], "bad")


if __name__ == "__main__":
    unittest.main()
