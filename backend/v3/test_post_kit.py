import argparse
import fcntl
import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch

from v3.flows import build_post_kit as kit

# 07:30 in London on Oct 14 (BST): 12:00 in India, the same feed date.
NOW = datetime(2026, 10, 14, 6, 30, tzinfo=timezone.utc)
DATE = "2026-10-14"


def article(url, source, title="A headline"):
    return {"url": url, "source_name": source, "title": title}


def topic(tid, title, sources, interest="ai", summary="Summary sentence one. Sentence two.", points=None, **extra):
    return {
        "id": tid, "title": title, "interest_id": interest, "summary": summary, "source_count": len(sources),
        "key_points": points if points is not None else ["Point one", "Point two"],
        "articles": [article(f"https://{s.lower().replace(' ', '')}.com/{tid}", s) for s in sources],
        **extra,
    }


def pulse_item(item_id, title, url, source, summary="One line about it.", by=""):
    return {"id": item_id, "title": title, "url": url, "source": source, "signal": "100 points", "by": by,
            "thumbnail": "https://img.example/a.png", "summary": {"body": summary, "short_article": {"body": summary}}}


GEMINI = topic("gemini", "Google releases Gemini 3.5 Pro with a 2M-token context window",
               ["Google Blog", "The Verge", "TechCrunch", "Ars Technica", "VentureBeat", "Wired"],
               summary="Google released **Gemini 3.5 Pro** with a 2M-token context window. It costs less.",
               points=["2M-token context", "Input pricing drops to $1.25 per million tokens"])
CODEX = topic("codex", "OpenAI launches Codex for Teams", ["OpenAI", "The Verge", "TechCrunch", "Engadget"])
MARKET = topic("nvda", "Nvidia shares slide as cloud giants trim spending", ["Reuters", "Bloomberg", "CNBC"],
               interest="markets", summary="Nvidia fell on Tuesday after two big customers slowed spending. More here.")
DOC = {
    "trending_topics": [MARKET, GEMINI, CODEX],
    "daily_pulse_roles": {"developer": {
        "tools": [pulse_item("t1", "astral-sh / uv", "https://github.com/astral-sh/uv", "GitHub Trending"),
                  pulse_item("t2", "Zed", "https://zed.dev", "Show HN", by="nathan")],
        "discussions": [pulse_item("d1", "Things we learned", "https://simonwillison.net/post", "Hacker News", by="simonw"),
                        pulse_item("d2", "A design read", "https://sidebar.io/x", "Sidebar", by="ignored")],
    }},
}


class FakeFinder:
    """Stands in for HandleFinder: no network."""

    fetched = cached = 0

    def __init__(self, *_args, **_kwargs):
        self.urls = []

    def lookup(self, url):
        self.urls.append(url)
        return [{"handle": "@simonw", "via": "page author tag"}] if "simonwillison" in url else []


class FakeDoc:
    def __init__(self, table, doc_id, fail=False):
        self.table, self.id, self.fail = table, doc_id, fail

    def get(self):
        snap = MagicMock()
        snap.exists = self.id in self.table
        snap.to_dict.return_value = dict(self.table.get(self.id, {}))
        return snap

    def set(self, data, merge=False):
        if self.fail:
            raise RuntimeError("database is locked")
        self.table[self.id] = {**(self.table.get(self.id, {}) if merge else {}), **data}


class FakeCollection:
    def __init__(self, store, path):
        self.store, self.path = store, path

    def document(self, doc_id):
        return FakeDocRef(self.store, f"{self.path}/{doc_id}")


class FakeDocRef(FakeDoc):
    def __init__(self, store, path):
        super().__init__(store.docs, path, fail=store.fail_writes)
        self.store = store

    def collection(self, name):
        return FakeCollection(self.store, f"{self.id}/{name}")


class FakeStore:
    def __init__(self, feed=None, markers=None, fail_writes=False):
        self.docs = {f"v3_user_feeds/_global/daily/{DATE}": json.loads(json.dumps(feed if feed is not None else DOC))}
        for date, marker in (markers or {}).items():
            self.docs[f"{kit.MARKERS}/{date}"] = marker
        self.fail_writes = fail_writes
        self.db = MagicMock()
        self.db.collection.side_effect = lambda name: FakeCollection(self, name)

    def load_global_feed(self, date):
        return dict(self.docs.get(f"v3_user_feeds/_global/daily/{date}", {}))

    def marker(self, date=DATE):
        return self.docs.get(f"{kit.MARKERS}/{date}")


