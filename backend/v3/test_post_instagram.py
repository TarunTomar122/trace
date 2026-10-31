import argparse
import json
import unittest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from PIL import Image

from v3.flows import post_instagram as ig
from v3.lib.instagram_slides import THEMES, Cover, SlideStory, render_carousel, theme_for


class FakeDoc:
    def __init__(self, db, collection, doc_id):
        self.db, self.collection, self.doc_id = db, collection, doc_id

    def get(self):
        data = self.db.data.get(self.collection, {}).get(self.doc_id)
        snapshot = MagicMock()
        snapshot.to_dict.return_value = dict(data) if data is not None else None
        return snapshot

    def set(self, data, merge=False):
        docs = self.db.data.setdefault(self.collection, {})
        docs[self.doc_id] = {**docs.get(self.doc_id, {}), **data} if merge else dict(data)


class FakeQuery:
    def __init__(self, rows):
        self.rows = rows

    def stream(self):
        for row in self.rows:
            snapshot = MagicMock()
            snapshot.to_dict.return_value = row
            yield snapshot


class FakeCollection:
    def __init__(self, db, name):
        self.db, self.name = db, name

    def document(self, doc_id):
        return FakeDoc(self.db, self.name, doc_id)

    def where(self, field, op, value):
        assert op == ">="
        return FakeQuery([d for d in self.db.data.get(self.name, {}).values() if d.get(field, "") >= value])


class FakeDb:
    def __init__(self):
        self.data = {}

    def collection(self, name):
        return FakeCollection(self, name)


class FakeStore:
    def __init__(self, topics=None):
        self.db = FakeDb()
        self.topics = topics or []

    def load_global_feed(self, date):
        return {"trending_topics": self.topics}


TITLES = [
    "",
    "Google launches the Fitbit Edge tracker",
    "Meta unveils Muse Wonder models",
    "Cyberattack hits French supermarket fridges",
    "AMD shows Helion racks for data centers",
    "Nobel economics prize goes to Hall and Woodford",
    "No Man's Sky lands on iPhone this month",
    "Apple plans a smart home hub with an A18 chip",
    "Starbucks denies a Chipotle takeover rumour",
    "Microsoft wants stricter rules for AI labs",
]


def topic(i, lane="tech", **extra):
    return {
        "id": f"tt_{i}",
        "title": TITLES[i],
        "summary": f"Company {i} shipped a product. It costs ${i}0. Reviews are in.",
        "key_points": [f"Point one about {i}.", f"Point two about {i}.", f"Point three about {i}."],
        "thumbnail": f"https://img.example/{i}.jpg",
        "interest_id": lane,
        "articles": [{"url": f"https://news.example/story-{i}?utm=x"}],
        **extra,
    }


def picture(_url):
    return Image.new("RGB", (1200, 800), (40, 90, 160))


class SlotTests(unittest.TestCase):
    def test_slots_follow_uk_time_through_bst_and_gmt(self):
        self.assertEqual(ig.slot_for(datetime(2026, 10, 13, 8, 0, tzinfo=timezone.utc)), ("2026-10-13", "am"))
        self.assertEqual(ig.slot_for(datetime(2026, 10, 13, 19, 0, tzinfo=timezone.utc)), ("2026-10-13", "pm"))
        # After the clocks go back, 20:00 UK is 20:00 UTC.
        self.assertEqual(ig.slot_for(datetime(2026, 11, 2, 20, 0, tzinfo=timezone.utc)), ("2026-11-02", "pm"))


