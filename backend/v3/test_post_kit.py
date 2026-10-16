import argparse
import base64
import fcntl
import io
import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch

from PIL import Image

from v3.flows import build_post_kit as kit

# 07:30 in London on Oct 14 (BST): 12:00 in India, the same feed date.
NOW = datetime(2026, 10, 14, 6, 30, tzinfo=timezone.utc)
DATE = "2026-10-14"
FRESH = "2026-10-14T05:00:00+00:00"
OLD = "2026-10-12T05:00:00+00:00"


def article(url, source, title="A headline", thumbnail="", when=FRESH):
    return {"url": url, "source_name": source, "title": title, "thumbnail": thumbnail, "published_date": when}


def topic(tid, title, sources, summary="Summary sentence one. Sentence two.", points=None, when=FRESH, image=True, **extra):
    return {
        "id": tid, "title": title, "interest_id": "ai", "summary": summary, "source_count": len(sources),
        "key_points": points if points is not None else ["Point one", "Point two"],
        "articles": [article(f"https://{s.lower().replace(' ', '')}.com/{tid}", s, f"{s} on {title}",
                             f"https://img.example/{tid}-{i}.jpg" if image else "", when) for i, s in enumerate(sources)],
        "last_updated_at": when, "first_seen_at": when,
        **extra,
    }


def pulse_item(item_id, title, url, source, summary="One line about it.", by=""):
    return {"id": item_id, "title": title, "url": url, "source": source, "signal": "100 points", "by": by,
            "thumbnail": "https://img.example/a.png", "summary": {"body": summary, "short_article": {"body": summary}}}


ROADSTER = topic("roadster", "Tesla's Roadster gets SpaceX thrusters", ["The Verge", "Engadget"],
                 summary="Tesla showed the **Roadster** doing a flip with 10 thrusters. Production starts in 2028.")
FUNDING = topic("fund", "Holo raises 5 million euros for marketing software", ["EU-Startups", "Tech.eu", "Sifted"],
                image=False)
SUIT = topic("suit", "Eight states sue OpenAI over ChatGPT and children", ["Reuters", "AP", "CNBC", "Bloomberg", "WSJ"])
BRAIN = topic("brain", "Lab-grown brain tissue reads Braille", ["New Scientist"])
DOC = {
    "trending_topics": [SUIT, FUNDING, ROADSTER, BRAIN],
    "daily_pulse_roles": {"developer": {
        "tools": [pulse_item("t1", "astral-sh / uv", "https://github.com/astral-sh/uv", "GitHub Trending"),
                  pulse_item("t2", "Zed", "https://zed.dev", "Show HN", by="nathan")],
        "discussions": [pulse_item("d1", "Things we learned", "https://simonwillison.net/post", "Hacker News", by="simonw"),
                        pulse_item("d2", "A design read", "https://sidebar.io/x", "Sidebar", by="ignored")],
    }},
}
POOL = [
    {"title": "The Tesla Roadster flew and drove upside down", "url": "https://theverge.com/roadster-flew",
     "source_name": "The Verge", "og_image": "https://img.example/flew.jpg", "published_date": FRESH,
     "content": "The Roadster flew 20 feet and drove upside down on a wall."},
    {"title": "Old news from last week", "url": "https://old.example/a", "source_name": "Old", "published_date": OLD},
    {"title": "Eight states sue OpenAI over ChatGPT and children", "url": "https://dupe.example/suit",
     "source_name": "Dupe", "published_date": FRESH},
    {"title": "Best deals on laptops this week", "url": "https://deals.example/x", "source_name": "Deals",
     "published_date": FRESH},
]


