"""The daily leaves out what a daily carried in the last few days.

  python3 -m unittest v3.test_newsletter_repeats

The pairs are real headlines and summaries from the October 2026 editions.
"""

from __future__ import annotations

import os
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.localdb.firestore import LocalFirestoreClient  # noqa: E402

import v3.flows.send_audience_newsletter as N  # noqa: E402
import v3.lib.repeats as R  # noqa: E402


def setUpModule():
    # Never the real model from a test, whatever the .env holds.
    patcher = patch.object(R, "_client", lambda: None)
    patcher.start()
    unittest.addModuleCleanup(patcher.stop)


def story(title: str, summary: str, url: str) -> dict:
    return {"title": title, "summary": summary, "url": url}


SPARK = story(
    "Meta Unveils Muse Spark Open AI Model",
    "Meta has launched Muse Spark Open, an 816 billion parameter open-weight model designed for coding and agent "
    "tasks. This model is optimized to run locally on Macs, requiring at least 1 terabyte of RAM, and has been tested "
    "on real projects including iOS changes and video editing workflows.",
    "https://research.meta.ai/blog/muse-spark-open",
)
SPARK_AGAIN = story(
    "Meta and Apple Unveil Muse Spark Open AI Model",
    "Meta and Apple have announced the launch of the Muse Spark Open AI model, which is optimized for use on Apple's "
    "hardware. This open-weight model features 42 billion active parameters and is designed for various applications, "
    "including coding tasks. The collaboration highlights a strategic shift as b",
    "https://www.cnet.com/tech/computing/meta-spark-open-ai-apple-news",
)
WONDER = story(
    "Meta Unveils Muse Wonder AI Models",
    "On October 12, 2026, Meta launched its new AI models, Muse Wonder and Muse Wonder Full, designed for complex "
    "professional tasks in sectors like law and finance. These models feature advanced capabilities such as Active "
    "Memory and are available through a subscription model, with prices set at $20 for",
    "https://research.meta.ai/blog/muse-wonder",
)
ARREST = story(
    "FBI Arrests OpenAI Employee for Espionage",
    "Abdulrahman Alfozan, an employee at OpenAI, was arrested by the FBI for allegedly planting a covert recording "
    "device in a conference room used for confidential discussions. The device, concealed in toilet paper, was "
    "discovered shortly after Alfozan booked a one-way ticket to Saudi Arabia, raising co",
    "https://www.semafor.com/article/10/14/2026/openai-employee-arrested-over-office-bugging",
)
ARREST_AGAIN = story(
    "Saudi Engineer Arrested for Espionage at OpenAI",
    "Abdulrahman Alfozan, a 35-year-old engineer at OpenAI, was arrested for allegedly planting a secret recording "
    "device in a restricted meeting room. The device, disguised in toilet paper, was discovered during a routine "
    "check on September 30, 2023, prompting an FBI investigation into his activities.",
    "https://www.bbc.co.uk/news/articles/cm04054ykqqqo",
)
STATES = story(
    "Eight States Sue OpenAI Over ChatGPT Safety Concerns",
    "Eight states, including Iowa, Kansas, and Arizona, have filed lawsuits against OpenAI, claiming that ChatGPT "
    "poses safety risks for children. The lawsuits allege that OpenAI misled users regarding the platform's safety "
    "and failed to adequately protect minors from harmful content. In response, OpenAI",
    "https://www.theverge.com/ai-artificial-intelligence/1011500/openai-state-lawsuits-chatgpt-safety",
)
FTC = story(
    "FTC Subpoenas OpenAI and Anthropic Over AI Safety Concerns",
    "The FTC has issued subpoenas to OpenAI and Anthropic as part of an investigation into safety incidents involving "
    "their AI models. The agency is seeking documents related to security incidents and safety measures, emphasizing "
    "that AI systems must be safe before release. This comes amid ongoing lawsui",
    "https://thenextweb.com/news/ftc-subpoenas-openai-anthropic-ai-safety-incidents",
)
VESSLA = story(
    "Vessla Secures €2.94 Million Funding for AI in Property Management",
    "Stockholm-based Vessla has exited stealth mode, raising €2.94 million in pre-Seed funding to develop AI agents "
    "aimed at enhancing property management efficiency. The funding round, led by Seedcamp, was more than twice "
    "oversubscribed, reflecting significant investor interest in the company's innovati",
    "https://tech.eu/2026/10/19/vessla-exits-stealth-with-33m-to-bring-ai-agents-to-property-management",
)
LINKENER = story(
    "Linkener Secures €7.5 Million to Enhance Energy Management Platform",
    "Linkener, a Barcelona-based EnergyTech startup, has successfully raised €7.5 million to advance its energy "
    "management platform for businesses. The funding will be directed towards developing AI models and implementing "
    "a strategy for acquisitions, aimed at optimizing energy consumption and sustainabi",
    "https://tech.eu/2026/10/19/linkener-secures-eur75m-to-expand-its-energy-management-platform",
)
HOMEVIEW = story(
    "Apple Launches HomeView Smart Display",
    "Apple has introduced the HomeView, its first smart display designed for Siri AI, priced at $299. Set to launch "
    "on November 13, the device features facial recognition for personalized user experiences and integrates with "
    "Apple Home as a smart hub.",
    "https://www.engadget.com/2285072/apple-launch-homeview-smart-display-siri-ai",
)
HOMEVIEW_APPS = story(
    "HomeView will include these Apple apps at launch",
    "Apple's HomeView, a new category of product, is now available for pre-order and will ship on November 13, 2026. "
    "The device features a unique software experience focused on voice interactions with Siri and a customizable Home "
    "Screen that includes a grid of apps. At launch, HomeView will come with 15 ",
    "https://9to5mac.com/2026/10/16/homeview-will-include-these-apple-apps-at-launch",
)


