"""The daily email's editor pass (v3.lib.newsletter_editor) and how the send uses it."""

import re
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from v3.flows import send_audience_newsletter as N
from v3.lib import newsletter_editor as E

NOW = datetime(2026, 11, 5, 8, 0, tzinfo=timezone.utc)


def group(topic_id, title, **extra):
    return {
        "topic_id": topic_id, "title": title, "summary": f"{title}.", "url": f"https://e.com/{topic_id}",
        "urls": [f"https://e.com/{topic_id}"], "source_name": "E", "sources": ["e.com"],
        "coverage": 1, "interest_id": "ai", "model_release": False, "send_worthy": 2, "newest_at": NOW,
        "source_count": 2,
        **extra,
    }


def edit(importance, headline, event="", **extra):
    return {"importance": importance, "release": False, "repeat": False, "event": event,
            "headline": headline, "short": headline[:20], "take": f"Why it matters: {headline}.",
            "blurb": f"{headline} happened. It matters.", **extra}


class ApplyEditsTests(unittest.TestCase):
    def apply(self, groups, edits, sent=None):
        with patch.object(E, "edit_stories", return_value=edits) as stub:
            out = N._apply_edits(object(), groups, NOW, sent)
        return out, stub

    def test_headline_blurb_and_rating_replace_the_pipeline_copy(self):
        (g,), _ = self.apply([group("a", "Publisher Title")], {"a": edit(88, "Our headline")})
        self.assertEqual((g["title"], g["brief"], g["importance"]), ("Our headline", "Our headline happened. It matters.", 88))
        # The publisher's title stays for tomorrow's repeat check.
        self.assertEqual(g["source_title"], "Publisher Title")
        self.assertEqual(g["take"], "Why it matters: Our headline.")

    def test_repeats_go_and_one_event_keeps_its_most_important_write_up(self):
        groups = [group("a", "A"), group("b", "B", sources=["b.com"], urls=["https://e.com/b"]), group("c", "C")]
        out, stub = self.apply(groups, {
            "a": edit(70, "Votes counted", event="ballots"),
            "b": edit(90, "Voters reject data centers", event="ballots"),
            "c": edit(80, "Old heist", repeat=True),
        }, sent=[{"title": "Ballot test ahead", "sent_on": "2026-11-04"}])
        self.assertEqual([g["topic_id"] for g in out], ["b"])
        self.assertIn("https://e.com/a", out[0]["urls"])
        self.assertIn("e.com", out[0]["sources"])
        # The editor sees what went out and on which day.
        self.assertEqual(stub.call_args.args[2], ["Ballot test ahead (Wednesday)"])

    def test_one_event_keeps_the_broader_write_up_unless_the_narrow_one_is_clearly_bigger(self):
        national = group("n", "National", source_count=5, sources=["a.com", "b.com"])
        ohio = group("o", "Ohio", source_count=1, sources=["semafor.com"], urls=["https://e.com/o"])
        out, _ = self.apply([ohio, national], {
            "o": edit(92, "Ohio voters block Meta and Amazon", event="ballots"),
            "n": edit(88, "Voters reject data centers in 38 contests", event="ballots"),
        })
        self.assertEqual([g["topic_id"] for g in out], ["n"])
        self.assertIn("https://e.com/o", out[0]["urls"])
        # A much higher rating still wins.
        out, _ = self.apply([group("o", "Ohio", source_count=1), group("n", "National", source_count=5)], {
            "o": edit(95, "Ohio", event="ballots"), "n": edit(80, "National", event="ballots"),
        })
        self.assertEqual([g["topic_id"] for g in out], ["o"])

    def test_a_stale_launch_loses_its_release_flag(self):
        old = group("a", "Model", newest_at=NOW - timedelta(hours=N.RELEASE_FRESH_HOURS + 1))
        new = group("b", "Model 2")
        out, _ = self.apply([old, new], {"a": edit(90, "A", release=True), "b": edit(85, "B", release=True)})
        flags = {g["topic_id"]: g["model_release"] for g in out}
        self.assertEqual(flags, {"a": False, "b": True})

    def test_without_the_editor_nothing_changes(self):
        groups = [group("a", "A")]
        out, _ = self.apply(groups, {})
        self.assertIs(out, groups)
        self.assertNotIn("importance", out[0])