def no_model():
    return patch("v3.lib.summarizer._get_client", return_value=None)


def fake_model(*answers):
    client = MagicMock()
    responses = []
    for answer in answers:
        response = MagicMock()
        response.choices[0].message.content = json.dumps(answer)
        responses.append(response)
    client.chat.completions.create.side_effect = responses
    client.with_options.return_value = client
    return patch("v3.lib.summarizer._get_client", return_value=client), client


class FeaturedTests(unittest.TestCase):
    def test_items_have_share_pages_and_only_hn_submitters(self):
        items = kit.featured_items(DOC, DATE)
        self.assertEqual([i["id"] for i in items], ["t1", "t2", "d1", "d2"])
        self.assertEqual(items[0]["share_url"], f"https://www.yourtrace.online/featured/{DATE}/t1")
        self.assertEqual([i["label"] for i in items], ["Tools", "Tools", "Top articles", "Top articles"])
        self.assertEqual([i["by"] for i in items], ["", "nathan", "simonw", ""])
        self.assertEqual(items[2]["summary"], "One line about it.")

    def test_junk_items_are_skipped(self):
        doc = {"daily_pulse_roles": {"developer": {"tools": [
            None, {"id": "", "title": "x", "url": "https://a.dev"}, {"id": "a", "title": "", "url": "https://a.dev"},
            {"id": "b", "title": "B", "url": "javascript:alert(1)"}, pulse_item("c", "C", "https://c.dev", "Show HN"),
            pulse_item("d", "D", "https://[odd.dev/x", "Show HN"), pulse_item("e", "E", "https://", "Show HN"),
            pulse_item("c", "C again", "https://c2.dev", "Show HN"),
        ]}}}
        self.assertEqual([i["id"] for i in kit.featured_items(doc, DATE)], ["c"])
        self.assertEqual(kit.featured_items({}, DATE), [])

    def test_suggested_lines_are_plain_and_dated(self):
        repo, tool, post = kit.featured_items(DOC, DATE)[:3]
        self.assertEqual(kit.suggested_line(repo, DATE, DATE),
                         f'Your repo "astral-sh / uv" is in today\'s Tools picks on Trace: {repo["share_url"]}')
        self.assertIn('Your project "Zed"', kit.suggested_line(tool, DATE, DATE))
        self.assertEqual(kit.suggested_line(post, DATE, "2026-10-15"),
                         f'Your post "Things we learned" was in Trace\'s Top articles on Oct 14: {post["share_url"]}')

    def test_makers_with_a_handle_come_first_within_each_section(self):
        finder = FakeFinder()
        makers = kit.find_makers(kit.featured_items(DOC, DATE), finder, DATE, DATE)
        self.assertEqual([m["id"] for m in makers], ["t1", "t2", "d1", "d2"])
        self.assertEqual(makers[2]["handles"][0]["handle"], "@simonw")
        self.assertEqual(len(finder.urls), 4)

    def test_lookups_stop_when_the_time_budget_is_spent(self):
        finder = FakeFinder()
        makers = kit.find_makers(kit.featured_items(DOC, DATE), finder, DATE, DATE, budget=-1)
        self.assertEqual((finder.urls, len(makers)), ([], 4))
        self.assertFalse(any(m["checked"] for m in makers))
        self.assertIn("X handle not checked today", kit._handles_text(makers[0]))

    def test_a_failing_lookup_does_not_stop_the_kit(self):
        finder = MagicMock()
        finder.lookup.side_effect = ValueError("Invalid IPv6 URL")
        makers = kit.find_makers(kit.featured_items(DOC, DATE), finder, DATE, DATE)
        self.assertEqual(len(makers), 4)
        self.assertFalse(makers[0]["checked"])


