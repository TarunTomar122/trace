import argparse
import json
import unittest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from PIL import Image

from v3.flows import post_instagram as ig
from v3.lib.instagram_slides import PALETTES, SlideStory, render_carousel


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

    def test_two_ai_then_markets_startups_design(self):
        topics = [topic(1, "tech"), topic(2, "ai"), topic(3, "markets"), topic(4, "ai"),
                  topic(5, "startups"), topic(6, "ux-design"), topic(7, "ai"), topic(8, "markets")]
        picked = self.pick(topics)
        self.assertEqual([p["topic"]["id"] for p in picked], ["tt_2", "tt_4", "tt_3", "tt_5", "tt_6"])
        # One kicker per lane, like the brief: the second AI story has none.
        self.assertEqual([p["kicker"] for p in picked],
                         ["Top in AI", "", "Top in Markets", "Top in Startups", "Top in Design"])

    def test_a_lane_with_nothing_new_is_filled_from_the_rest(self):
        topics = [topic(1, "tech"), topic(2, "ai"), topic(3, "ux-design"), topic(4, "markets"), topic(5, "ai")]
        picked = self.pick(topics)
        self.assertEqual([p["topic"]["id"] for p in picked], ["tt_2", "tt_5", "tt_4", "tt_3", "tt_1"])
        self.assertEqual(picked[-1]["kicker"], "Top in Tech")

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
        self.assertEqual(picked[0]["kicker"], "Top in Tech")

    def test_event_ticket_promos_are_never_posted(self):
        promo = topic(5, "startups", title="Final chance for ticket savings at Disrupt 2026")
        picked = self.pick([topic(2, "ai"), promo, topic(8, "startups")])
        self.assertEqual([p["topic"]["id"] for p in picked], ["tt_2", "tt_8"])

    def test_failed_posts_do_not_block_their_stories(self):
        store = FakeStore()
        now = datetime(2026, 10, 13, 9, 0, tzinfo=timezone.utc)
        store.db.collection(ig.COLLECTION).document("2026-10-13-am").set({"date": "2026-10-13", "status": "failed", "topic_ids": ["tt_1"]})
        store.db.collection(ig.COLLECTION).document("2026-10-12-pm").set({"date": "2026-10-12", "status": "sent", "topic_ids": ["tt_2"]})
        self.assertEqual([p["topic_ids"] for p in ig.recent_posts(store, now)], [["tt_2"]])


class CopyTests(unittest.TestCase):
    def stories(self):
        with patch.object(ig, "fetch_image", side_effect=picture):
            return ig.pick_stories([topic(1, "ai"), topic(2, "markets"), topic(3, "startups")], [], 5)

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
        self.assertEqual(tags[-1], "#trace")
        self.assertEqual(len(tags), len(set(tags)))


class RenderTests(unittest.TestCase):
    def test_carousel_alternates_photo_and_story_at_4x5(self):
        story = SlideStory("A headline long enough to wrap across a couple of lines on the slide", [
            "Google announced the Fitbit Edge, a tracker that sits between the Fitbit Air and the Pixel Watch.",
            "It costs $179.99 and goes on sale next week, with a special edition priced at $219.99.",
            "Battery life is up to seven days, and the battery can be replaced.",
        ], picture(""), "Top in AI")
        for palette in PALETTES:
            slides = render_carousel([story, story], palette)
            self.assertEqual(len(slides), 4)
            self.assertTrue(all(s.size == (1080, 1350) and s.mode == "RGB" for s in slides))
        # The photo slide shows the photo; the story slide is the palette background.
        self.assertNotEqual(slides[0].getpixel((540, 400)), slides[1].getpixel((540, 400)))
        self.assertEqual(slides[1].getpixel((5, 5)), PALETTES[-1].background)

    def test_very_long_story_text_still_renders(self):
        story = SlideStory("Headline", ["word " * 120, "word " * 120, "word " * 120], picture(""))
        self.assertEqual(len(render_carousel([story])), 2)


class RunTests(unittest.TestCase):
    def args(self, **overrides):
        return argparse.Namespace(**{"dry_run": False, "out": "/tmp/x", "slot": "am", "force": False, **overrides})

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


if __name__ == "__main__":
    unittest.main()
