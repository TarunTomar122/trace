import unittest

import json
import tempfile
from pathlib import Path

from v3.flows.post_reel import caption_for, pick_reel_stories, resume_stories, same_story
from v3.lib.reel_video import SIGN_OFF, align, clean_script, keep_spans, remap, script_problems, word_range


def topic(i, title, lane, sources=1, **extra):
    return {
        "id": f"t{i}", "title": title, "interest_id": lane, "source_count": sources,
        "summary": f"{title} happened today. It is a real story with details.",
        "articles": [{"url": f"https://example.com/{i}", "source_name": "Example"}], **extra,
    }


class PickReelStoriesTests(unittest.TestCase):
    def setUp(self):
        self.topics = [
            topic(1, "OpenAI launches a cheaper model", "ai", 5),
            topic(2, "Microsoft offers buyouts to staff", "markets", 5),
            topic(3, "Apple fixes cracking iPhone displays", "tech", 4),
            topic(4, "Cohere finds Qwen sending files", "ai", 3),
            topic(5, "Robot excavator startup raises money", "robotics", 6),
            topic(6, "Reddit forum bans AI projects", "ai", 3),
            topic(7, "Anthropic sued by music estate", "ai", 2),
        ]

    def test_top_three_ai_in_feed_order_then_two_most_covered_others(self):
        picked = pick_reel_stories(self.topics, [])
        self.assertEqual([s["topic"]["id"] for s in picked], ["t1", "t4", "t6", "t5", "t2"])

    def test_skips_stories_a_recent_reel_used(self):
        picked = pick_reel_stories(self.topics, [{"topic_ids": ["t1"], "titles": ["Robot excavator startup raises money"]}])
        ids = [s["topic"]["id"] for s in picked]
        self.assertNotIn("t1", ids)
        self.assertNotIn("t5", ids)
        self.assertEqual(ids[:3], ["t4", "t6", "t7"])

    def test_skips_turned_down_and_summaryless_stories(self):
        self.topics[0]["jev_send_worthy"] = 0
        self.topics[3]["summary"] = ""
        ids = [s["topic"]["id"] for s in pick_reel_stories(self.topics, [])]
        self.assertEqual(ids[:3], ["t6", "t7", "t5"])

    def test_same_event_in_two_lanes_is_used_once(self):
        topics = [
            topic(1, "Microsoft Announces Major Employee Buyouts", "ai", 3),
            topic(2, "OpenAI launches a cheaper model", "ai", 5),
            topic(3, "Microsoft Targets 60,000 Employees with Buyout Offers", "markets", 6),
            topic(4, "Apple Addresses Cracking Issues in iPhone Duo Displays", "tech", 5),
            topic(5, "iFixit Teardown Reveals iPhone Duo Screen Vulnerabilities", "ux-design", 5),
            topic(6, "Apple Launches Updated iPad Mini", "tech", 4),
        ]
        ids = [s["topic"]["id"] for s in pick_reel_stories(topics, [])]
        self.assertEqual(ids, ["t1", "t2", "t4", "t6"])

    def test_same_story_keeps_different_news_from_one_company_apart(self):
        a = {"title": "OpenAI launches a cheaper model", "topic": {}}
        b = {"title": "OpenAI sued over training data", "topic": {}}
        c = {"title": "Totally different headline", "topic": {"thread_id": "x"}}
        d = {"title": "Another one", "topic": {"thread_id": "x"}}
        self.assertFalse(same_story(a, b))
        self.assertTrue(same_story(c, d))

    def test_a_thin_day_fills_up_with_the_most_covered_stories(self):
        topics = [topic(1, "OpenAI launches a cheaper model", "ai", 5),
                  topic(2, "Microsoft offers buyouts to staff", "markets", 5),
                  topic(3, "Apple fixes cracking iPhone displays", "tech", 4),
                  topic(4, "Rivian recalls delivery vans", "tech", 3),
                  topic(5, "Robot excavator startup raises money", "robotics", 6)]
        ids = [s["topic"]["id"] for s in pick_reel_stories(topics, [])]
        self.assertEqual(ids, ["t1", "t5", "t2", "t3", "t4"])

    def test_numbers_alone_do_not_make_two_stories_the_same(self):
        a = {"title": "Microsoft cuts 60,000 jobs", "topic": {}}
        b = {"title": "Rivian adds 60,000 vans", "topic": {}}
        self.assertFalse(same_story(a, b))

    def test_a_retry_keeps_the_first_runs_stories(self):
        first = pick_reel_stories(self.topics, [])
        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp) / "day"
            self.assertIs(resume_stories(first, work), first)
            later = pick_reel_stories(list(reversed(self.topics)), [])
            resumed = resume_stories(later, work)
        self.assertEqual([s["title"] for s in resumed], [s["title"] for s in first])
        self.assertEqual([s["topic"]["id"] for s in resumed], [s["topic"]["id"] for s in first])

    def test_caption_lists_stories_in_spoken_order_and_labels_ai(self):
        picked = pick_reel_stories(self.topics, [])
        script = {"hook": "Cohere says Qwen sent files.", "stories": [{"n": 2}, {"n": 1}, {"n": 4}, {"n": 3}, {"n": 5}]}
        caption = caption_for(script, picked)
        self.assertTrue(caption.startswith("Cohere says Qwen sent files."))
        self.assertIn("1. Cohere finds Qwen sending files\n2. OpenAI launches a cheaper model", caption)
        self.assertIn("AI-generated", caption)