class PickTests(unittest.TestCase):
    def pick(self, topics, posted=(), limit=5):
        with patch.object(ig, "fetch_image", side_effect=picture):
            return ig.pick_stories(topics, list(posted), limit)

    def test_ai_robotics_ai_startups_markets(self):
        topics = [topic(1, "tech"), topic(2, "ai"), topic(3, "markets"), topic(4, "ai"),
                  topic(5, "startups"), topic(6, "robotics"), topic(7, "ai"), topic(8, "markets")]
        picked = self.pick(topics)
        self.assertEqual([p["topic"]["id"] for p in picked], ["tt_2", "tt_6", "tt_4", "tt_5", "tt_3"])
        # One kicker per lane, like the brief: the second AI story has none.
        self.assertEqual([p["kicker"] for p in picked],
                         ["Top in AI", "Top in Robotics", "", "Top in Startups", "Top in Markets"])

    def test_a_four_story_post_leaves_markets_to_fill_gaps(self):
        topics = [topic(2, "ai"), topic(3, "markets"), topic(4, "ai"), topic(5, "startups"), topic(6, "robotics")]
        picked = self.pick(topics, limit=4)
        self.assertEqual([p["topic"]["id"] for p in picked], ["tt_2", "tt_6", "tt_4", "tt_5"])

    def test_a_lane_with_nothing_new_is_filled_from_the_rest(self):
        topics = [topic(1, "tech"), topic(2, "ai"), topic(3, "ux-design"), topic(4, "markets"), topic(5, "ai")]
        picked = self.pick(topics)
        self.assertEqual([p["topic"]["id"] for p in picked], ["tt_2", "tt_5", "tt_4", "tt_1", "tt_3"])
        # Gap fillers carry no kicker: tt_1 isn't the top of any lane the post covers.
        self.assertEqual([p["kicker"] for p in picked], ["Top in AI", "", "Top in Markets", "", ""])

    def test_a_story_without_an_image_gives_way_to_the_next_in_its_lane(self):
        topics = [topic(2, "ai", thumbnail="", articles=[]), topic(4, "ai"), topic(7, "ai"), topic(3, "markets")]
        picked = self.pick(topics, limit=3)
        self.assertEqual([p["topic"]["id"] for p in picked], ["tt_4", "tt_7", "tt_3"])

    def test_skips_posted_rejected_textless_and_imageless_stories(self):
        posted = [{"topic_ids": ["tt_1"], "url_keys": ["news.example/story-2"], "titles": ["Cyberattack hits French supermarket fridges!"]}]
        topics = [
            topic(1), topic(2), topic(3),
            topic(4, jev_send_worthy=0),
            topic(5, summary="", key_points=[]),
            topic(6, thumbnail="", articles=[]),
            topic(7),
        ]
        picked = self.pick(topics, posted)
        self.assertEqual([p["topic"]["id"] for p in picked], ["tt_7"])

    def test_event_ticket_promos_are_never_posted(self):
        promo = topic(5, "startups", title="Final chance for ticket savings at Disrupt 2026")
        picked = self.pick([topic(2, "ai"), promo, topic(8, "startups")])
        self.assertEqual([p["topic"]["id"] for p in picked], ["tt_2", "tt_8"])

    def test_stories_the_slide_cannot_show_are_skipped(self):
        chinese = topic(2, "ai", summary="华为发布了新的芯片。")
        too_long = topic(4, "ai", summary=" ".join(["word"] * 260) + ".")
        emoji = topic(7, "ai", title="AI agents take off 🚀")
        picked = self.pick([chinese, too_long, emoji])
        self.assertEqual([p["topic"]["id"] for p in picked], ["tt_7"])
        self.assertEqual(picked[0]["title"], "AI agents take off")

    def test_failed_posts_do_not_block_their_stories(self):
        store = FakeStore()
        now = datetime(2026, 10, 13, 9, 0, tzinfo=timezone.utc)
        store.db.collection(ig.COLLECTION).document("2026-10-13-am").set({"date": "2026-10-13", "status": "failed", "topic_ids": ["tt_1"]})
        store.db.collection(ig.COLLECTION).document("2026-10-12-pm").set({"date": "2026-10-12", "status": "sent", "topic_ids": ["tt_2"]})
        store.db.collection(ig.COLLECTION).document("2026-10-12-am").set({"date": "2026-10-12", "status": "needs_approval", "topic_ids": ["tt_3"]})
        store.db.collection(ig.COLLECTION).document("2026-10-11-pm").set({"date": "2026-10-11", "status": "error", "topic_ids": ["tt_4"]})
        self.assertEqual(sorted(i for p in ig.recent_posts(store, now) for i in p["topic_ids"]), ["tt_2", "tt_3"])

    def test_similar_titles(self):
        self.assertTrue(ig._similar("Cyberattack hits French supermarket fridges", "Cyberattack hits French supermarket fridges!"))
        self.assertTrue(ig._similar("Hackers heat French supermarket fridges to 50C", "French supermarket fridges hit 50C after hackers strike"))
        self.assertFalse(ig._similar("Apple launches iPhone 17 Pro", "Apple launches iPad Pro M5"))
        self.assertFalse(ig._similar("Google unveils Gemini 3", "Google unveils Pixel 10"))