class FakeDoc:
    def __init__(self, table, doc_id, fail=False):
        self.table, self.id, self.fail = table, doc_id, fail

    def get(self):
        snap = MagicMock()
        snap.exists = self.id in self.table
        snap.to_dict.return_value = json.loads(json.dumps(self.table.get(self.id, {})))
        return snap

    def set(self, data, merge=False):
        if self.fail:
            raise RuntimeError("database is locked")
        self.table[self.id] = {**(self.table.get(self.id, {}) if merge else {}), **json.loads(json.dumps(data))}


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
    def __init__(self, feed=None, earlier=None, markers=None, fail_writes=False, pool=None):
        self.docs = {f"v3_user_feeds/_global/daily/{DATE}": json.loads(json.dumps(feed if feed is not None else DOC))}
        if earlier is not None:
            self.docs["v3_user_feeds/_global/daily/2026-10-13"] = earlier
        for date, marker in (markers or {}).items():
            self.docs[f"{kit.MARKERS}/{date}"] = marker
        self.fail_writes = fail_writes
        self.pool = pool if pool is not None else []
        self.db = MagicMock()
        self.db.collection.side_effect = lambda name: FakeCollection(self, name)

    def load_global_feed(self, date):
        return dict(self.docs.get(f"v3_user_feeds/_global/daily/{date}", {}))

    def load_pool(self, collection, max_age_days=14):
        assert (collection, max_age_days) == (kit.TRENDING_POOL, 2)
        return list(self.pool)

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


def stories():
    return kit.candidates([DOC], NOW, POOL)


def index(title_start):
    return next(i for i, s in enumerate(stories()) if s["title"].startswith(title_start))


GOOD = {
    "bullets": [{"pick": 0, "text": "⚖️ Eight states are suing OpenAI"},
                {"pick": 3, "text": "🧠 Lab-grown brain tissue reads Braille"},
                {"pick": 4, "text": "🚗 Tesla's Roadster flew and drove upside down"}],
    "media_pick": 4,
    "video_query": "Tesla Roadster flip thrusters",
}


def jpeg(width, height, mode="RGB"):
    buffer = io.BytesIO()
    Image.new(mode, (width, height), (200, 30, 30, 128) if mode == "RGBA" else (200, 30, 30)).save(
        buffer, "PNG" if mode == "RGBA" else "JPEG")
    return buffer.getvalue()


class CandidateTests(unittest.TestCase):
    def test_topics_then_ungrouped_articles_from_the_last_day(self):
        found = stories()
        self.assertEqual([s["title"] for s in found], [
            "Eight states sue OpenAI over ChatGPT and children",
            "Holo raises 5 million euros for marketing software",
            "Tesla's Roadster gets SpaceX thrusters",
            "Lab-grown brain tissue reads Braille",
            "The Tesla Roadster flew and drove upside down",  # old, duplicate and promotional articles are left out
        ])
        roadster = found[2]
        self.assertEqual(roadster["headlines"], ["The Verge on Tesla's Roadster gets SpaceX thrusters",
                                                 "Engadget on Tesla's Roadster gets SpaceX thrusters"])
        self.assertNotIn("**", roadster["summary"])
        self.assertEqual(roadster["images"], ["https://img.example/roadster-0.jpg", "https://img.example/roadster-1.jpg"])
        self.assertEqual((found[4]["source_count"], found[4]["images"], found[4]["topic_id"]),
                         (1, ["https://img.example/flew.jpg"], ""))

    def test_the_window_is_the_feed_own_last_day(self):
        stale = topic("stale", "Something from two days ago", ["A"], when=OLD)
        undated = {**topic("undated", "No times at all", ["B"]), "last_updated_at": None, "first_seen_at": None,
                   "articles": [{"url": "https://b.com/x", "source_name": "B", "title": "x"}]}
        earlier = {"trending_topics": [topic("yday", "Yesterday evening's launch", ["C"]), undated]}
        found = kit.candidates([{"trending_topics": [stale, ROADSTER]}, earlier], NOW)
        self.assertEqual([s["topic_id"] for s in found], ["roadster", "yday"])
        # A saved day keeps its own 24 hours: "now" is its newest story, not the clock.
        later = datetime(2026, 10, 20, tzinfo=timezone.utc)
        self.assertEqual([s["topic_id"] for s in kit.candidates([{"trending_topics": [ROADSTER]}], later)], ["roadster"])

    def test_junk_and_repeats_are_skipped(self):
        junk = topic("junk", "Puzzle answers for today", ["A"], jev_send_worthy=0)
        twin = topic("twin", "Tesla's Roadster gets SpaceX thrusters", ["Wired"])
        promo = topic("promo", "Best deals on AI laptops this week", ["A"])
        found = kit.candidates([{"trending_topics": [junk, ROADSTER, twin, promo, {"title": "no articles"}, None]},
                                {"trending_topics": [ROADSTER]}], NOW)
        self.assertEqual([s["topic_id"] for s in found], ["roadster"])


