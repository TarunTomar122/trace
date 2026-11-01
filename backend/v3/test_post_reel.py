import unittest

import json
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from unittest import mock

from v3.flows.post_reel import (
    caption_for,
    editor_pick,
    pick_reel_stories,
    reel_candidates,
    resume_stories,
    same_story,
    shortlist,
)
from v3.lib import reel_video
from v3.lib.reel_video import (
    SIGN_OFF,
    Reel,
    align,
    clean_script,
    logo_entity,
    logo_files,
    logo_mark,
    script_problems,
    usable_logo,
    voice_tempo,
    word_range,
)


def topic(i, title, lane, sources=1, **extra):
    return {
        "id": f"t{i}", "title": title, "interest_id": lane, "source_count": sources,
        "summary": f"{title} happened today. It is a real story with details.",
        "articles": [{"url": f"https://example.com/{i}", "source_name": "Example"}], **extra,
    }


def in_coverage_order(short, count):
    return list(range(min(count, len(short))))


NOW = datetime(2026, 10, 27, 14, 0, tzinfo=timezone.utc)


class PickReelStoriesTests(unittest.TestCase):
    def setUp(self):
        self.topics = [
            topic(1, "OpenAI launches a cheaper model", "ai", 5),
            topic(2, "Microsoft offers buyouts to staff", "markets", 5, popularity_score=9),
            topic(3, "Apple fixes cracking iPhone displays", "tech", 4),
            topic(4, "Cohere finds Qwen sending files", "ai", 3),
            topic(5, "Robot excavator startup raises money", "robotics", 6),
            topic(6, "Reddit forum bans AI projects", "ai", 3),
            topic(7, "Anthropic sued by music estate", "ai", 2),
        ]

    def pick(self, topics=None, posted=()):
        return [s["topic"]["id"] for s in pick_reel_stories(topics or self.topics, list(posted), NOW, choose=in_coverage_order)]

    def test_any_category_by_coverage_then_popularity(self):
        self.assertEqual(self.pick(), ["t5", "t2", "t1", "t3", "t4"])

    def test_skips_stories_a_recent_reel_used(self):
        ids = self.pick(posted=[{"topic_ids": ["t1"], "titles": ["Robot excavator startup raises money"]}])
        self.assertEqual(ids, ["t2", "t3", "t4", "t6", "t7"])

    def test_skips_turned_down_and_summaryless_stories(self):
        self.topics[4]["jev_send_worthy"] = 0
        self.topics[1]["summary"] = ""
        self.assertEqual(self.pick(), ["t1", "t3", "t4", "t6", "t7"])

    def test_only_stories_updated_in_the_last_day(self):
        self.topics[4]["last_updated_at"] = "2026-10-26T09:00:00+00:00"  # 29 hours before
        self.topics[1]["last_updated_at"] = "2026-10-26T15:30:00+00:00"  # 22.5 hours before
        self.assertEqual(self.pick(), ["t2", "t1", "t3", "t4", "t6"])

    def test_same_event_in_two_lanes_is_used_once(self):
        topics = [
            topic(1, "Microsoft Announces Major Employee Buyouts", "ai", 3),
            topic(2, "OpenAI launches a cheaper model", "ai", 5),
            topic(3, "Microsoft Targets 60,000 Employees with Buyout Offers", "markets", 6),
            topic(4, "Apple Addresses Cracking Issues in iPhone Duo Displays", "tech", 5),
            topic(5, "iFixit Teardown Reveals iPhone Duo Screen Vulnerabilities", "ux-design", 5),
            topic(6, "Apple Launches Updated iPad Mini", "tech", 4),
        ]
        # t6 is different news, but a second Apple story; one per company
        self.assertEqual(self.pick(topics), ["t3", "t2", "t4"])

    def test_same_story_keeps_different_news_from_one_company_apart(self):
        a = {"title": "OpenAI launches a cheaper model", "topic": {}}
        b = {"title": "OpenAI sued over training data", "topic": {}}
        c = {"title": "Totally different headline", "topic": {"thread_id": "x"}}
        d = {"title": "Another one", "topic": {"thread_id": "x"}}
        self.assertFalse(same_story(a, b))
        self.assertTrue(same_story(c, d))

    def test_numbers_alone_do_not_make_two_stories_the_same(self):
        a = {"title": "Microsoft cuts 60,000 jobs", "topic": {}}
        b = {"title": "Rivian adds 60,000 vans", "topic": {}}
        self.assertFalse(same_story(a, b))
        c = {"title": "Nvidia Invests $3 Billion in Meta to Enhance AI Development", "topic": {}}
        d = {"title": "Infineon to Invest €1.1 Billion in Austrian Chip Factory Expansion", "topic": {}}
        self.assertFalse(same_story(c, d))
        e = {"title": "Nvidia Invested $3 Billion in Meta AI", "topic": {}}
        f = {"title": "Infineon Invested Billions in Meta Chip Plant", "topic": {}}
        self.assertFalse(same_story(e, f))

    def test_short_company_names_are_not_mistaken_for_common_words(self):
        a = {"title": "Ford Recalls 200,000 Trucks", "topic": {}}
        b = {"title": "Ford Raises Prices on Trucks", "topic": {}}
        self.assertTrue(same_story(a, b))
        topics = [topic(1, "Ford recalls 200,000 trucks", "tech", 5), topic(2, "Ford opens a battery plant", "tech", 4)]
        topics += [topic(i, f"Company{i} news {i}", "tech", 1) for i in range(3, 8)]
        ids = [s["topic"]["id"] for s in pick_reel_stories(topics, [], NOW, choose=in_coverage_order)]
        self.assertIn("t1", ids)
        self.assertNotIn("t2", ids)

    def test_one_funding_round_in_two_headlines_is_one_story(self):
        a = {"title": "Anthropic Raises $13 Billion Series F", "topic": {}}
        b = {"title": "Anthropic Secures $13 Billion in Funding", "topic": {}}
        self.assertTrue(same_story(a, b))

    def test_a_company_and_a_common_verb_are_not_one_story(self):
        a = {"title": "Elvis Estate Files Lawsuit Against Anthropic for Copyright Infringement", "topic": {}}
        b = {"title": "Anthropic Files for Ambitious $2 Trillion IPO", "topic": {}}
        c = {"title": "Apple Launches Upgraded iPad Mini with OLED Display", "topic": {}}
        d = {"title": "Apple Addresses Cracked Display Issues in iPhone Duo", "topic": {}}
        self.assertFalse(same_story(a, b))
        self.assertFalse(same_story(c, d))

    def test_one_story_per_company_even_when_the_editor_picks_two(self):
        topics = self.topics + [topic(8, "Apple launches a new iPad", "tech", 9)]
        picked = pick_reel_stories(topics, [], NOW, choose=lambda short, n: [0, 4, 1])
        ids = [s["topic"]["id"] for s in picked]
        self.assertEqual(ids[:2], ["t8", "t5"])  # the editor chose s0, s4 (Apple again), s1
        self.assertNotIn("t3", ids)
        self.assertEqual(len(ids), 5)

    def test_a_bad_timestamp_falls_back_to_first_seen_and_none_is_kept(self):
        self.topics[4].update(last_updated_at="yesterday-ish", first_seen_at="2026-10-20T09:00:00Z")
        self.topics[1]["last_updated_at"] = None
        ids = self.pick()
        self.assertNotIn("t5", ids)
        self.assertIn("t2", ids)

    def test_the_editor_chooses_and_coverage_order_fills_gaps(self):
        short = shortlist(reel_candidates(self.topics, [], NOW))
        with mock.patch.object(reel_video, "_ask", return_value={"picks": ["s3", "S3", "s9", "bogus", 0]}) as ask:
            self.assertEqual(editor_pick(short, 5), [3, 0])
            picked = pick_reel_stories(self.topics, [], NOW)
        self.assertEqual([s["title"] for s in picked], [short[k]["title"] for k in (3, 0, 1, 2, 4)])
        prompt = ask.call_args[0][0]
        self.assertIn("s0 | robotics | 6 | Robot excavator startup raises money", prompt)
        self.assertIn("never two stories about the same company", prompt)

    def test_a_failed_editor_call_falls_back_to_coverage_order(self):
        short = shortlist(reel_candidates(self.topics, [], NOW))
        with mock.patch.object(reel_video, "_ask", side_effect=RuntimeError("timeout")):
            self.assertEqual(editor_pick(short, 5), [])
            ids = [s["topic"]["id"] for s in pick_reel_stories(self.topics, [], NOW)]
        self.assertEqual(ids, ["t5", "t2", "t1", "t3", "t4"])

    def test_too_few_stories_skip_the_editor(self):
        short = shortlist(reel_candidates(self.topics[:3], [], NOW))
        with mock.patch.object(reel_video, "_ask") as ask:
            self.assertEqual(editor_pick(short, 5), [])
        ask.assert_not_called()

    def test_a_retry_keeps_the_first_runs_stories(self):
        first = pick_reel_stories(self.topics, [], NOW, choose=in_coverage_order)
        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp) / "day"
            self.assertIs(resume_stories(first, work), first)
            later = pick_reel_stories(list(reversed(self.topics)), [], NOW, choose=lambda short, n: [4, 3, 2, 1, 0])
            resumed = resume_stories(later, work)
        self.assertEqual([s["title"] for s in resumed], [s["title"] for s in first])
        self.assertEqual([s["topic"]["id"] for s in resumed], [s["topic"]["id"] for s in first])

    def test_caption_lists_stories_in_spoken_order_and_labels_ai(self):
        picked = pick_reel_stories(self.topics, [], NOW, choose=in_coverage_order)
        script = {"hook": "Microsoft offered buyouts.", "stories": [{"n": 2}, {"n": 1}, {"n": 4}, {"n": 3}, {"n": 5}]}
        caption = caption_for(script, picked)
        self.assertTrue(caption.startswith("Microsoft offered buyouts."))
        self.assertIn("1. Microsoft offers buyouts to staff\n2. Robot excavator startup raises money", caption)
        self.assertIn("AI-generated", caption)
        self.assertIn("#technews #business #robotics #tech #ai #yourtrace", caption)


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
        self.assertLessEqual(len(first["label"]), 28)
        self.assertEqual((script["hook"], script["outro"]), ("Hi there.", SIGN_OFF))

    def test_missing_outro_and_sign_off_in_a_story_are_handled(self):
        script = {"hook": "Cohere says a model sent files.", "stories": [{"n": 1, "text": "Fine. That's Trace for today."}]}
        issues = [p["issue"] for p in script_problems(script, 1)]
        self.assertIn("the sign-off belongs only in outro", issues)

    def test_next_is_flagged_but_also_today_and_finally_are_fine(self):
        issues = [p["issue"] for p in script_problems(self.script("Next, Apple. It launched a phone."), 3)]
        self.assertIn("stories never move on with 'Next'", issues)
        for ok in ("Also today, Apple launched a phone.", "Finally, Apple launched a phone.",
                   "Apple will ship the next phone in May.", "Next year, Apple will ship a phone.",
                   "Next-generation chips ship in May.", "Next Tuesday, Apple ships a phone.",
                   "Next.js added a router."):
            issues = [p["issue"] for p in script_problems(self.script(ok), 3)]
            self.assertNotIn("stories never move on with 'Next'", issues, ok)

    def test_the_current_logo_comes_first(self):
        def claim(name, rank="normal", start="", ended=False):
            q = {"P580": [{"datavalue": {"value": {"time": start}}}]} if start else {}
            if ended:
                q["P582"] = [{}]
            return {"rank": rank, "mainsnak": {"datavalue": {"value": name}}, "qualifiers": q}
        files = logo_files([claim("Microsoft logo (1980).svg", start="+1980"), claim("old.svg", ended=True),
                            claim("Microsoft logo (2012).svg", rank="preferred"), claim("x.svg", rank="deprecated")])
        self.assertEqual(files, ["Microsoft logo (2012).svg", "Microsoft logo (1980).svg", "old.svg"])

    def test_a_logo_comes_only_from_an_entry_that_is_that_company(self):
        hits = [{"id": "Q2115", "label": "XML", "description": "markup language by the W3C"},
                {"id": "Q918", "label": "X", "description": "American social networking service"},
                {"id": "Q9219", "label": "United States Military Academy", "description": "federal service academy"},
                {"id": "Q296782", "label": "Arm Holdings", "description": "British multinational semiconductor company"},
                {"id": "Q89", "label": "apple", "description": "edible fruit of the apple tree"}]
        self.assertEqual(logo_entity("X", hits), ["Q918"])
        self.assertEqual(logo_entity("Arm", hits), ["Q296782"])
        self.assertEqual(logo_entity("Apple", hits), [])

    def test_logo_marks_turn_plain_parts_white_and_keep_colour(self):
        from PIL import Image

        im = Image.new("RGBA", (4, 1), (0, 0, 0, 0))
        for x, colour in enumerate([(0, 0, 0, 255), (118, 185, 0, 255), (120, 120, 120, 255), (0, 0, 0, 0)]):
            im.putpixel((x, 0), colour)
        out = logo_mark(im)
        self.assertEqual(out.getpixel((0, 0)), (245, 245, 245, 255))  # black text -> white
        self.assertEqual(out.getpixel((1, 0))[:3], (118, 185, 0))  # Nvidia green stays
        self.assertEqual(out.getpixel((3, 0))[3], 0)  # transparent stays transparent

    def test_app_icons_and_logos_without_transparency_are_not_used(self):
        from PIL import Image, ImageDraw

        slab = Image.new("RGBA", (100, 100), (0, 0, 0, 0))
        ImageDraw.Draw(slab).rounded_rectangle((0, 0, 99, 99), 12, fill=(20, 20, 20, 255))
        self.assertIsNone(usable_logo(slab))  # a dark block would become a white slab
        badge = Image.new("RGBA", (100, 100), (0, 0, 0, 0))
        ImageDraw.Draw(badge).ellipse((0, 0, 99, 99), fill=(40, 160, 220, 255))
        self.assertIsNotNone(usable_logo(badge))  # a coloured badge keeps its colour
        self.assertIsNone(usable_logo(Image.new("RGBA", (100, 40), (255, 255, 255, 255))))
        word = Image.new("RGBA", (200, 80), (0, 0, 0, 0))
        ImageDraw.Draw(word).rectangle((20, 20, 60, 60), fill=(0, 0, 0, 255))
        ImageDraw.Draw(word).rectangle((100, 20, 140, 60), fill=(0, 0, 0, 255))
        self.assertEqual(usable_logo(word).size, (121, 41))

    def test_the_voice_is_only_sped_up_when_long_and_never_much(self):
        self.assertEqual(voice_tempo(46.0), 1.0)
        self.assertAlmostEqual(voice_tempo(55.0), 55.0 / 52.0)
        self.assertEqual(voice_tempo(70.0), 1.12)

    def test_slashes_and_handles_are_flagged_for_the_voice(self):
        issues = [p["issue"] for p in script_problems(self.script("Reddit's r/opensource banned AI."), 3)]
        self.assertIn("banned word or voice punctuation", issues)