class RareTakeTests(unittest.TestCase):
    def test_only_the_most_important_few_keep_a_take(self):
        groups = [{"topic_id": f"t{i}", "title": f"T{i}", "summary": "S", "url": f"https://e.com/{i}"} for i in range(4)]

        class Store:
            def get_cached_synthesis(self, key):
                return None

            def cache_synthesis(self, key, value):
                pass

        answer = {f"s{i}": {"importance": 90 - i, "release": False, "repeat": False, "event": f"e{i}",
                            "reaction_to": "", "follows": "", "headline": f"H{i}", "short": "s",
                            "take": f"Why it matters: consequence number {i} for builders.", "one_line": "o",
                            "company": "", "outliers": [], "superseded": [], "blurb": f"B{i}."} for i in range(4)}
        with patch.object(E, "_client", return_value=object()), patch.object(E, "_ask", return_value=answer), \
                patch.object(E, "_fix_restating", return_value=None):
            edits = E.edit_stories(Store(), groups)
        with_take = sorted(tid for tid, e in edits.items() if e["take"])
        self.assertEqual(with_take, ["t0", "t1"])


class EditValidationTests(unittest.TestCase):
    def test_bad_answers_are_dropped_and_dashes_cleaned(self):
        self.assertIsNone(E._valid_edit({"importance": "x", "headline": "H", "blurb": "B"}))
        self.assertIsNone(E._valid_edit({"importance": 50, "headline": "", "blurb": "B"}))
        good = E._valid_edit({"importance": 400, "headline": "H — more", "blurb": "B", "event": "Big Event!"})
        self.assertEqual(good["importance"], 100)
        self.assertEqual(good["headline"], "H, more")
        self.assertEqual(good["event"], "big-event")

    def test_index_labels_are_cut_at_a_word(self):
        good = E._valid_edit({"importance": 80, "headline": "H", "blurb": "B",
                              "short": "Anthropic discloses bigger compute commitments in its filing today"})
        self.assertEqual(good["short"], "Anthropic discloses bigger compute commitments in its filing")
        self.assertTrue(len(good["short"]) <= 60)

    def test_prompts_format(self):
        E.STORY_PROMPT.format(style=E.STYLE, known="k", sent="s", stories="x", now="2026-11-05 08:00 UTC")
        E.ISSUE_PROMPT.format(style=E.STYLE, stories="x", extras="y")


class PolishTests(unittest.TestCase):
    class Store:
        def get_cached_synthesis(self, key):
            return None

        def cache_synthesis(self, key, value):
            self.saved = value

    def test_a_revision_with_a_new_number_is_rejected(self):
        story = {"title": "Canva cuts jobs", "brief": "1,271 employees face changes.", "take": "",
                 "one_line": "", "summary": "Canva: 1,271 employees, 22% of staff."}
        answer = {
            "s0": {"headline": "Canva cuts 1,300 jobs", "blurb": "About 1,300 people.", "take": "", "one_line": "x"},
            "s1": {"headline": "Canva reshapes teams", "blurb": "22% of staff, 1,271 people, face changes.",
                   "take": "Why it matters: sharp.", "one_line": "y"},
        }
        store = self.Store()
        with patch.object(E, "_client", return_value=object()), patch.object(E, "_ask", return_value=answer):
            out = E.polish_issue(store, [story, dict(story)])
        self.assertNotIn(0, out)  # "1,300" is in no source
        self.assertEqual(out[1]["headline"], "Canva reshapes teams")


    def test_a_rejected_take_is_dropped_not_replaced(self):
        # "Why it matters" is optional: a take that fails the checks leaves the story without one.
        story = {"title": "Voters limit data centers", "brief": "38 of 44 passed.", "one_line": "",
                 "take": "Why it matters: Developers lose sites they had counted on.", "summary": "38 of 44 passed."}
        answer = {"s0": {"headline": "Voters limit data centers", "blurb": "38 of 44 passed.",
                         "take": "Why it matters: 38 towns said no.", "one_line": "x"}}
        with patch.object(E, "_client", return_value=object()), patch.object(E, "_ask", return_value=answer):
            out = E.polish_issue(self.Store(), [story])
        self.assertEqual(out[0]["take"], "")