class StoryTests(unittest.TestCase):
    def test_releases_need_wide_coverage(self):
        self.assertEqual([s["topic_id"] for s in kit.pick_releases([MARKET, GEMINI, CODEX])], ["gemini", "codex"])
        thin = topic("thin", "Mistral releases Magistral 2", ["Mistral", "HN"])
        self.assertEqual(kit.pick_releases([thin]), [])

    def test_launches_ahead_of_events_still_count(self):
        llama = topic("llama", "Meta launches Llama 5 ahead of LlamaCon", ["A", "B", "C", "D"], summary="Meta's new model.")
        self.assertEqual([s["topic_id"] for s in kit.pick_releases([llama])], ["llama"])

    def test_second_draft_only_when_nearly_as_big(self):
        small = topic("small", "Anthropic launches Claude for Chrome", ["A", "B", "C"])
        self.assertEqual([s["topic_id"] for s in kit.pick_releases([GEMINI, small])], ["gemini"])

    def test_same_event_twice_is_one_draft(self):
        twin = topic("twin", "Google releases Gemini 3.5 Pro with a 2M token context window", ["X1", "X2", "X3", "X4", "X5"])
        self.assertEqual([s["topic_id"] for s in kit.pick_releases([GEMINI, twin])], ["gemini"])

    def test_not_releases(self):
        cases = [
            topic("delay", "OpenAI delays its open-weights model launch", ["A", "B", "C", "D"]),
            topic("ipo", "CoreWeave debuts on Nasdaq", ["A", "B", "C", "D"]),
            topic("fund", "Anthropic launches $100M fund for AI startups", ["A", "B", "C", "D"]),
            topic("price", "Microsoft rolls out Copilot price hike", ["A", "B", "C", "D"]),
            topic("bid", "Perplexity launches bid for Chrome", ["A", "B", "C", "D"]),
            topic("report", "OpenAI releases report on election misuse", ["A", "B", "C", "D"]),
            topic("plan", "Nvidia unveils plan to invest $5B in AI", ["A", "B", "C", "D"]),
            topic("vague", "Startup launches today", ["A", "B", "C", "D"]),
            topic("suit", "Authors sue Meta over Llama training data", ["A", "B", "C", "D"]),
            topic("promo", "Best deals on AI laptops this week", ["A", "B", "C", "D"]),
            topic("junk", "Google releases Gemini 4", ["A", "B", "C", "D"], jev_send_worthy=0),
            topic("biz", "Apple launches a new iPad", ["A", "B", "C", "D"], interest="tech"),
        ]
        self.assertEqual(kit.pick_releases(cases), [])

    def test_top_story_is_the_first_usable_topic(self):
        junk = topic("junk", "Puzzle answers for today", ["A"], jev_send_worthy=0)
        self.assertEqual(kit.top_story([junk, MARKET, GEMINI])["topic_id"], "nvda")
        self.assertIsNone(kit.top_story([junk, {"title": "no articles"}]))

    def test_story_counts_distinct_outlets(self):
        story = kit._story(GEMINI, 1)
        self.assertEqual((story["source_count"], story["lead_source"], len(story["sources"])), (6, "Google Blog", 6))
        self.assertNotIn("**", story["summary"])