class ReelLayoutTests(unittest.TestCase):
    """The headline-frame render plan, on a small made-up reel."""

    def setUp(self):
        from PIL import Image

        self.tmp = tempfile.TemporaryDirectory()
        folder = Path(self.tmp.name)
        for n in (1, 2):
            for kind in ("hero", "detail"):
                Image.new("RGB", (96, 168), (40 * n, 60, 90)).save(folder / f"picture-{n}-{kind}.png")
        self.script = clean_script({
            "hook": "Apple cut the price of its phone.",
            "stories": [
                {"n": 2, "label": "Phone price", "text": "It ships on Friday in 30 countries. Apple says stores will get it first. The phone now costs $699.",
                 "receipt_phrase": "price", "stat": {"value": 699, "prefix": "$", "word": "$699", "label": "new price"}},
                {"n": 1, "label": "Chip plant", "company": "Infineon", "text": "Infineon will build a chip plant in Austria. "
                 "The plant opens in 2028 and will employ about 500 people."},
            ],
            "outro": SIGN_OFF,
        })
        words, t = [], 0.0
        for seg, text in [("hook", self.script["hook"])] + [(f"s{i}", st["text"]) for i, st in enumerate(self.script["stories"])] \
                + [("outro", self.script["outro"])]:
            for w in text.split():
                words.append({"w": w, "seg": seg, "s": t, "e": t + 0.3})
                t += 0.38 + (0.25 if w.endswith(".") else 0)
        self.timings = {"duration": t + 0.3, "words": words}
        stories = [{"title": "Infineon to build an Austrian chip plant", "source": "Reuters"},
                   {"title": "Apple cuts the price of the iPhone", "source": "The Verge"}]
        self.reel = Reel(self.script, stories, self.timings, folder, "Oct 27")

    def tearDown(self):
        self.tmp.cleanup()

    def test_each_story_opens_on_its_logo_card_and_no_picture_twice_in_a_row(self):
        shots = self.reel.shots
        self.assertEqual((shots[0]["kind"], shots[0]["t0"]), ("logo", 0.0))
        self.assertEqual([s["n"] for s in shots if s["kind"] == "logo"], [2, 1])
        self.assertEqual(shots[-1]["kind"], "end")
        self.assertGreater(shots[-1]["t1"], self.reel.dur)
        for a, b in zip(shots, shots[1:]):
            self.assertAlmostEqual(a["t1"], b["t0"], places=6)
            self.assertFalse(a["kind"] == b["kind"] and a["n"] == b["n"], (a, b))
        for n in (1, 2):
            self.assertIn("receipt", [s["kind"] for s in shots if s["n"] == n and s["kind"] != "end"])
        self.assertIn("stat", [s["kind"] for s in shots if s["n"] == 2])

    def test_an_early_number_gets_its_card_before_the_source_card(self):
        self.script["stories"][0]["text"] = ("The phone now costs $699. It ships on Friday in 30 countries. "
                                             "Apple says stores will get it first.")
        folder = Path(self.tmp.name)
        words, t = [], 0.0
        for seg, text in [("hook", self.script["hook"])] + [(f"s{i}", st["text"]) for i, st in enumerate(self.script["stories"])] \
                + [("outro", self.script["outro"])]:
            for w in text.split():
                words.append({"w": w, "seg": seg, "s": t, "e": t + 0.3})
                t += 0.38 + (0.25 if w.endswith(".") else 0)
        reel = Reel(self.script, [{"title": "Infineon builds a plant", "source": "Reuters"},
                                  {"title": "Apple cuts the iPhone price", "source": "The Verge"}],
                    {"duration": t + 0.3, "words": words}, folder, "Oct 27")
        kinds = [s["kind"] for s in reel.shots if s["n"] == 2 and s["kind"] != "end"]
        self.assertLess(kinds.index("stat"), kinds.index("receipt"))

    def test_random_reels_always_plan_cleanly(self):
        import random

        folder = Path(self.tmp.name)
        for seed in range(40):
            rnd = random.Random(seed)
            count = rnd.randint(1, 2)
            script = {"hook": " ".join(["Apple"] + ["word"] * rnd.randint(4, 14)) + ".", "outro": SIGN_OFF, "stories": []}
            for i in range(count):
                n = (2, 1)[i]
                sentences = [" ".join(["w"] * rnd.randint(3, 12)) + "." for _ in range(rnd.randint(1, 4))]
                if rnd.random() < 0.6:
                    k = rnd.randrange(len(sentences))
                    sentences[k] = sentences[k][:-1] + " $699."
                script["stories"].append({"n": n, "label": "L", "company": "", "text": " ".join(sentences),
                                          "receipt_phrase": "w", "stat": {"value": 699, "prefix": "$", "word": "$699"}})
            script = clean_script(script)
            words, t = [], 0.0
            segs = [("hook", script["hook"])] + [(f"s{i}", st["text"]) for i, st in enumerate(script["stories"])]
            for seg, text in segs + [("outro", script["outro"])]:
                for w in text.split():
                    length = rnd.uniform(0.12, 0.5)
                    words.append({"w": w, "seg": seg, "s": t, "e": t + length})
                    t += length + (rnd.uniform(0.0, 0.9) if w.endswith(".") else rnd.uniform(0.0, 0.08))
            reel = Reel(script, [{"title": "A b c", "source": "S"}, {"title": "D e f", "source": "T"}],
                        {"duration": t, "words": words}, folder, "Oct 27")
            shots = reel.shots
            self.assertEqual(shots[0]["t0"], 0.0, seed)
            self.assertEqual(shots[-1]["kind"], "end", seed)
            self.assertGreaterEqual(shots[-1]["t1"] - shots[-1]["t0"], 1.0, seed)
            self.assertGreaterEqual(shots[-1]["t0"], max(w["e"] for w in words if w["seg"] != "outro") - 1e-6, seed)
            for a, b in zip(shots, shots[1:]):
                self.assertAlmostEqual(a["t1"], b["t0"], places=6, msg=seed)
                self.assertGreater(a["t1"] - a["t0"], 0.0, seed)
                self.assertFalse(a["kind"] == b["kind"] and a["n"] == b["n"], (seed, a, b))
            self.assertGreater(reel.dur, shots[-1]["t0"], seed)

    def test_frames_render_at_full_size_with_short_subtitles(self):
        for t in (0.0, 2.5, self.reel.dur - 0.1):
            self.assertEqual(self.reel.frame(t).size, (1080, 1920))
        self.assertTrue(all(len(g) <= 6 for g in self.reel.groups))

    def test_a_story_without_a_logo_shows_its_company_name(self):
        mark = self.reel.logos[1]  # no logo-1.png in the folder
        self.assertGreater(mark.width, 300)
        self.assertEqual(clean_script({"stories": [{"n": 1, "company": "  Infineon \n"}]})["stories"][0]["company"], "Infineon")

if __name__ == "__main__":
    unittest.main()