class RenderWithIssueTests(unittest.TestCase):
    ISSUE = {"subject": "Voters turn on data centers", "preheader": "Kimi weights; Apple scans links",
             "kicker": None}

    def sections(self):
        lead = group("a", "Lead story", brief="Lead blurb.", take="Why it matters: it matters.")
        two = group("b", "Second story", brief="Second blurb.", take="Why it matters: second.")
        lone = group("c", "Lone markets story", brief="Lone blurb.", interest_id="markets")
        kicker = group("d", "Odd story", brief="A dry line.")
        return [("top", [lead, two]), ("markets", [lone]), (N.KICKER_LANE, [kicker])]

    def test_the_email_opens_on_the_lead_story(self):
        subject, html, text = N._render("member", self.sections(), "2026-11-05", "r@x.com", "", issue=self.ISSUE)
        self.assertEqual(subject, "Voters turn on data centers")
        self.assertIn("Kimi weights; Apple scans links", html)  # hidden preheader
        self.assertNotIn("big things", html)
        self.assertNotIn("<!-- OPENING -->", html)  # no title or intro above the lead
        self.assertIn("Thursday, November 5", html)
        labels = re.findall(r'<span style="background-color: #ffef5f; padding: 0 5px;">([^<]+)</span>', html)
        # A lone leftover keeps its lane heading (no one-item "Also today"); the kicker closes.
        self.assertEqual(labels, ["Top stories", "Markets", "One more thing"])
        self.assertIn("font-size: 28px", html)  # the lead is set large
        # The take shows under the yellow rule without its "Why it matters:" label.
        self.assertIn("It matters.", html)
        self.assertNotIn("Why it matters:", html)
        self.assertIn("MARKETS", text)
        self.assertIn("Why it matters: it matters.", text)
        self.assertIn("Unsubscribe: ", text)
        self.assertIn("written with AI", text)

    def test_winback_keeps_its_news_above_the_stories(self):
        subject, html, _ = N._render("winback", self.sections(), "2026-11-05", "r@x.com", "", issue=self.ISSUE)
        self.assertTrue(subject.startswith("Everything in Trace is unlocked · Voters turn on"))
        self.assertIn(N.BUCKETS["winback"]["intro"], html)


class CreditCitedTests(unittest.TestCase):
    STORY = {
        "brief": "Voters approved 33 restrictions: 39 of 45 measures, in Engadget's tally.",
        "source_name": "Quartz", "url": "https://qz.com/a", "sources": ["qz.com", "engadget.com"],
        "coverage_outlets": ["Quartz", "Engadget"],
        "coverage_urls": ["https://qz.com/a", "https://www.engadget.com/b"],
    }

    def test_credits_the_cited_outlet(self):
        out = N._credit_cited(dict(self.STORY))
        self.assertEqual(out["source_name"], "Engadget")
        self.assertEqual(out["url"], "https://www.engadget.com/b")
        self.assertEqual(out["sources"][0], "engadget.com")
        reports = {**self.STORY, "brief": "Voters passed 33 measures, Engadget reports."}
        self.assertEqual(N._credit_cited(reports)["source_name"], "Engadget")

    def test_never_moves_credit_to_a_paywall(self):
        story = {**self.STORY, "brief": "Chinese buyers expect 1% of orders, Bloomberg reports.",
                 "coverage_outlets": ["Quartz", "Bloomberg"]}
        self.assertEqual(N._credit_cited(story)["source_name"], "Quartz")

    def test_keeps_credit_when_it_is_cited_or_nothing_is(self):
        cited = {**self.STORY, "brief": "In Quartz's count, 39 of 45 passed; Engadget agrees."}
        self.assertEqual(N._credit_cited(cited)["source_name"], "Quartz")
        plain = {**self.STORY, "brief": "Voters approved 33 restrictions."}
        self.assertEqual(N._credit_cited(plain)["source_name"], "Quartz")