class CopyTests(unittest.TestCase):
    def stories(self):
        with patch.object(ig, "fetch_image", side_effect=picture):
            return ig.pick_stories([topic(1, "ai"), topic(2, "startups"), topic(3, "markets")], [], 5)

    def test_story_text_is_the_feed_summary_in_paragraphs(self):
        stories = self.stories()
        self.assertEqual(stories[0]["paragraphs"], ["Company 1 shipped a product. It costs $10. Reviews are in."])
        long = topic(4, "ai", summary=" ".join(f"Sentence number {n} adds one more detail to the story." for n in range(12)))
        with patch.object(ig, "fetch_image", side_effect=picture):
            [story] = ig.pick_stories([long], [], 5)
        self.assertEqual(len(story["paragraphs"]), 3)
        self.assertTrue(all(p.endswith(".") for p in story["paragraphs"]))

    def test_model_failure_keeps_feed_titles(self):
        stories = self.stories()
        with patch("openai.OpenAI", side_effect=RuntimeError("no key")):
            hook = ig.write_copy(stories)
        self.assertEqual(hook, "")
        self.assertEqual([s["headline"] for s in stories], [TITLES[1], TITLES[2], TITLES[3]])

    def test_model_headline_is_used_when_it_passes_checks(self):
        stories = self.stories()
        paragraphs = [s["paragraphs"] for s in stories]
        reply = MagicMock()
        reply.choices = [MagicMock()]
        reply.choices[0].message.content = json.dumps({
            "hook": "Three launches worth knowing",
            "stories": [
                {"index": 0, "headline": "Company 1's product costs $10."},
                {"index": 1, "headline": "x " * 30},
                {"index": 7, "headline": "Out of range"},
            ],
        })
        client = MagicMock()
        client.chat.completions.create.return_value = reply
        with patch("openai.OpenAI", return_value=client):
            hook = ig.write_copy(stories)
        self.assertEqual(hook, "Three launches worth knowing")
        self.assertEqual(stories[0]["headline"], "Company 1's product costs $10")
        # Too long: the feed's own title stays.
        self.assertEqual(stories[1]["headline"], TITLES[2])
        # The story text is never rewritten.
        self.assertEqual([s["paragraphs"] for s in stories], paragraphs)

    def test_caption_lists_headlines_link_and_tags(self):
        stories = self.stories()
        for story in stories:
            story["headline"] = story["title"]
        caption = ig.caption_for(stories, "Hook line")
        self.assertTrue(caption.startswith(f"Hook line\n\n1. {TITLES[1]}"))
        self.assertIn(f"3. {TITLES[3]}", caption)
        self.assertIn("yourtrace.online", caption)
        tags = caption.splitlines()[-1].split()
        self.assertEqual(tags[0], "#technews")
        self.assertEqual(tags[-1], "#yourtrace")
        self.assertEqual(len(tags), len(set(tags)))


