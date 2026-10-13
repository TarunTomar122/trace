#!/usr/bin/env python3

from __future__ import annotations

import unittest
from unittest.mock import patch

from v3.lib.story_headlines import (
    _normalize_llm_headlines,
    build_headlines,
    headline_grounded,
    pack_headlines,
)


def topic(tid: str, title: str, **extra):
    row = {"id": tid, "title": title, "summary": extra.get("summary", "")}
    row.update(extra)
    return row


class StoryHeadlinesTests(unittest.TestCase):
    def test_packs_real_storylines_only(self) -> None:
        packed = pack_headlines([
            topic("a", "OpenAI publishes new model safety evals"),
            topic("b", "Hugging Face ships a safety eval suite for jailbreaks"),
            topic("c", "Apple Plans AI-Focused Enterprise Server"),
            topic("d", "TSMC raises prices on advanced chips"),
            topic("e", "Nvidia delays a data-center GPU"),
        ])
        ids = {tuple(row["topic_ids"]) for row in packed}
        self.assertIn(("a", "b"), ids)
        self.assertFalse(any("c" in row["topic_ids"] for row in packed))
        self.assertFalse(any(set(row["topic_ids"]) >= {"d", "e"} for row in packed))

    def test_unrelated_apple_news_is_not_a_headline(self) -> None:
        packed = pack_headlines([
            topic("a", "Apple Plans AI-Focused Enterprise Server"),
            topic("b", "Apple Unveils iOS 27.2 Beta with Major Updates"),
            topic("c", "Apple Unveils Photo Verification Feature for iPhone 18 Pro"),
        ])
        self.assertEqual(packed, [])

    def test_new_storyline_does_not_need_a_catalog(self) -> None:
        packed = pack_headlines([
            topic("a", "Helios lab demonstrates room-temperature quantum encryption"),
            topic("b", "Researchers intercept a quantum encryption key over fiber"),
            topic("c", "A bakery in Lisbon starts accepting lightning payments"),
        ])
        self.assertEqual(len(packed), 1)
        self.assertEqual(packed[0]["topic_ids"], ["a", "b"])
        self.assertRegex(packed[0]["label"].lower(), r"quantum|encryption")

    def test_llm_costume_without_title_support_is_dropped(self) -> None:
        raw = {
            "headlines": [
                {"label": "Chip supply", "topic_ids": ["a", "b", "c"]},
                {"label": "Collaborative Streamlines", "story_ids": ["d", "e"]},
                {"label": "Also today.", "topic_ids": ["a", "d"]},
            ]
        }
        titles = {
            "a": "Apple Plans AI-Focused Enterprise Server",
            "b": "Apple Unveils iOS 27.2 Beta with Major Updates",
            "c": "Apple Unveils Photo Verification Feature for iPhone 18 Pro",
            "d": "Anthropic Enhances Claude with Integrated Cowork Features",
            "e": "Meta's New Smart Glasses Will Lack Cameras",
        }
        self.assertEqual(_normalize_llm_headlines(raw, list(titles), titles), [])

    def test_steve_jobs_is_not_a_jobs_headline(self) -> None:
        packed = pack_headlines([
            topic("a", "Apple honors Steve Jobs with a new film"),
            topic("b", "Microsoft announces more jobs in AI"),
        ])
        self.assertEqual(packed, [])

    def test_one_shared_weak_verb_is_not_a_storyline(self) -> None:
        packed = pack_headlines([
            topic("a", "EU Proposes Social Media Ban for Children Under 13"),
            topic("b", "Oil Prices Surge Amid Supply Concerns and Potential Export Ban"),
            topic("c", "Apple Revives Server Production with AI Focus"),
            topic("d", "Boeing CEO Warns of 737 Max Production Delays"),
        ])
        self.assertEqual(packed, [])

    def test_union_grounding_is_rejected(self) -> None:
        self.assertFalse(headline_grounded("Jobs chips", [
            "Google cuts jobs in search ads",
            "TSMC raises prices on advanced chips",
        ]))

    def test_headline_grounded_costume(self) -> None:
        self.assertFalse(headline_grounded("Chip supply", [
            "Apple Plans AI-Focused Enterprise Server",
            "Apple Unveils iOS 27.2 Beta with Major Updates",
        ]))
        self.assertFalse(headline_grounded("Also today.", [
            "Google also delays Gemini rollout",
            "Apple also expands on-device Apple Intelligence",
        ]))

    def test_packed_labels_are_real_headlines(self) -> None:
        packed = pack_headlines([
            topic("a", "OpenAI publishes new model safety evals"),
            topic("b", "Hugging Face ships a safety eval suite for jailbreaks"),
        ])
        self.assertEqual(len(packed), 1)
        self.assertGreaterEqual(len(packed[0]["label"].split()), 4)
        self.assertFalse(headline_grounded("Ban", [
            "EU Proposes Social Media Ban for Children Under 13",
            "Oil Prices Surge Amid Supply Concerns and Potential Export Ban",
        ]))
        self.assertTrue(headline_grounded("Labs race to ship new model safety evals", [
            "OpenAI publishes new model safety evals",
            "Hugging Face ships a safety eval suite for jailbreaks",
        ]))

    def test_one_shared_word_is_not_a_storyline(self) -> None:
        packed = pack_headlines([
            topic("a", "OpenAI Unveils Alarming AI Model Incidents"),
            topic("b", "Warsh spooks investors, OpenAI's 'concerning' incidents, Boeing's production problems and more in Morning Squawk"),
            topic("c", "Flock Camera Hacked, Exposing Sensitive Data"),
            topic("d", "Meta Unveils Camera-Free Smart Glasses Luna Amid Privacy Concerns"),
            topic("e", "Trump Warns EU of Tariffs Over Canada Membership Plan"),
            topic("f", "Trump Calls for Interest Rate Cuts Following Fed Hike"),
        ])
        self.assertEqual(packed, [])

    def test_build_falls_back_without_openai(self) -> None:
        topics = [
            topic("a", "OpenAI publishes new model safety evals"),
            topic("b", "Anthropic expands safety evals for frontier models"),
            topic("c", "Apple chip yield"),
            topic("d", "A Lisbon bakery starts accepting lightning payments"),
        ]

        class FakeStore:
            def get_cached_synthesis(self, key):
                return None

            def cache_synthesis(self, key, value):
                self.saved = value

        with patch.dict("os.environ", {"OPENAI_API_KEY": ""}, clear=False):
            packed = build_headlines(FakeStore(), topics)
        self.assertTrue(any(set(row["topic_ids"]) >= {"a", "b"} for row in packed))


if __name__ == "__main__":
    unittest.main()