class FollowUpTests(unittest.TestCase):
    def _sections(self):
        lead = {"title": "Voters limit data centers", "url": "https://a/lead"}
        icloud = {"title": "Apple checks iCloud links", "url": "https://a/icloud"}
        bonds = {"title": "CoreWeave bonds fall", "url": "https://a/bonds", "source_name": "Quartz"}
        return [("top", [lead, icloud]), ("markets", [bonds])]

    def test_moves_the_follow_up_under_the_lead_and_drops_an_empty_section(self):
        out = N._move_follow_up(self._sections(), {"index": 2, "line": "Bond markets noticed."})
        self.assertEqual([lane for lane, _ in out], ["top"])
        self.assertEqual(out[0][1][0]["follow"]["url"], "https://a/bonds")
        self.assertEqual(out[0][1][0]["follow"]["brief"], "Bond markets noticed.")
        self.assertIn("Related:", N._follow_html(out[0][1][0]))
        with patch.object(N, "_select_from_groups", return_value=[]):
            sent = N._sent_record([], [out])
        self.assertIn("https://a/bonds", [s["url"] for s in sent])

    def test_falls_back_to_the_story_marked_as_a_reaction(self):
        stories = [{"event": "us-votes", "title": "Voters"}, {"event": "icloud", "reaction_to": ""},
                   {"event": "coreweave-bonds", "reaction_to": "us-votes", "one_line": "Bonds fell."}]
        self.assertEqual(N._reaction_follow_up(stories), {"index": 2, "line": "Bonds fell."})
        self.assertIsNone(N._reaction_follow_up(stories[:2]))

    def test_ignores_a_bad_index(self):
        sections = self._sections()
        self.assertEqual(N._move_follow_up(sections, {"index": 0, "line": "x"}), sections)
        self.assertEqual(N._move_follow_up(sections, {"index": 9, "line": "x"}), sections)
        self.assertEqual(N._move_follow_up(sections, None), sections)


class CarryOverTests(unittest.TestCase):
    NOW = datetime(2026, 11, 5, 8, 30, tzinfo=timezone.utc)

    def topic(self, url, hours_ago):
        when = (self.NOW - timedelta(hours=hours_ago)).isoformat()
        return {"id": url, "url": url, "articles": [{"url": url, "published_date": when}]}

    def test_adds_yesterdays_recent_stories_not_already_in_today(self):
        today = {"trending_topics": [self.topic("https://a/siri", 2)], "trending": []}
        yesterday = {"trending_topics": [self.topic("https://a/siri", 9), self.topic("https://a/anthropic", 10),
                                         self.topic("https://a/old", 30)], "trending": []}
        out = N._with_carry_over(today, yesterday, self.NOW)
        self.assertEqual([t["url"] for t in out["trending_topics"]], ["https://a/siri", "https://a/anthropic"])
        self.assertEqual(len(today["trending_topics"]), 1)  # today's doc is left as it was

    def test_no_previous_doc_keeps_today(self):
        today = {"trending_topics": [self.topic("https://a/x", 1)]}
        self.assertIs(N._with_carry_over(today, None, self.NOW), today)


class TakeLabelTests(unittest.TestCase):
    def test_the_take_drops_its_label_but_keeps_names_like_icloud(self):
        story = {"title": "Apple checks links", "url": "https://a/x", "source_name": "The Verge", "sources": ["theverge.com"],
                 "source_count": 1, "brief": "Apple will review links.", "take": "Why it matters: iCloud users risk their accounts."}
        html = N._story_html(story, take=True)
        self.assertIn("iCloud users risk their accounts.", html)
        self.assertNotIn("Why it matters:", html)
        plain = N._story_html({**story, "take": "Why it matters: developers lose sites."}, take=True)
        self.assertIn("Developers lose sites.", plain)