class LengthTests(unittest.TestCase):
    def test_x_counts_links_cjk_and_emoji(self):
        self.assertEqual(kit.x_length("hi https://www.yourtrace.online/brief/2026-10-14?utm_source=x"), 3 + 23)
        self.assertEqual(kit.x_length("日本"), 4)
        self.assertEqual(kit.x_length("🕵️‍♂️"), 2)  # one emoji however many code points
        self.assertEqual(kit.x_length("👍🏽 ok"), 5)


class WritingTests(unittest.TestCase):
    def test_the_model_post_is_used_when_it_follows_the_rules(self):
        model, client = fake_model(GOOD)
        with model:
            post = kit.write_x_post(stories())
        self.assertEqual(post["written_by"], "model")
        # The story with the picture (the model's media pick) goes first.
        self.assertEqual([b["text"].split()[0] for b in post["bullets"]], ["Tesla's", "Eight", "Lab-grown"])
        self.assertEqual(post["lead"]["title"], "The Tesla Roadster flew and drove upside down")
        # The model's emoji are stripped: the post is the founder's format, dashes and a sign-off.
        self.assertTrue(post["text"].startswith("Biggest updates in tech in the last 24 hours:\n\n- Tesla's Roadster flew"))
        self.assertTrue(post["text"].endswith("\n\nDid I miss anything??"))
        self.assertEqual(post["video_query"], "Tesla Roadster flip thrusters")
        request = client.chat.completions.create.call_args.kwargs
        self.assertEqual((request["model"], request["timeout"]), (kit.KIT_MODEL, 240))
        self.assertNotIn("temperature", request)  # the GPT-5 and 6 models only take the default
        self.assertTrue(request["response_format"]["json_schema"]["strict"])
        prompt = request["messages"][1]["content"]
        self.assertIn("[4] [image] 1 outlet · The Tesla Roadster flew and drove upside down", prompt)
        self.assertIn("Text: The Roadster flew 20 feet", prompt)

    def test_bullets_that_break_the_rules_are_dropped(self):
        answer = {**GOOD, "bullets": GOOD["bullets"] + [
            {"pick": 2, "text": "🚀 The Roadster has 40 thrusters"},           # the story says 10
            {"pick": 1, "text": "💸 Holo raised money #startups"},
            {"pick": 1, "text": "💸 Holo raised money, read https://x.co/a"},
            {"pick": 1, "text": "💸 @holo raised money today"},
            {"pick": 99, "text": "👻 A story that does not exist"},
            {"pick": 0, "text": "⚖️ The same story twice"},
            {"pick": 1, "text": "💸 " + "very " * 30 + "long"},
        ]}
        model, _ = fake_model(answer)
        with model, patch.object(kit, "_log") as log:
            post = kit.write_x_post(stories())
        self.assertEqual(len(post["bullets"]), 3)
        self.assertIn("numbers 40", " ".join(str(c) for c in log.call_args_list))

    def test_no_hype(self):
        answer = {**GOOD, "bullets": [
            {"pick": 0, "text": "⚖️ Eight states are literally suing OpenAI"},     # a filler is cut
            {"pick": 3, "text": "🧠 Lab-grown brain tissue just reads Braille"},
            {"pick": 4, "text": "🚗 Tesla's Roadster flew and drove upside down"},
            {"pick": 1, "text": "💸 Holo's raise is insane"},                      # hype: dropped
            {"pick": 2, "text": "🚀 The Roadster has SpaceX thrusters!"},
        ]}
        model, _ = fake_model(answer)
        with model, patch.object(kit, "_log") as log:
            post = kit.write_x_post(stories())
        self.assertEqual(post["hook"], kit.DEFAULT_HOOK)  # the opener is never the model's
        self.assertEqual([b["text"] for b in post["bullets"]], [
            "Tesla's Roadster flew and drove upside down",
            "Eight states are suing OpenAI",
            "Lab-grown brain tissue reads Braille",
        ])
        logged = " ".join(str(c) for c in log.call_args_list)
        self.assertIn("raise is insane", logged)
        self.assertIn("hype '!'", logged)
        self.assertNotIn("hook", kit.X_POST_SCHEMA["properties"])

    def test_too_few_good_bullets_or_too_long_uses_the_template(self):
        model, _ = fake_model({**GOOD, "bullets": GOOD["bullets"][:2]})
        with model:
            self.assertEqual(kit.write_x_post(stories())["written_by"], "template")
        model, _ = fake_model(GOOD)
        with model:
            self.assertEqual(kit.write_x_post(stories(), limit=60)["written_by"], "template")

    def test_long_posts_drop_bullets_from_the_end_never_the_lead(self):
        extra = [{"pick": 1, "text": "💸 Holo raised 5 million euros for marketing"},
                 {"pick": 2, "text": "🚀 Tesla's Roadster now has SpaceX thrusters"}]
        model, _ = fake_model({**GOOD, "bullets": GOOD["bullets"] + extra})
        with model:
            post = kit.write_x_post(stories(), limit=240)
        self.assertEqual(post["written_by"], "model")
        self.assertLessEqual(post["length"], 240)
        self.assertLess(len(post["bullets"]), 5)
        self.assertGreaterEqual(len(post["bullets"]), kit.MIN_BULLETS)
        self.assertTrue(post["bullets"][0]["text"].startswith("Tesla's"))

    def test_hype_at_the_start_and_phrases_that_are_not_hype(self):
        for text in ("Huge outage hits AWS", "Insane demo of a robot", "Breaking: Apple sues", "a huge leak", "It works!"):
            self.assertTrue(kit._hype(text), text)
        for text in ("Epic Games wins its appeal", "Wild Rift adds a mode", "Malware exploited in the wild",
                     "Python ships breaking changes", "Record-breaking Starship flight", "Chaos Computer Club warns",
                     "Yahoo! sells Tumblr"):
            self.assertFalse(kit._hype(text), text)
        for text in ("C# 14 ships", "HTTP/3 arrives"):
            self.assertFalse(kit._breaks_rules(text), text)
        self.assertEqual(kit.TRAILING.sub("", kit.LEADING.sub("", "1️⃣ Tesla flew 🚀")), "Tesla flew")

    def test_names_and_domains(self):
        epic = topic("epic", "Epic Games wins its appeal against Apple", ["Reuters"])
        eat = topic("eat", "Just Eat Takeaway sells its US business", ["FT"])
        xai = topic("xai", "xAI opens Grok to everyone", ["The Verge"])
        found = kit.candidates([{"trending_topics": [epic, eat, xai, ROADSTER]}], NOW)
        answer = {"bullets": [{"pick": 0, "text": "Epic Games won its appeal against Apple"},
                              {"pick": 1, "text": "Just Eat Takeaway sold its US business"},
                              {"pick": 2, "text": "Grok is now free for everyone on x.ai"},
                              {"pick": 3, "text": "Tesla's Roadster gets SpaceX thrusters"}],
                  "media_pick": 3, "video_query": "Tesla Roadster thrusters"}
        model, _ = fake_model(answer)
        with model, patch.object(kit, "_log"):
            post = kit.write_x_post(found)
        texts = [b["text"] for b in post["bullets"]]
        self.assertIn("Epic Games won its appeal against Apple", texts)  # a name, not hype
        self.assertIn("Just Eat Takeaway sold its US business", texts)   # not "Eat Takeaway"
        self.assertFalse(any("x.ai" in t for t in texts))                # X would make it a link

    def test_the_video_is_of_the_line_that_leads(self):
        # The model's pick (the Roadster) is dropped for a made-up number: the next story with a
        # picture leads, and the video search follows it rather than the dropped pick.
        answer = {**GOOD, "bullets": [{"pick": 4, "text": "Tesla's Roadster flew 99 feet"}, *GOOD["bullets"][:2],
                                      {"pick": 2, "text": "Tesla's Roadster gets SpaceX thrusters"}]}
        model, _ = fake_model(answer)
        with model, patch.object(kit, "_log"):
            post = kit.write_x_post(stories())
        self.assertEqual(post["lead"]["title"], "Eight states sue OpenAI over ChatGPT and children")
        self.assertEqual(post["video_query"], "Eight states sue OpenAI over ChatGPT and children")

    def test_the_model_gets_what_is_left_after_the_opener(self):
        model, client = fake_model(GOOD)
        with model:
            kit.write_x_post(stories(), limit=360)
        prompt = client.chat.completions.create.call_args.kwargs["messages"][1]["content"]
        self.assertIn(f"fit in {kit._line_budget(360)} characters", prompt)
        self.assertLess(kit._line_budget(360), 360 - len(kit.DEFAULT_HOOK) - len(kit.CLOSER))

    def test_template_when_there_is_no_model_or_it_fails(self):
        with no_model():
            post = kit.write_x_post(stories())
        self.assertEqual(post["written_by"], "template")
        self.assertTrue(post["text"].startswith(kit.DEFAULT_HOOK + "\n\n- "))
        self.assertTrue(post["text"].endswith(kit.CLOSER))
        self.assertLessEqual(post["length"], kit.X_MAX)
        # Widest coverage first, but the lead has a picture.
        self.assertEqual(post["lead"]["title"], "Eight states sue OpenAI over ChatGPT and children")
        client = MagicMock()
        client.with_options.return_value = client
        client.chat.completions.create.side_effect = RuntimeError("401 Incorrect API key sk-proj-abc***xyz")
        with patch("v3.lib.summarizer._get_client", return_value=client), patch.object(kit, "_log") as log:
            self.assertEqual(kit.write_x_post(stories())["written_by"], "template")
        self.assertNotIn("sk-proj", " ".join(str(c) for c in log.call_args_list))
        self.assertIsNone(kit.write_x_post([]))

    def test_number_words_count_as_numbers(self):
        self.assertEqual(kit.invented_numbers("It is ten times faster", "It is faster"), {"ten"})
        self.assertEqual(kit.invented_numbers("Two million tokens", "two million tokens"), set())
        self.assertEqual(kit.invented_numbers("The one thing that matters", "a model"), set())