class WritingTests(unittest.TestCase):
    def setUp(self):
        self.story = kit._story(GEMINI, 1)

    def test_template_when_there_is_no_model(self):
        with no_model():
            draft = kit.write_article(self.story)
        self.assertEqual(draft["written_by"], "template")
        self.assertEqual(draft["cover_kicker"], "Gemini 3.5 Pro")
        self.assertEqual(draft["title"], "Google releases Gemini 3.5 Pro with a 2M-token context window: what it means for builders")
        self.assertEqual([d["text"] for d in draft["details"]], self.story["key_points"])
        text = kit.article_text(draft, self.story)
        self.assertIn(kit.CTA_URL, text)
        self.assertIn("- Google Blog: https://googleblog.com/gemini", text)
        self.assertIn("[Your take:", text)

    def test_template_when_the_model_fails(self):
        client = MagicMock()
        client.with_options.return_value = client
        client.chat.completions.create.side_effect = RuntimeError("401 Incorrect API key sk-proj-abc***xyz")
        with patch("v3.lib.summarizer._get_client", return_value=client), patch.object(kit, "_log") as log:
            self.assertEqual(kit.write_article(self.story)["written_by"], "template")
            self.assertEqual(kit.write_post(self.story, DATE)["written_by"], "template")
        self.assertNotIn("sk-proj", " ".join(str(c) for c in log.call_args_list))
        self.assertEqual(client.with_options.call_args.kwargs, {"max_retries": 1})

    def test_model_draft_is_used_when_it_follows_the_rules(self):
        answer = {
            "title": "Google's new model reads whole codebases at once",
            "cover_kicker": "Gemini 3.5 Pro", "cover_headline": "What changes for builders",
            "intro": "Google released Gemini 3.5 Pro today.",
            "details": [{"text": "It reads 2M tokens.", "source": "The Verge"},
                        {"text": "Input costs $1.25 per million tokens.", "source": "Made Up Weekly"},
                        {"text": "It is 40% faster.", "source": "TechCrunch"}],
            "why_it_matters": ["Long context means fewer retrieval hacks."],
        }
        model, client = fake_model(answer)
        with model:
            draft = kit.write_article(self.story)
        self.assertEqual(draft["written_by"], "model")
        self.assertEqual(draft["title"], answer["title"])
        # A source we never gave is dropped, and so is a figure the sources never mention.
        self.assertEqual(draft["details"], [{"text": "It reads 2M tokens.", "source": "The Verge"},
                                            {"text": "Input costs $1.25 per million tokens.", "source": ""}])
        request = client.chat.completions.create.call_args.kwargs
        self.assertEqual((request["model"], request["timeout"]), (kit.KIT_MODEL, 60))
        self.assertTrue(request["response_format"]["json_schema"]["strict"])

    def test_made_up_numbers_in_the_title_fall_back_to_the_story_title(self):
        answer = {"title": "Gemini 3.5 Pro is 10x cheaper than GPT-5", "cover_kicker": "Gemini 3.5 Pro",
                  "cover_headline": "10x cheaper", "intro": "Google released it.",
                  "details": [{"text": "A.", "source": ""}, {"text": "B.", "source": ""}], "why_it_matters": ["C."]}
        model, _ = fake_model(answer)
        with model:
            draft = kit.write_article(self.story)
        self.assertEqual(draft["written_by"], "model")
        self.assertTrue(draft["title"].startswith("Google releases Gemini 3.5 Pro"))
        self.assertEqual(draft["cover_headline"], "What it means for builders")

    def test_incomplete_model_draft_uses_the_template(self):
        model, _ = fake_model({"title": "T t t", "cover_kicker": "", "cover_headline": "", "intro": "",
                               "details": [], "why_it_matters": []})
        with model:
            self.assertEqual(kit.write_article(self.story)["written_by"], "template")

    def test_post_fits_and_links_the_brief(self):
        model, _ = fake_model({"post": "Google's Gemini 3.5 Pro reads 2M tokens at once and costs less to run."})
        with model:
            post = kit.write_post(self.story, DATE)
        self.assertEqual(post["written_by"], "model")
        self.assertTrue(post["text"].endswith(f"https://www.yourtrace.online/brief/{DATE}?utm_source=x&utm_medium=post"))
        self.assertLessEqual(post["length"], 280)

    def test_post_never_goes_over_280(self):
        long_post = ("Google's Gemini 3.5 Pro reads 2M tokens at once. " * 6)[:240]
        model, _ = fake_model({"post": long_post})
        with model:
            post = kit.write_post(self.story, DATE)
        self.assertEqual(post["written_by"], "template")
        self.assertLessEqual(post["length"], 280)
        story = {**self.story, "title": "A very long headline " * 12, "summary": "Sentence. " * 40}
        with no_model():
            self.assertLessEqual(kit.write_post(story, DATE)["length"], 280)
        cjk = {**self.story, "title": "谷歌发布双子座模型" * 20}
        with no_model():
            self.assertLessEqual(kit.write_post(cjk, DATE)["length"], 280)

    def test_number_words_count_as_numbers(self):
        self.assertEqual(kit.invented_numbers("It is ten times faster", "It is faster"), {"ten"})
        self.assertEqual(kit.invented_numbers("Two million tokens", "two million tokens"), set())
        self.assertEqual(kit.invented_numbers("The one thing that matters", "a model"), set())

    def test_post_rules_fall_back_to_the_template(self):
        for bad in ("#AI " + "x" * 30, "y" * 300, "Read it: https://spam.example now please ok", "It is 99% better than before.",
                    "It runs twice as fast as before, says Google."):
            model, _ = fake_model({"post": bad})
            with model:
                post = kit.write_post(self.story, DATE)
            self.assertEqual(post["written_by"], "template", bad)
            self.assertTrue(post["text"].startswith("Google releases Gemini 3.5 Pro"))
            self.assertLessEqual(post["length"], 280)

    def test_x_length_counts_links_as_23(self):
        self.assertEqual(kit.x_length("hi https://www.yourtrace.online/brief/2026-10-14?utm_source=x"), 3 + 23)
        self.assertEqual(kit.x_length("日本"), 4)

    def test_release_name(self):
        self.assertEqual(kit.release_name("OpenAI releases GPT-5.5 with 1M context"), "GPT-5.5")
        self.assertEqual(kit.release_name("Anthropic launches Claude Opus 5"), "Claude Opus 5")
        self.assertEqual(kit.release_name("Google unveils Gemini 3 Flash for phones"), "Gemini 3 Flash")
        self.assertEqual(kit.release_name("OpenAI launches Codex for Teams"), "")