class FoldTests(unittest.TestCase):
    def test_two_lone_lanes_fold_into_also_today(self):
        a, b, c = group("a", "A"), group("b", "B", interest_id="markets"), group("c", "C", interest_id="tech")
        folded = N._fold_singletons([("top", [a]), ("markets", [b]), ("tech", [c])])
        self.assertEqual([lane for lane, _ in folded], ["top", N.ALSO_LANE])


class ComposeTests(unittest.TestCase):
    def test_kicker_joins_the_selection_so_it_is_recorded(self):
        groups = [group(f"g{i}", f"Story {i}", importance=90 - i, brief=f"Blurb {i}.") for i in range(9)]
        issue = {"subject": "S", "preheader": "P", "kicker": {"index": 0, "line": "A dry line."}}
        cache = {"sponsors": []}
        with patch.object(E, "write_issue", return_value=issue) as stub, \
                patch.object(E, "polish_issue", return_value={0: {"headline": "Sharper 0", "blurb": "B.", "take": "", "one_line": "O."}}):
            subject, html, _ = N._compose(None, groups, "2026-11-05", "member",
                                          {"email": "r@x.com", "count": 7}, cache, v3_store=object())
        extras = stub.call_args.args[2]
        self.assertEqual([g["topic_id"] for g in extras], ["g7", "g8"])
        selection = cache[("member", (), 7)]
        self.assertEqual(selection[-1][0], N.KICKER_LANE)
        self.assertEqual(selection[-1][1][0]["brief"], "A dry line.")
        self.assertIn(selection, N._selections(cache))
        self.assertIn("A dry line.", html)
        self.assertEqual(subject, "S")
        # The issue copy is written from the line edit's copy, and the lead story
        # then carries the subject as its headline (the two say the same thing).
        self.assertEqual(stub.call_args.args[1][0]["title"], "Sharper 0")
        self.assertEqual(selection[0][1][0]["title"], "S")
        self.assertEqual(selection[1][1][0]["title"], "Story 3")




class FeedReuseTests(unittest.TestCase):
    """The feed rebuilds every 20 minutes: a story keeps its last write-up for a while."""

    def _store(self, last):
        class Store:
            def get_cached_synthesis(self, key):
                return last if key.startswith("nl_story_last:") else None
        return Store()

    def _edit(self):
        return {"importance": 80, "headline": "Voters said yes to limits on data centers", "blurb": "Restrictions won.",
                "event": "data-center-ballots"}

    def test_recent_edit_reused_until_a_new_outlet_covers_it(self):
        from datetime import datetime, timedelta, timezone
        from v3.lib import newsletter_editor as E
        at = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
        raw = {"edit": self._edit(), "at": at, "outlets": 3}
        if not E._valid_edit(raw["edit"]):
            self.skipTest("edit fixture doesn't meet _valid_edit's required fields")
        group = {"topic_id": "t1", "source_count": 3}
        self.assertIsNotNone(E._recent_edit(self._store(raw), group, 3))
        self.assertIsNone(E._recent_edit(self._store(raw), {**group, "source_count": 4}, 3))
        old = {**raw, "at": (datetime.now(timezone.utc) - timedelta(hours=4)).isoformat()}
        self.assertIsNone(E._recent_edit(self._store(old), group, 3))

    def test_feed_limit_zero_edits_nothing(self):
        from unittest import mock
        from v3.lib import feed_editor
        with mock.patch("v3.lib.newsletter_editor.edit_stories") as edit:
            feed_editor.annotate_feed(object(), {"trending_topics": [{"id": "a", "title": "x", "articles": []}]}, limit=0)
        edit.assert_not_called()


if __name__ == "__main__":
    unittest.main()