def topic(item: dict, interest: str = "ai", tid: str = "") -> dict:
    return {
        "id": tid or item["url"],
        "title": item["title"],
        "summary": item["summary"],
        "interest_id": interest,
        "source_count": 2,
        "articles": [{"title": item["title"], "url": item["url"], "source": "Source"}],
    }


def judge_saying_yes_to(*titles: str):
    """A stand-in for the model: `new` repeats `sent` when its headline is one of these."""
    asked: list = []

    def judge(v3_store, pairs):
        asked.extend(pairs)
        return {i: new["title"] in titles for i, (new, sent) in enumerate(pairs)}
    judge.asked = asked
    return judge


class RepeatTests(unittest.TestCase):
    def index(self, *sent: dict) -> dict:
        return N._repeat_index(list(sent))

    def test_sure_repeats(self):
        self.assertIs(N._sure_repeat(SPARK, self.index(SPARK)), SPARK)
        # The same link under a new headline (Amazon's Bee went out three days running).
        self.assertIs(N._sure_repeat({**HOMEVIEW_APPS, "url": HOMEVIEW["url"]}, self.index(HOMEVIEW)), HOMEVIEW)
        # Any article the sent story was built from.
        sent = {**HOMEVIEW, "urls": [HOMEVIEW["url"], WONDER["url"]]}
        self.assertIs(N._sure_repeat(WONDER, self.index(sent)), sent)
        self.assertIs(N._sure_repeat({**SPARK, "url": "https://x.example/1"}, self.index(SPARK)), SPARK)  # same headline
        self.assertIsNone(N._sure_repeat(SPARK_AGAIN, self.index(SPARK)))
        # A malformed history entry doesn't stop the daily.
        self.assertIsNone(N._sure_repeat(SPARK, self.index({"title": "x", "urls": 5}, {"title": "y", "url": None})))

    def test_close_calls_are_asked_and_strangers_are_not(self):
        self.assertEqual(N._look_alikes(SPARK_AGAIN, self.index(SPARK)), [SPARK])
        self.assertEqual(N._look_alikes(ARREST_AGAIN, self.index(ARREST)), [ARREST])
        # These share words but are different news: the model sees them, words don't decide.
        for new, sent in ((WONDER, SPARK), (FTC, STATES), (LINKENER, VESSLA), (HOMEVIEW_APPS, HOMEVIEW)):
            self.assertEqual(N._look_alikes(new, self.index(sent)), [sent], new["title"])
        self.assertEqual(N._look_alikes(SPARK, self.index(ARREST, STATES, FTC, VESSLA, HOMEVIEW)), [])
        # At most the two closest per story.
        many = [{**SPARK, "url": f"https://x.example/{i}", "title": SPARK["title"] + f" {i}"} for i in range(4)]
        self.assertEqual(len(N._look_alikes(SPARK_AGAIN, self.index(*many))), N.REPEAT_ASK_PER_STORY)

    def test_the_model_decides_close_calls(self):
        candidates = [{"topic_id": s["url"], **s} for s in (SPARK_AGAIN, WONDER, ARREST_AGAIN, FTC)]
        judge = judge_saying_yes_to(SPARK_AGAIN["title"], ARREST_AGAIN["title"])
        with patch.object(N, "judge_repeats", judge):
            repeats = N._find_repeats(None, candidates, [SPARK, ARREST, STATES])
        self.assertEqual(set(repeats), {SPARK_AGAIN["url"], ARREST_AGAIN["url"]})
        self.assertEqual(repeats[SPARK_AGAIN["url"]], SPARK["title"])
        self.assertIn((WONDER["title"], SPARK["title"]), [(n["title"], m["title"]) for n, m in judge.asked])

    def test_without_the_model_only_sure_repeats_go(self):
        candidates = [{"topic_id": s["url"], **s} for s in (SPARK, SPARK_AGAIN)]
        with patch.object(N, "judge_repeats", lambda store, pairs: None):
            self.assertEqual(set(N._find_repeats(None, candidates, [SPARK])), {SPARK["url"]})
        self.assertEqual(N._find_repeats(None, candidates, []), {})

    def test_a_new_story_grouped_with_yesterdays_still_goes_out(self):
        # The day's grouping puts Muse Wonder with Muse Spark; only Spark went out.
        feed = {"trending_topics": [topic(SPARK, tid="a"), topic(WONDER, tid="b")], "trending": []}
        self.assertEqual(len(N._story_groups(feed)), 1)
        with patch.object(N, "judge_repeats", judge_saying_yes_to()):
            repeats = N._find_repeats(None, N._candidates(feed), [SPARK])
        self.assertEqual(set(repeats), {"a"})
        self.assertEqual([g["title"] for g in N._story_groups(feed, leave_out=set(repeats))], [WONDER["title"]])

    def test_every_article_of_a_sent_story_is_remembered(self):
        today = {**topic(HOMEVIEW_APPS), "articles": [
            {"title": HOMEVIEW_APPS["title"], "url": HOMEVIEW_APPS["url"]},
            {"title": "Another outlet", "url": "https://other.example/a"}]}
        groups = N._story_groups({"trending_topics": [today], "trending": []})
        self.assertEqual(groups[0]["urls"], [HOMEVIEW_APPS["url"], "https://other.example/a"])
        record = N._sent_record(groups, [])
        # Tomorrow that second article leads a topic with a new headline: still a repeat.
        tomorrow = {"topic_id": "t", **story("A headline with nothing in common", "", "https://other.example/a")}
        self.assertEqual(set(N._find_repeats(None, [tomorrow], record)), {"t"})

    def test_a_story_only_grouped_with_one_that_went_out_is_asked_about_not_dropped(self):
        # Day one: Muse Wonder is grouped under Muse Spark's headline, which went out.
        day_one = {"trending_topics": [topic(SPARK, tid="a"), topic(WONDER, tid="b")], "trending": []}
        groups = N._story_groups(day_one)
        self.assertEqual((len(groups), groups[0]["title"]), (1, SPARK["title"]))
        record = N._sent_record(groups, [])
        self.assertEqual(record[0]["urls"], [SPARK["url"]])  # not Wonder's link
        # Day two: Wonder leads its own topic. The model is asked, and says it's new.
        judge = judge_saying_yes_to()
        with patch.object(N, "judge_repeats", judge):
            repeats = N._find_repeats(None, [{"topic_id": "b", **WONDER}], record)
        self.assertEqual(repeats, {})
        self.assertEqual([(n["title"], m["title"]) for n, m in judge.asked], [(WONDER["title"], SPARK["title"])])

    def test_member_only_stories_are_recorded_too(self):
        groups = N._story_groups({"trending_topics": [topic(SPARK)], "trending": []})
        member_only = {**FTC, "urls": [FTC["url"]]}
        record = N._sent_record(groups, [[("ai", [member_only])]])
        self.assertEqual({s["title"] for s in record}, {SPARK["title"], FTC["title"]})