class EmailTests(unittest.TestCase):
    def build(self, doc=DOC):
        with no_model(), patch.object(kit, "HandleFinder", FakeFinder):
            return kit.build_kit(DATE, doc, FakeFinder(), NOW)

    def test_by_default_there_is_no_makers_list_and_no_lookups(self):
        finder = FakeFinder()
        with no_model():
            built = kit.build_kit(DATE, DOC, finder, NOW)
        self.assertEqual(built["makers"], [])
        self.assertEqual(len(built["featured"]), 4)  # still kept for the share pages
        self.assertEqual(finder.urls, [])
        subject, page, text = kit.render_email(built)
        self.assertEqual(subject, "Post kit for Oct 14: 2 release drafts")
        self.assertNotIn("tell the makers", page)
        self.assertNotIn("TELL THE MAKERS", text)

    @patch.object(kit, "TELL_MAKERS", True)
    def test_the_kit_has_every_section(self):
        built = self.build()
        self.assertEqual([d["cover_name"] for d in built["drafts"]], ["cover-1.jpg", "cover-2.jpg"])
        self.assertTrue(built["drafts"][0]["cover_bytes"].startswith(b"\xff\xd8"))
        self.assertEqual(built["post"]["story"]["topic_id"], "nvda")
        subject, page, text = kit.render_email(built)
        self.assertEqual(subject, "Post kit for Oct 14: 2 release drafts, 4 featured to tell")
        for needle in ("Release-day article", "X post for today", "Featured today", "cover-1.jpg",
                       f"/featured/{DATE}/d1", "https://x.com/intent/tweet?text=%40simonw", "news.ycombinator.com/user?id=simonw"):
            self.assertIn(needle, page)
        self.assertNotIn("<img", page)
        self.assertIn("<img", kit.render_email(built, preview=True)[1])
        self.assertIn("Line: Your repo", text)

    @patch.object(kit, "TELL_MAKERS", True)
    def test_titles_are_escaped(self):
        doc = {"daily_pulse_roles": {"developer": {"tools": [
            pulse_item("x", '<script>alert("x")</script>', "https://evil.example/?a=1&b=2", "Show HN")]}}}
        _, page, _ = kit.render_email(self.build(doc))
        self.assertNotIn("<script>", page)
        self.assertIn("&lt;script&gt;", page)
        self.assertIn("https://evil.example/?a=1&amp;b=2", page)

    def test_quiet_day(self):
        built = self.build({"trending_topics": [MARKET]})
        subject, page, _ = kit.render_email(built)
        self.assertEqual(subject, "Post kit for Oct 14: no big release")
        self.assertIn("No AI release with wide coverage today", page)


def args(**overrides):
    values = {"dry_run": False, "test_to": None, "feed_json": None, "date": None, "out": "", "lock": None}
    values.update(overrides)
    return argparse.Namespace(**values)


class RunTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.lock = str(Path(self.tmp.name) / "kit.lock")
        patches = [no_model(), patch.object(kit, "HandleFinder", FakeFinder),
                   patch.dict("os.environ", {"TRACE_KIT_TO": "founder@yourtrace.online"})]
        for p in patches:
            p.start()
            self.addCleanup(p.stop)
        self.addCleanup(self.tmp.cleanup)

    def run_kit(self, store, result=None, **overrides):
        with patch.object(kit, "send_kit", return_value=result or {"success": True, "transport": "smtp"}) as send:
            code = kit.run(args(lock=self.lock, **overrides), now=NOW, store=store)
        return code, send

    def test_no_recipient_does_nothing(self):
        with patch.dict("os.environ", {"TRACE_KIT_TO": ""}), patch.object(kit, "build_kit") as build:
            self.assertEqual(kit.run(args(lock=self.lock), now=NOW, store=FakeStore()), 0)
        build.assert_not_called()

    def test_sends_once_per_day(self):
        store = FakeStore()
        code, send = self.run_kit(store)
        self.assertEqual(code, 0)
        send.assert_called_once()
        self.assertEqual(send.call_args.args[1], "founder@yourtrace.online")
        marker = store.marker()
        self.assertEqual((marker["status"], marker["attempts"], marker["featured"]), ("sent", 1, 4))
        featured = store.load_global_feed(DATE)["featured_items"]
        self.assertEqual([f["id"] for f in featured], ["t1", "t2", "d1", "d2"])
        self.assertEqual(featured[0]["summary"], {"body": "One line about it."})
        code, send = self.run_kit(store)
        self.assertEqual(code, 0)
        send.assert_not_called()

    def test_featured_copy_keeps_earlier_items(self):
        feed = json.loads(json.dumps(DOC))
        feed["featured_items"] = [{"id": "old", "title": "Earlier pick", "featured_at": "2026-10-14T01:00:00+00:00"},
                                  {"id": "t1", "title": "stale copy", "featured_at": "2026-10-14T01:00:00+00:00"}]
        store = FakeStore(feed=feed)
        self.run_kit(store)
        featured = {f["id"]: f for f in store.load_global_feed(DATE)["featured_items"]}
        self.assertEqual(list(featured), ["old", "t1", "t2", "d1", "d2"])
        self.assertEqual((featured["t1"]["title"], featured["t1"]["featured_at"]), ("astral-sh / uv", "2026-10-14T01:00:00+00:00"))

    def test_a_kit_that_may_have_gone_out_is_never_resent(self):
        for status in ("sending", "sent"):
            store = FakeStore(markers={DATE: {"status": status, "attempts": 1}})
            _, send = self.run_kit(store)
            send.assert_not_called()

    def test_failed_sends_are_retried_up_to_the_limit(self):
        store = FakeStore()
        code, _ = self.run_kit(store, result={"success": False, "error": "smtp down", "transport": "smtp"})
        self.assertEqual((code, store.marker()["status"], store.marker()["error"]), (1, "failed", "smtp down"))
        code, send = self.run_kit(store)
        send.assert_called_once()
        self.assertEqual((store.marker()["status"], store.marker()["attempts"]), ("sent", 2))
        store = FakeStore(markers={DATE: {"status": "failed", "attempts": kit.MAX_ATTEMPTS}})
        _, send = self.run_kit(store)
        send.assert_not_called()

    def test_send_errors_are_recorded(self):
        store = FakeStore()
        with patch.object(kit, "send_kit", side_effect=RuntimeError("boom")):
            self.assertEqual(kit.run(args(lock=self.lock), now=NOW, store=store), 1)
        self.assertEqual(store.marker()["status"], "failed")

    def test_nothing_is_sent_when_the_marker_cannot_be_written(self):
        code, send = self.run_kit(FakeStore(fail_writes=True))
        self.assertEqual(code, 1)
        send.assert_not_called()

    def test_no_feed_yet(self):
        code, send = self.run_kit(FakeStore(feed={}))
        self.assertEqual(code, 1)
        send.assert_not_called()

    def test_one_run_at_a_time(self):
        with open(self.lock, "a") as held:
            fcntl.flock(held, fcntl.LOCK_EX | fcntl.LOCK_NB)
            code, send = self.run_kit(FakeStore())
        self.assertEqual(code, 0)
        send.assert_not_called()

    def test_test_to_sends_one_copy_and_writes_nothing(self):
        store = FakeStore()
        before = json.dumps(store.docs, sort_keys=True)
        code, send = self.run_kit(store, test_to="me@yourtrace.online")
        self.assertEqual(code, 0)
        self.assertEqual(send.call_args.args[1:], ("me@yourtrace.online",))
        self.assertEqual(send.call_args.kwargs, {"bucket": "test"})
        self.assertEqual(json.dumps(store.docs, sort_keys=True), before)

    def test_dry_run_from_a_saved_feed_touches_no_database(self):
        feed = Path(self.tmp.name) / "day.json"
        feed.write_text(json.dumps(DOC))
        out = Path(self.tmp.name) / "out"
        with patch.object(kit, "_store", side_effect=AssertionError("no database in this dry run")):
            code, send = self.run_kit(None, dry_run=True, feed_json=str(feed), date=DATE, out=str(out))
        self.assertEqual(code, 0)
        send.assert_not_called()
        self.assertEqual(sorted(p.name for p in out.iterdir()), ["cover-1.jpg", "cover-2.jpg", "post-kit.html", "post-kit.txt"])

    def test_dry_run_with_the_database_only_reads(self):
        store = FakeStore()
        before = json.dumps(store.docs, sort_keys=True)
        code, send = self.run_kit(store, dry_run=True, out=str(Path(self.tmp.name) / "out"))
        self.assertEqual(code, 0)
        send.assert_not_called()
        self.assertEqual(json.dumps(store.docs, sort_keys=True), before)