class MediaTests(unittest.TestCase):
    def test_the_biggest_usable_image_becomes_a_jpeg(self):
        files = {"https://a/small.jpg": jpeg(300, 200), "https://a/big.png": jpeg(1600, 900, "RGBA"),
                 "https://a/mid.jpg": jpeg(1000, 600), "https://a/junk": b"<html>not an image</html>"}
        image = kit.pick_image(["https://a/missing", "https://a/small.jpg", "https://a/junk", "https://a/big.png",
                                "https://a/mid.jpg"], fetch=files.get)
        # Only the first IMAGE_TRIES are tried: mid.jpg is fifth.
        self.assertEqual((image["source_url"], image["size"]), ("https://a/big.png", (1600, 900)))
        self.assertTrue(image["bytes"].startswith(b"\xff\xd8"))
        self.assertIsNone(kit.pick_image(["https://a/small.jpg"], fetch=files.get))

    def test_fetches_stay_on_public_hosts_and_under_the_cap(self):
        session = MagicMock()
        with patch.object(kit, "_public_http", return_value=False):
            self.assertIsNone(kit.fetch_bytes("http://169.254.169.254/latest", session=session))
        session.get.assert_not_called()

        def response(status, headers, body=b""):
            r = MagicMock(status_code=status, headers=headers)
            r.iter_content.return_value = [body]
            r.__enter__.return_value = r
            return r

        hops = iter([response(302, {"location": "http://10.0.0.1/secret"})])
        session = MagicMock()
        session.get.side_effect = lambda *a, **k: next(hops)
        with patch.object(kit, "_public_http", side_effect=lambda url: "10.0.0.1" not in url):
            self.assertIsNone(kit.fetch_bytes("https://cdn.example/a.jpg", session=session))
        self.assertEqual(session.get.call_count, 1)  # the private redirect target is never asked
        session = MagicMock()
        session.get.return_value = response(200, {"content-length": str(kit.IMAGE_MAX_BYTES + 1)})
        with patch.object(kit, "_public_http", return_value=True):
            self.assertIsNone(kit.fetch_bytes("https://cdn.example/huge.jpg", session=session))
        session.get.return_value = response(200, {}, b"abc")
        with patch.object(kit, "_public_http", return_value=True):
            self.assertEqual(kit.fetch_bytes("https://cdn.example/a.jpg", session=session), b"abc")

    def test_videos_that_show_what_the_post_says_come_first(self):
        story = stories()[index("Tesla's Roadster")]
        entries = [
            {"url": "https://www.youtube.com/watch?v=adv", "title": "Roadster | The Last Best Driver's Car",
             "channel": "Tesla", "duration": 87, "view_count": 1300000},
            {"url": "https://www.youtube.com/watch?v=kbs", "title": "Tesla Roadster riding walls and doing backflips",
             "channel": "KBS News", "duration": 169, "view_count": 20000},
            {"url": "https://www.youtube.com/watch?v=long", "title": "Tesla Roadster event: flips and thrusters",
             "channel": "Fan Channel", "duration": 3600, "view_count": 900000},
            {"url": "https://vimeo.com/1", "title": "Roadster backflips", "channel": "Tesla", "duration": 30},
            {"url": "https://www.youtube.com/@TeslaFlips", "title": "Roadster backflips", "channel": "Tesla"},
        ]
        ranked = kit.rank_videos(entries, story, line="🚗 Tesla showed a Roadster that flips on thrusters")
        # "flips" matches "backflips"; "Tesla" and "Roadster" are in every title and count for nothing.
        self.assertEqual([v["url"][-3:] for v in ranked], ["kbs", "ong", "adv"])
        self.assertTrue(ranked[2]["official"])

    def test_video_search_never_holds_up_the_post(self):
        story = stories()[0]
        self.assertEqual(kit.find_videos("", story), [])
        with patch.object(kit, "_log"):
            self.assertEqual(kit.find_videos("q", story, search=MagicMock(side_effect=RuntimeError("bot check"))), [])
            self.assertEqual(kit.find_videos("q", story, search=lambda q: __import__("time").sleep(1) or [],
                                             deadline=0.05), [])