class JudgeTests(unittest.TestCase):
    def store(self, cache: dict) -> types.SimpleNamespace:
        return types.SimpleNamespace(get_cached_synthesis=cache.get,
                                     cache_synthesis=lambda key, value: cache.__setitem__(key, value))

    def test_one_call_cached_answers_and_no_key(self):
        calls: list = []

        def ask(client, pairs):
            calls.append(pairs)
            return {pid: pair["new"]["title"] == SPARK_AGAIN["title"] for pid, pair in pairs.items()}

        cache: dict = {}
        pairs = [(SPARK_AGAIN, SPARK), (WONDER, SPARK)]
        with patch.object(R, "_client", lambda: object()), patch.object(R, "_ask", ask):
            self.assertEqual(R.judge_repeats(self.store(cache), pairs), {0: True, 1: False})
            self.assertEqual(R.judge_repeats(self.store(cache), pairs), {0: True, 1: False})
        self.assertEqual(len(calls), 1)  # the second run read the cache
        self.assertEqual(calls[0]["p0"]["sent"]["title"], SPARK["title"])
        self.assertIsNone(R.judge_repeats(self.store({}), pairs))  # no key: the caller sends them
        self.assertEqual(R.judge_repeats(self.store({}), []), {})

    def test_a_failed_or_partial_answer_judges_nothing_it_missed(self):
        pairs = [(SPARK_AGAIN, SPARK), (WONDER, SPARK)]
        with patch.object(R, "_client", lambda: object()), \
                patch.object(R, "_ask", side_effect=RuntimeError("Incorrect API key provided: sk-proj-abc123")):
            self.assertEqual(R.judge_repeats(self.store({}), pairs), {})
        with patch.object(R, "_client", lambda: object()), patch.object(R, "_ask", lambda client, p: {"p1": False}):
            self.assertEqual(R.judge_repeats(self.store({}), pairs), {1: False})
        # A down API is tried once, not once per batch: the daily doesn't wait out every timeout.
        many = [({"title": f"new {i}"}, {"title": f"sent {i}"}) for i in range(R.BATCH * 2 + 1)]
        with patch.object(R, "_client", lambda: object()), \
                patch.object(R, "_ask", side_effect=TimeoutError("read timed out")) as ask:
            self.assertEqual(R.judge_repeats(self.store({}), many), {})
        self.assertEqual(ask.call_count, 1)

    def test_the_request(self):
        sent: dict = {}

        class Client:
            def with_options(self, **kwargs):
                return self

            class chat:
                class completions:
                    @staticmethod
                    def create(**kwargs):
                        sent.update(kwargs)
                        content = '{"p0": true, "p1": false, "p9": true}'
                        return types.SimpleNamespace(choices=[types.SimpleNamespace(
                            message=types.SimpleNamespace(content=content))])

        pairs = {"p0": {"sent": {"title": "a"}, "new": {"title": "b"}}, "p1": {"sent": {"title": "c"}, "new": {"title": "d"}}}
        self.assertEqual(R._ask(Client(), pairs), {"p0": True, "p1": False})  # nothing it wasn't asked
        self.assertNotIn("temperature", sent)  # the reasoning models only take the default
        self.assertEqual(sent["response_format"]["json_schema"]["schema"]["required"], ["p0", "p1"])
        self.assertIn('"title": "b"', sent["messages"][0]["content"])


class HistoryTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.db = LocalFirestoreClient(os.path.join(self.tmp.name, "db.sqlite3"))
        self.store = types.SimpleNamespace(db=self.db)

    def edition(self, day: str, **fields) -> None:
        self.db.collection(N.EDITIONS_COLLECTION).document(day).set({"date": day, **fields})

    def test_the_three_days_before(self):
        self.edition("2026-10-20", stories=[SPARK])  # today: not a repeat of itself
        self.edition("2026-10-19", stories=[WONDER], sent=[ARREST, STATES])  # what went out wins
        self.edition("2026-10-18", stories=[FTC])  # recorded before `sent` existed
        self.edition("2026-10-16", stories=[VESSLA])  # four days back: fair game again
        titles = [s["title"] for s in N._recent_sent(self.store, "2026-10-20")]
        self.assertEqual(titles, [ARREST["title"], STATES["title"], FTC["title"]])

    def test_no_history_is_not_fatal(self):
        broken = types.SimpleNamespace(db=None)
        self.assertEqual(N._recent_sent(broken, "2026-10-20"), [])

    def run_daily(self, day: str, feed: dict, sent_log: list) -> dict:
        def send(**kwargs):
            sent_log.append((day, kwargs["html_content"]))
            return {"success": True, "transport": "test"}

        reader = {"uid": "", "email": "reader@example.com", "name": "", "interests": []}
        with patch.multiple(
            N,
            FirestoreStore=lambda: self.store,
            V3Store=lambda: None,
            _load_global_feed=lambda store, date: feed,
            _send_worthy_verdicts=lambda v3_store, candidates: {},
            judge_repeats=judge_saying_yes_to(SPARK_AGAIN["title"]),
            sync_brevo=lambda db, dry_run=False: {"skipped": "test"},
            _resolve_audience=lambda store, v3_store: {"member": [], "winback": [], "landing": [reader]},
            send_newsletter_email=send,
        ):
            return N.send_audience_newsletter(date=day, dry_run=False)

    def test_tomorrows_daily_leaves_out_todays_stories(self):
        sent_log: list = []
        monday = {"trending_topics": [topic(SPARK), topic(STATES, "markets")], "trending": []}
        self.assertTrue(self.run_daily("2026-10-19", monday, sent_log)["success"])
        doc = self.db.collection(N.EDITIONS_COLLECTION).document("2026-10-19").get().to_dict()
        self.assertEqual({s["title"] for s in doc["sent"]}, {SPARK["title"], STATES["title"]})
        self.assertEqual(doc["story_count"], 2)

        # Tuesday's pool still has both, one under a new headline, plus one new story.
        tuesday = {"trending_topics": [topic(SPARK_AGAIN), topic(STATES, "markets"), topic(WONDER)], "trending": []}
        self.assertTrue(self.run_daily("2026-10-20", tuesday, sent_log)["success"])
        html = sent_log[-1][1]
        self.assertIn("Muse Wonder", html)
        self.assertNotIn("Muse Spark", html)
        self.assertNotIn("Eight States", html)
        tuesday_doc = self.db.collection(N.EDITIONS_COLLECTION).document("2026-10-20").get().to_dict()
        self.assertEqual([s["title"] for s in tuesday_doc["stories"]], [WONDER["title"]])

        # Publishing Tuesday again (a re-run) keeps what was recorded as sent.
        with patch.multiple(N, FirestoreStore=lambda: self.store, V3Store=lambda: None,
                            _load_global_feed=lambda store, date: tuesday,
                            _send_worthy_verdicts=lambda v3_store, candidates: {},
                            judge_repeats=judge_saying_yes_to(SPARK_AGAIN["title"])):
            N.send_audience_newsletter(date="2026-10-20", dry_run=False, publish_only=True)
        again = self.db.collection(N.EDITIONS_COLLECTION).document("2026-10-20").get().to_dict()
        self.assertEqual([s["title"] for s in again["sent"]], [WONDER["title"]])

    def test_a_run_that_dies_part_way_still_records_and_a_rerun_adds(self):
        self.edition("2026-10-19", sent=[ARREST])  # an earlier run today
        feed = {"trending_topics": [topic(SPARK)], "trending": []}
        readers = [{"uid": "", "email": f"r{i}@example.com", "name": "", "interests": []} for i in range(2)]
        sends = iter([{"success": True, "transport": "test"}, KeyboardInterrupt()])

        def send(**kwargs):
            result = next(sends)
            if isinstance(result, BaseException):
                raise result
            return result

        with patch.multiple(
            N,
            FirestoreStore=lambda: self.store,
            V3Store=lambda: None,
            _load_global_feed=lambda store, date: feed,
            _send_worthy_verdicts=lambda v3_store, candidates: {},
            judge_repeats=judge_saying_yes_to(),
            sync_brevo=lambda db, dry_run=False: {"skipped": "test"},
            _resolve_audience=lambda store, v3_store: {"member": [], "winback": [], "landing": readers},
            send_newsletter_email=send,
        ), self.assertRaises(KeyboardInterrupt):
            N.send_audience_newsletter(date="2026-10-19", dry_run=False)
        doc = self.db.collection(N.EDITIONS_COLLECTION).document("2026-10-19").get().to_dict()
        self.assertEqual({s["title"] for s in doc["sent"]}, {ARREST["title"], SPARK["title"]})

    def test_a_dry_run_records_nothing(self):
        sent_log: list = []
        feed = {"trending_topics": [topic(SPARK)], "trending": []}
        with patch.multiple(
            N,
            FirestoreStore=lambda: self.store,
            V3Store=lambda: None,
            _load_global_feed=lambda store, date: feed,
            _send_worthy_verdicts=lambda v3_store, candidates: {},
            judge_repeats=judge_saying_yes_to(),
            sync_brevo=lambda db, dry_run=False: {"skipped": "test"},
            _resolve_audience=lambda store, v3_store: {
                "member": [], "winback": [], "landing": [{"uid": "", "email": "r@example.com", "name": "", "interests": []}]},
            send_newsletter_email=lambda **kwargs: sent_log.append(kwargs),
        ):
            N.send_audience_newsletter(date="2026-10-19", dry_run=True)
        self.assertEqual(sent_log, [])
        self.assertFalse(self.db.collection(N.EDITIONS_COLLECTION).document("2026-10-19").get().exists)


if __name__ == "__main__":
    unittest.main()