class CoverTests(unittest.TestCase):
    def test_cover_is_1600x900_and_long_or_odd_text_still_fits(self):
        from v3.lib import article_cover

        image = article_cover.render_cover("A very long release name that will not fit", "Builders " * 40 + "日本語 🚀", "Oct 14")
        self.assertEqual(image.size, (1600, 900))
        font, lines = article_cover._fit("word " * 80, 1380, range(112, 63, -4), max_lines=3)
        self.assertEqual(len(lines), 3)
        self.assertTrue(lines[-1].endswith("…"))
        self.assertTrue(all(font.getlength(line) <= 1380 for line in lines))

    def test_missing_satoshi_falls_back_to_inter(self):
        from v3.lib import article_cover

        article_cover.satoshi_path.cache_clear()
        with patch.dict("os.environ", {"TRACE_KIT_FONT": "/nonexistent/Satoshi-Black.otf"}), \
                patch.object(article_cover, "SATOSHI_FILES", ()):
            self.assertIsNone(article_cover.satoshi_path())
            self.assertEqual(article_cover.headline_font_name(), "Inter Bold (Satoshi not installed)")
        article_cover.satoshi_path.cache_clear()


class DayTests(unittest.TestCase):
    def test_falls_back_to_yesterday_until_today_has_a_feed(self):
        docs = {"2026-10-13": {"trending_topics": [MARKET]}}
        self.assertEqual(kit.load_day(lambda d: docs.get(d, {}), NOW)[0], "2026-10-13")
        docs[DATE] = {"daily_pulse_roles": {"developer": {"tools": [{}]}}}
        self.assertEqual(kit.load_day(lambda d: docs.get(d, {}), NOW)[0], DATE)
        self.assertEqual(kit.load_day(lambda d: {}, NOW), (DATE, {}))
        self.assertEqual(kit.load_day(lambda d: docs.get(d, {}), NOW, "2026-10-13")[0], "2026-10-13")

    def test_a_new_ist_day_without_lists_waits_for_the_pulse(self):
        # 20:00 in London is already tomorrow in India; that doc has stories but no lists yet.
        evening = datetime(2026, 10, 14, 19, 0, tzinfo=timezone.utc)
        docs = {"2026-10-15": {"trending_topics": [MARKET]}, DATE: DOC}
        self.assertEqual(kit.load_day(lambda d: docs.get(d, {}), evening)[0], DATE)
        self.assertEqual(kit.feed_today(evening), "2026-10-15")


if __name__ == "__main__":
    unittest.main()