class FeaturedTests(unittest.TestCase):
    def test_tools_then_top_articles(self):
        items = kit.featured_items(DOC)
        self.assertEqual([i["id"] for i in items], ["t1", "t2", "d1", "d2"])
        self.assertEqual([i["section"] for i in items], ["tools", "tools", "discussions", "discussions"])
        self.assertEqual(items[2]["summary"], "One line about it.")

    def test_junk_items_are_skipped(self):
        doc = {"daily_pulse_roles": {"developer": {"tools": [
            None, {"id": "", "title": "x", "url": "https://a.dev"}, {"id": "a", "title": "", "url": "https://a.dev"},
            {"id": "b", "title": "B", "url": "javascript:alert(1)"}, pulse_item("c", "C", "https://c.dev", "Show HN"),
            pulse_item("d", "D", "https://[odd.dev/x", "Show HN"), pulse_item("c", "C again", "https://c2.dev", "Show HN"),
        ]}}}
        self.assertEqual([i["id"] for i in kit.featured_items(doc)], ["c"])
        self.assertEqual(kit.featured_items({}), [])


def args(**overrides):
    values = {"dry_run": False, "json": False, "fresh": False, "feed_json": None, "date": None, "day": None, "out": "",
              "lock": None}
    values.update(overrides)
    return argparse.Namespace(**values)


class RunTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.lock = str(Path(self.tmp.name) / "kit.lock")
        self.addCleanup(self.tmp.cleanup)
        video = {"url": "https://www.youtube.com/watch?v=x", "title": "Clip", "channel": "News", "duration": 60,
                 "views": 10, "official": False}
        for p in (patch.object(kit, "find_videos", return_value=[video]),
                  patch.object(kit, "pick_image", return_value={"name": "x-post.jpg", "bytes": b"\xff\xd8jpeg",
                                                                 "source_url": "https://img.example/a.jpg",
                                                                 "size": (1200, 630)})):
            p.start()
            self.addCleanup(p.stop)

    def run_kit(self, store, model=None, **overrides):
        with (model or no_model()), patch("builtins.print") as printed:
            code = kit.run(args(lock=self.lock, **overrides), now=NOW, store=store)
        lines = [c.args[0] for c in printed.call_args_list if c.args and str(c.args[0]).startswith("POSTKIT_JSON ")]
        return code, (json.loads(lines[0][len("POSTKIT_JSON "):]) if lines else None)

    def test_writes_the_post_once_and_keeps_featured_items(self):
        store = FakeStore(pool=POOL)
        model, client = fake_model(GOOD)
        code, printed = self.run_kit(store, model)
        self.assertEqual((code, printed), (0, None))
        marker = store.marker()
        stored = json.loads(marker["post_json"])  # one string: LocalDB deep-merges nested dicts
        self.assertEqual((stored["written_by"], marker["stories"], marker["attempts"]), ("model", 5, 1))
        featured = store.load_global_feed(DATE)["featured_items"]
        self.assertEqual([f["id"] for f in featured], ["t1", "t2", "d1", "d2"])
        kit.find_videos.assert_not_called()  # the 07:30 run doesn't fetch media
        # The laptop's run later gets the same post: the model is not asked again.
        code, printed = self.run_kit(store, json=True)
        self.assertEqual(code, 0)
        self.assertEqual(client.chat.completions.create.call_count, 1)
        self.assertEqual(printed["post"]["text"], stored["text"])
        self.assertEqual(printed["image"]["base64"], base64.b64encode(b"\xff\xd8jpeg").decode())
        self.assertEqual((printed["image"]["from"], printed["videos"][0]["url"], printed["limit"]),
                         ("The Verge", "https://www.youtube.com/watch?v=x", kit.X_MAX))
        self.assertIn("utm_medium=post", printed["reply"])
        self.assertTrue(printed["final"])

    def test_fresh_writes_a_new_post(self):
        old = json.dumps({"text": "old", "written_by": "model"})
        store = FakeStore(markers={DATE: {"post_json": old, "status": "sent"}}, pool=POOL)
        model, client = fake_model(GOOD)
        self.run_kit(store, model, fresh=True)
        self.assertEqual(client.chat.completions.create.call_count, 1)
        self.assertNotEqual(json.loads(store.marker()["post_json"])["text"], "old")
        self.assertEqual(store.marker()["status"], "sent")  # an old email kit's fields are left alone

    def test_a_template_post_is_retried_a_few_times(self):
        store = FakeStore(pool=POOL)
        self.run_kit(store)  # no model: the template
        self.assertEqual(json.loads(store.marker()["post_json"])["written_by"], "template")
        model, client = fake_model(GOOD)
        self.run_kit(store, model)  # the model is back: a real post replaces it
        self.assertEqual(client.chat.completions.create.call_count, 1)
        self.assertEqual(json.loads(store.marker()["post_json"])["written_by"], "model")
        with no_model():
            template = kit.write_x_post(stories())
        store = FakeStore(markers={DATE: {"post_json": json.dumps(template), "attempts": kit.MODEL_ATTEMPTS}})
        model, client = fake_model(GOOD)
        self.run_kit(store, model)  # after MODEL_ATTEMPTS tries the template stands
        client.chat.completions.create.assert_not_called()
        self.assertEqual(kit.stored_post({"post_json": "not json"}), None)

    def test_the_laptops_day_only(self):
        store = FakeStore()
        before = json.dumps(store.docs, sort_keys=True)
        code, printed = self.run_kit(store, json=True, day="2026-10-15")
        self.assertEqual((code, printed), (1, {"date": DATE, "post": None, "final": False}))
        self.assertEqual(json.dumps(store.docs, sort_keys=True), before)  # nothing written early
        code, printed = self.run_kit(store, json=True, day=DATE)
        self.assertEqual(code, 0)
        self.assertFalse(printed["final"])  # the template: the laptop waits for the model's post

    def test_old_email_kits_do_not_count_as_tries(self):
        store = FakeStore(markers={DATE: {"status": "sent", "attempts": 3}})
        self.run_kit(store)  # no model
        self.assertEqual(store.marker()["attempts"], 1)

    def test_fresh_keeps_a_model_post_when_the_model_is_down(self):
        model, _ = fake_model(GOOD)
        store = FakeStore(pool=POOL)
        self.run_kit(store, model)
        good = store.marker()["post_json"]
        self.run_kit(store, fresh=True)  # no model now
        self.assertEqual(store.marker()["post_json"], good)

    def test_an_older_day_keeps_its_own_window(self):
        store = FakeStore(pool=POOL)
        with patch.object(store, "load_pool", side_effect=AssertionError("no pool for --date")):
            code, _ = self.run_kit(store, date=DATE)
        self.assertEqual(code, 0)

    def test_featured_copy_keeps_earlier_items(self):
        feed = json.loads(json.dumps(DOC))
        feed["featured_items"] = [{"id": "old", "title": "Earlier pick", "featured_at": "2026-10-14T01:00:00+00:00"},
                                  {"id": "t1", "title": "stale copy", "featured_at": "2026-10-14T01:00:00+00:00"}]
        store = FakeStore(feed=feed)
        self.run_kit(store)
        featured = {f["id"]: f for f in store.load_global_feed(DATE)["featured_items"]}
        self.assertEqual(list(featured), ["old", "t1", "t2", "d1", "d2"])
        self.assertEqual((featured["t1"]["title"], featured["t1"]["featured_at"]), ("astral-sh / uv", "2026-10-14T01:00:00+00:00"))

    def test_no_feed_yet(self):
        self.assertEqual(self.run_kit(FakeStore(feed={}))[0], 1)

    def test_a_failed_write_still_prints_the_post(self):
        code, printed = self.run_kit(FakeStore(fail_writes=True), json=True)
        self.assertEqual(code, 0)
        self.assertEqual(printed["post"]["written_by"], "template")

    def test_waits_for_another_run_then_gives_up(self):
        with open(self.lock, "a") as held:
            fcntl.flock(held, fcntl.LOCK_EX | fcntl.LOCK_NB)
            with patch.object(kit, "LOCK_WAIT", 0.1), self.assertRaises(TimeoutError):
                with kit._locked(Path(self.lock), wait=0.1):
                    pass

    def test_dry_run_from_a_saved_feed_touches_no_database(self):
        feed = Path(self.tmp.name) / "day.json"
        feed.write_text(json.dumps(DOC))
        out = Path(self.tmp.name) / "out"
        with patch.object(kit, "_store", side_effect=AssertionError("no database in this dry run")):
            code, _ = self.run_kit(None, dry_run=True, feed_json=str(feed), date=DATE, out=str(out))
        self.assertEqual(code, 0)
        self.assertEqual(sorted(p.name for p in out.iterdir()), ["kit.json", "post.txt", "x-post.jpg"])
        self.assertNotIn("base64", (out / "kit.json").read_text())

    def test_dry_run_with_the_database_only_reads(self):
        store = FakeStore(pool=POOL)
        before = json.dumps(store.docs, sort_keys=True)
        model, _ = fake_model(GOOD)
        code, printed = self.run_kit(store, model, dry_run=True, json=True, out=str(Path(self.tmp.name) / "out"))
        self.assertEqual(code, 0)
        self.assertEqual(printed["post"]["lead"]["title"], "The Tesla Roadster flew and drove upside down")
        self.assertEqual(json.dumps(store.docs, sort_keys=True), before)