class RenderTests(unittest.TestCase):
    STORY = SlideStory("A headline long enough to wrap across a couple of lines on the slide", [
        "Google announced the Fitbit Edge, a tracker that sits between the Fitbit Air and the Pixel Watch.",
        "It costs $179.99 and goes on sale next week, with a special edition priced at $219.99.",
        "Battery life is up to seven days, and the battery can be replaced.",
    ], picture(""), "Top in AI", "The Verge", 4)

    def test_a_cover_then_photo_and_story_for_each_at_4x5(self):
        cover = Cover("Tuesday, October 20", "morning", ["First headline", "Second headline"])
        for theme in THEMES:
            slides = render_carousel([self.STORY, self.STORY], theme, cover)
            self.assertEqual(len(slides), 5)
            self.assertTrue(all(s.size == (1080, 1350) and s.mode == "RGB" for s in slides))
            # One theme for the whole post: every slide sits on its background...
            for slide in slides:
                self.assertEqual(slide.getpixel((5, 5)), theme.background)
            # ...and the photo slide shows the photo under the headline.
            self.assertEqual(slides[1].getpixel((540, 1150)), (40, 90, 160))
            self.assertNotEqual(slides[2].getpixel((540, 1150)), (40, 90, 160))

    def test_without_a_cover_two_slides_per_story(self):
        self.assertEqual(len(render_carousel([self.STORY])), 2)

    def test_evening_posts_are_dark_and_mornings_rotate_the_light_themes(self):
        self.assertTrue(theme_for("2026-10-20", "pm").dark)
        mornings = {theme_for(f"2026-10-{day}", "am").name for day in (20, 21, 22)}
        self.assertEqual(len(mornings), 3)
        self.assertFalse(any(theme_for(f"2026-10-{day}", "am").dark for day in (20, 21, 22)))

    def test_very_long_story_text_still_renders(self):
        story = SlideStory("Headline", ["word " * 120, "word " * 120, "word " * 120], picture(""))
        self.assertEqual(len(render_carousel([story])), 2)

    def test_a_very_long_headline_still_leaves_room_for_the_photo(self):
        story = SlideStory("A very long headline " * 6, ["One short paragraph."], picture(""), "Top in AI")
        photo = render_carousel([story])[0]
        self.assertEqual(photo.getpixel((540, 1150)), (40, 90, 160))


class RunTests(unittest.TestCase):
    def args(self, **overrides):
        return argparse.Namespace(**{"dry_run": False, "out": "/tmp/x", "slot": "am", "force": False,
                                     "tiktok_only": False, **overrides})

    def test_a_slot_that_already_posted_is_skipped(self):
        store = FakeStore([topic(i) for i in range(1, 6)])
        now_date, _ = ig.slot_for(datetime.now(timezone.utc))
        store.db.collection(ig.COLLECTION).document(f"{now_date}-am").set({"status": "sent"})
        with patch.object(ig, "V3Store", return_value=store), patch.object(ig, "share_now") as share:
            self.assertEqual(ig.run(self.args()), 0)
        share.assert_not_called()

    def test_too_few_stories_does_not_post(self):
        store = FakeStore([topic(1), topic(2)])
        with patch.object(ig, "V3Store", return_value=store), patch.object(ig, "fetch_image", side_effect=picture), \
                patch.object(ig, "share_now") as share:
            self.assertEqual(ig.run(self.args()), 1)
        share.assert_not_called()