class ReelScriptTests(unittest.TestCase):
    def script(self, text, numbers=(1, 2, 3)):
        return {"hook": "Cohere says a model sent files.", "outro": SIGN_OFF,
                "stories": [{"n": n, "text": text} for n in numbers]}

    def test_word_range_scales_with_story_count(self):
        self.assertEqual(word_range(3), (58, 70))
        self.assertEqual(word_range(5), (90, 110))

    def test_flags_missing_stories_banned_words_dashes_and_length(self):
        self.assertIn("every story", script_problems(self.script("x", (1, 1, 3)), 3)[0]["issue"])
        issues = [p["issue"] for p in script_problems(self.script("A pivotal launch — huge."), 3)]
        self.assertIn("banned word or voice punctuation", issues)
        self.assertIn("length", issues)

    def test_clean_script_of_the_right_length_passes(self):
        text = " ".join(["OpenAI launched a model today."] * 4)  # 20 words a story, 70 in all
        self.assertEqual(script_problems(self.script(text), 3), [])

    def test_align_keeps_script_spelling_and_fills_unheard_words(self):
        script = {"hook": "OpenAI launched GPT-6.1 Terra.", "stories": [], "outro": SIGN_OFF}
        heard = [{"w": "OpenAI", "s": 0.0, "e": 0.4}, {"w": "launched", "s": 0.4, "e": 0.8},
                 {"w": "GPT", "s": 0.8, "e": 1.0}, {"w": "6.1", "s": 1.0, "e": 1.3}, {"w": "Terra.", "s": 1.3, "e": 1.7},
                 {"w": "That's", "s": 2.0, "e": 2.2}, {"w": "Trace", "s": 2.2, "e": 2.4}, {"w": "for", "s": 2.4, "e": 2.5},
                 {"w": "today.", "s": 2.5, "e": 2.9}]
        words = align(script, heard)
        self.assertEqual([w["w"] for w in words][:4], ["OpenAI", "launched", "GPT-6.1", "Terra."])
        self.assertTrue(all("s" in w and w["e"] >= w["s"] for w in words))
        self.assertLess(words[2]["s"], words[3]["s"])

    def test_clean_script_makes_model_output_safe_to_render(self):
        script = clean_script({"hook": " Hi  there. ", "stories": [
            {"n": "2", "label": "A label that is far too long to fit in the tag", "text": "x", "shots": "one",
             "stat": {"value": "2x", "word": "2x"}, "stress": "big"},
            {"n": 1.0, "text": "y", "shots": ["only one"], "stat": {"value": "60,000", "prefix": "$", "word": "60,000"}},
            "not a story"]})
        first, second = script["stories"]
        self.assertEqual((first["n"], second["n"]), (2, 1))
        self.assertEqual(first["stat"], {"value": None})
        self.assertEqual(second["stat"]["value"], 60000.0)
        self.assertEqual(len(first["shots"]), 2)
        self.assertEqual(second["shots"][0], "only one")
        self.assertEqual(first["stress"], [])
        self.assertLessEqual(len(first["label"]), 28)
        self.assertEqual((script["hook"], script["outro"]), ("Hi there.", SIGN_OFF))

    def test_missing_outro_and_sign_off_in_a_story_are_handled(self):
        script = {"hook": "Cohere says a model sent files.", "stories": [{"n": 1, "text": "Fine. That's Trace for today."}]}
        issues = [p["issue"] for p in script_problems(script, 1)]
        self.assertIn("the sign-off belongs only in outro", issues)

    def test_long_pauses_are_cut_and_word_times_follow(self):
        heard = [{"w": "One.", "s": 0.0, "e": 1.0}, {"w": "Two.", "s": 2.2, "e": 3.0}, {"w": "three", "s": 3.1, "e": 3.5}]
        spans = keep_spans(heard, 4.5, pause=0.3)
        for got, want in zip(spans, [(0.0, 1.15), (2.05, 3.9)], strict=True):
            self.assertAlmostEqual(got[0], want[0])
            self.assertAlmostEqual(got[1], want[1])
        self.assertAlmostEqual(remap(2.2, spans, 1.0), 1.3)  # the 1.2s gap became 0.3s
        self.assertAlmostEqual(remap(3.1, spans, 1.0), 2.2)  # short gaps stay
        self.assertAlmostEqual(remap(2.2, spans, 1.1), 1.3 / 1.1)

    def test_slashes_and_handles_are_flagged_for_the_voice(self):
        issues = [p["issue"] for p in script_problems(self.script("Reddit's r/opensource banned AI."), 3)]
        self.assertIn("banned word or voice punctuation", issues)


if __name__ == "__main__":
    unittest.main()