class DayTests(unittest.TestCase):
    def test_falls_back_to_yesterday_until_today_has_a_feed(self):
        docs = {"2026-10-13": {"trending_topics": [ROADSTER]}}
        self.assertEqual(kit.load_day(lambda d: docs.get(d, {}), NOW)[0], "2026-10-13")
        docs[DATE] = {"daily_pulse_roles": {"developer": {"tools": [{}]}}}
        self.assertEqual(kit.load_day(lambda d: docs.get(d, {}), NOW)[0], DATE)
        self.assertEqual(kit.load_day(lambda d: {}, NOW), (DATE, {}))
        self.assertEqual(kit.load_day(lambda d: docs.get(d, {}), NOW, "2026-10-13")[0], "2026-10-13")

    def test_a_new_ist_day_without_lists_waits_for_the_pulse(self):
        # 20:00 in London is already tomorrow in India; that doc has stories but no lists yet.
        evening = datetime(2026, 10, 14, 19, 0, tzinfo=timezone.utc)
        docs = {"2026-10-15": {"trending_topics": [ROADSTER]}, DATE: DOC}
        self.assertEqual(kit.load_day(lambda d: docs.get(d, {}), evening)[0], DATE)
        self.assertEqual(kit.feed_today(evening), "2026-10-15")

    def test_the_day_before(self):
        self.assertEqual(kit.day_before(lambda d: {"d": d}, DATE), {"d": "2026-10-13"})
        with patch.object(kit, "_log"):
            self.assertEqual(kit.day_before(MagicMock(side_effect=RuntimeError("down")), DATE), {})


if __name__ == "__main__":
    unittest.main()