class BufferTests(unittest.TestCase):
    def share(self, data, errors=()):
        with patch.object(ig, "buffer", return_value=(data, list(errors))):
            return ig.share_now("chan", "caption", ["https://x/1.jpg", "https://x/2.jpg"])

    def test_a_post_id_wins_even_with_warnings(self):
        self.assertEqual(self.share({"createPost": {"__typename": "PostActionSuccess", "post": {"id": "p1"}}},
                                    [{"message": "warning"}]), "p1")

    def test_clear_refusals_are_safe_to_retry(self):
        with self.assertRaises(ig.BufferRefused):
            self.share({"createPost": {"__typename": "InvalidInputError", "message": "bad"}})
        with self.assertRaises(ig.BufferRefused):
            self.share({"createPost": None}, [{"message": "slow down", "extensions": {"code": "RATE_LIMIT_EXCEEDED"}}])

    def test_unclear_failures_are_not_refusals(self):
        for data, errors in [
            ({"createPost": {"__typename": "UnexpectedError", "message": "oops"}}, []),
            ({"createPost": None}, [{"message": "server", "extensions": {"code": "UNEXPECTED"}}]),
            ({"createPost": None}, [{"message": "no code"}]),
            ({}, []),
        ]:
            with self.assertRaises(RuntimeError) as caught:
                self.share(data, errors)
            self.assertNotIsInstance(caught.exception, ig.BufferRefused)

    def test_polling_survives_a_failed_check(self):
        states = [RuntimeError("blip"), {"status": "sending"}, {"status": "sent", "externalLink": "https://ig/p/1"}]
        with patch.object(ig, "post_state", side_effect=states), patch.object(ig.time, "sleep"):
            self.assertEqual(ig.wait_until_sent("p1")["status"], "sent")


sent = {"status": "sent", "externalLink": "https://ig/p/1"}


class RunSafetyTests(unittest.TestCase):
    def args(self, **overrides):
        return argparse.Namespace(**{"dry_run": False, "out": "/tmp/x", "slot": "am", "force": False,
                                     "tiktok_only": False, **overrides})

    def setUp(self):
        self.store = FakeStore([topic(2, "ai"), topic(4, "ai"), topic(3, "markets"), topic(5, "startups"), topic(6, "ux-design")])
        self.date, _ = ig.slot_for(datetime.now(timezone.utc))
        self.docs = self.store.db.data.setdefault(ig.COLLECTION, {})

    def run_job(self, share, tiktok=None, states=None, **kwargs):
        with patch.object(ig, "V3Store", return_value=self.store), patch.object(ig, "fetch_image", side_effect=picture), \
                patch("openai.OpenAI", side_effect=RuntimeError("offline")), patch.object(ig, "host_slides", return_value=["u"] * 10), \
                patch.object(ig, "prune_media"), patch.object(ig, "instagram_channel", return_value="chan"), \
                patch.object(ig, "tiktok_channel", return_value=tiktok), \
                patch.object(ig, "share_now", **share) as share_mock, \
                patch.object(ig, "create_post", return_value="t1") as self.tiktok_post, \
                patch.object(ig, "post_state", side_effect=lambda i: (states or {}).get(i, sent)), \
                patch.object(ig, "wait_until_sent", side_effect=lambda i, **_: (states or {}).get(i, sent)):
            return ig.run(self.args(**kwargs)), share_mock

    def test_slides_also_go_to_tiktok_when_connected(self):
        code, _ = self.run_job({"return_value": "p1"}, tiktok="tt")
        doc = self.docs[f"{self.date}-am"]
        self.assertEqual((code, doc["status"], doc["tiktok_post_id"], doc["tiktok_status"]), (0, "sent", "t1", "sent"))
        channel, _, assets, metadata = self.tiktok_post.call_args.args
        self.assertEqual((channel, assets[0], metadata["tiktok"]["isAiGenerated"]), ("tt", {"image": {"url": "u"}}, False))
        self.assertTrue(0 < len(metadata["tiktok"]["title"]) <= 90)

    def test_a_muted_tiktok_video_is_flagged(self):
        page = ('<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">'
                + json.dumps({"__DEFAULT_SCOPE__": {"webapp.video-detail": {"itemInfo": {"itemStruct": {"itemMute": True}}}}})
                + "</script>")
        link = "https://tiktok.com/@yourtrace.news/video/1"
        with patch.object(ig.requests, "get", return_value=MagicMock(text=page)):
            code, _ = self.run_job({"return_value": "p1"}, tiktok="tt", states={"t1": {"status": "sent", "externalLink": link}})
        self.assertEqual((code, self.docs[f"{self.date}-am"]["tiktok_muted"]), (0, True))

    def test_tiktok_muted_reads_the_post_page(self):
        def page(mute):
            item = {"itemMute": True} if mute else {}
            return MagicMock(text='<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">' + json.dumps(
                {"__DEFAULT_SCOPE__": {"webapp.video-detail": {"itemInfo": {"itemStruct": item}}}}) + "</script>")
        link = "https://www.tiktok.com/@yourtrace.news/video/7702827468062723335"
        with patch.object(ig.requests, "get", side_effect=[page(True), page(False)]):
            self.assertEqual((ig.tiktok_muted(link), ig.tiktok_muted(link)), (True, False))
        with patch.object(ig.requests, "get", side_effect=RuntimeError("offline")), patch.object(ig.time, "sleep"):
            self.assertIsNone(ig.tiktok_muted(link))
        self.assertIsNone(ig.tiktok_muted("https://www.instagram.com/reel/x/"))

    def test_a_tiktok_only_slot_skips_instagram(self):
        code, share = self.run_job({"return_value": "p1"}, tiktok="tt", slot="t1", tiktok_only=True)
        doc = self.docs[f"{self.date}-t1"]
        self.assertEqual((code, doc["status"], doc["channel"], doc["tiktok_post_id"]), (0, "sent", "tiktok", "t1"))
        share.assert_not_called()
        # A re-run posts nothing new.
        code, share = self.run_job({"return_value": "p1"}, tiktok="tt", slot="t1", tiktok_only=True)
        self.assertEqual(code, 0)
        share.assert_not_called()
        self.tiktok_post.assert_not_called()

    def test_a_tiktok_only_slot_retries_when_nothing_went_out(self):
        code, _ = self.run_job({"return_value": "p1"}, tiktok=None, slot="t2", tiktok_only=True)
        self.assertEqual((code, self.docs[f"{self.date}-t2"]["status"]), (1, "failed"))

    def test_tiktok_only_stories_are_not_posted_again(self):
        self.run_job({"return_value": "p1"}, tiktok="tt", slot="t1", tiktok_only=True)
        self.assertEqual(len(self.docs[f"{self.date}-t1"]["topic_ids"]), 4)
        # Only one of the five stories is left, too few for the evening carousel.
        code, share = self.run_job({"return_value": "p2"}, tiktok="tt", slot="pm")
        self.assertEqual(code, 1)
        share.assert_not_called()

    def test_no_tiktok_channel_means_instagram_only(self):
        code, _ = self.run_job({"return_value": "p1"})
        self.assertEqual(code, 0)
        self.tiktok_post.assert_not_called()
        self.assertNotIn("tiktok_status", self.docs[f"{self.date}-am"])

    def test_an_instagram_retry_does_not_post_tiktok_twice(self):
        code, _ = self.run_job({"return_value": "p1"}, tiktok="tt", states={"p1": {"status": "error"}})
        self.assertEqual(code, 1)
        self.tiktok_post.assert_called_once()
        code, share = self.run_job({"return_value": "p2"}, tiktok="tt")
        self.assertEqual(code, 0)
        share.assert_called_once()
        self.tiktok_post.assert_not_called()

    def test_a_rerun_after_instagram_only_adds_tiktok(self):
        self.run_job({"return_value": "p1"})
        self.tiktok_post.assert_not_called()
        code, share = self.run_job({"return_value": "p2"}, tiktok="tt")
        self.assertEqual(code, 0)
        share.assert_not_called()
        self.tiktok_post.assert_called_once()
        self.assertEqual(self.docs[f"{self.date}-am"]["tiktok_status"], "sent")

    def test_a_tiktok_post_that_later_failed_is_tried_again(self):
        self.run_job({"return_value": "p1"}, tiktok="tt", states={"t1": {"status": "sending"}})
        self.assertEqual(self.docs[f"{self.date}-am"]["tiktok_status"], "sending")
        self.run_job({"return_value": "p2"}, tiktok="tt")  # still on its way: left alone
        self.tiktok_post.assert_not_called()
        self.run_job({"return_value": "p2"}, tiktok="tt", states={"t1": {"status": "error"}})
        self.tiktok_post.assert_called_once()

    def test_tiktok_errors_never_escape(self):
        broken = MagicMock()
        broken.get.side_effect = RuntimeError("firestore down")
        ig.share_to_tiktok(broken, "caption", [], "title", ai_generated=False)

    def test_tiktok_captions_keep_at_most_five_hashtags(self):
        caption = "Hook #notatag\n\nBody\n\n#a #b #c #d #e #f #g #yourtrace"
        self.assertEqual(ig.tiktok_caption(caption), "Hook #notatag\n\nBody\n\n#a #b #c #d #yourtrace")
        self.assertEqual(ig.tiktok_caption("x\n#a #b"), "x\n#a #b")

    def test_a_tiktok_refusal_never_fails_the_run(self):
        with patch.object(ig, "create_post", side_effect=ig.BufferRefused("no")):
            doc = FakeDoc(self.store.db, ig.COLLECTION, "x")
            with patch.object(ig, "tiktok_channel", return_value="tt"):
                ig.share_to_tiktok(doc, "caption", [], "title", ai_generated=False)
        self.assertEqual(self.docs["x"]["tiktok_status"], "failed")

    def test_refused_post_is_marked_failed_and_retried(self):
        code, _ = self.run_job({"side_effect": ig.BufferRefused("bad input")})
        self.assertEqual((code, self.docs[f"{self.date}-am"]["status"]), (1, "failed"))
        code, share = self.run_job({"return_value": "p1"})
        self.assertEqual((code, self.docs[f"{self.date}-am"]["status"]), (0, "sent"))
        share.assert_called_once()

    def test_unclear_failure_is_never_retried(self):
        code, _ = self.run_job({"side_effect": TimeoutError("read timed out")})
        self.assertEqual((code, self.docs[f"{self.date}-am"]["status"]), (0, "unknown"))
        code, share = self.run_job({"return_value": "p1"})
        self.assertEqual(code, 0)
        share.assert_not_called()

    def test_drafts_and_approvals_count_as_posted(self):
        for status in ("draft", "needs_approval"):
            self.docs[f"{self.date}-am"] = {"date": self.date, "status": status}
            code, share = self.run_job({"return_value": "p1"})
            self.assertEqual(code, 0)
            share.assert_not_called()

    def test_a_post_still_on_its_way_is_re_read(self):
        self.docs[f"{self.date}-am"] = {"date": self.date, "status": "sending", "buffer_post_id": "p0"}
        code, share = self.run_job({"return_value": "p1"}, states={"p0": {"status": "sent", "externalLink": "https://ig/p/0"}})
        self.assertEqual(code, 0)
        share.assert_not_called()
        self.assertEqual(self.docs[f"{self.date}-am"]["external_link"], "https://ig/p/0")

    def test_force_logs_a_separate_record(self):
        live = {"date": self.date, "status": "sent", "topic_ids": ["tt_9"]}
        self.docs[f"{self.date}-am"] = dict(live)
        code, share = self.run_job({"return_value": "p1"}, force=True)
        self.assertEqual(code, 0)
        share.assert_called_once()
        self.assertEqual(self.docs[f"{self.date}-am"], live)
        self.assertEqual(len([k for k in self.docs if k.startswith(f"{self.date}-am-")]), 1)


class EnvTests(unittest.TestCase):
    def test_story_counts_parse_defensively(self):
        with patch.dict("os.environ", {"X": ""}):
            self.assertEqual(ig._env_int("X", 3, 1, 5), 3)
        with patch.dict("os.environ", {"X": "nine"}):
            self.assertEqual(ig._env_int("X", 3, 1, 5), 3)
        with patch.dict("os.environ", {"X": "12"}):
            self.assertEqual(ig._env_int("X", 5, 3, 5), 5)


if __name__ == "__main__":
    unittest.main()
