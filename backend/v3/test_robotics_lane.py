#!/usr/bin/env python3
"""Robotics replaces engineering as a lane: classification, floors, and the
thin-lane fold that keeps a one-story Robotics tab or email section away."""

from __future__ import annotations

import os
import unittest
from unittest.mock import patch

from v3.build_trending import (
    THIN_LANE_FOLD,
    _flat_lane_floors,
    _fold_thin_lanes,
    _normalize_trending_interest_id,
    _topic_lane_floors,
)
from v3.lib.summarizer import TRENDING_BRIEF, _cache_bucket, _normalize_trending_summary


def _summary(interest_id: str) -> dict:
    return {
        "interest_id": interest_id,
        "short_article": {"subtitle": "Line.", "body": "Body text.", "key_takeaways": []},
    }


def _topic(topic_id: str, lane: str, urls: list[str], send_worthy: int | None = 1) -> dict:
    return {
        "id": topic_id,
        "interest_id": lane,
        "jev_send_worthy": send_worthy,
        "articles": [{"url": url, "interest_id": lane} for url in urls],
    }


def _row(url: str, lane: str) -> dict:
    return {"url": url, "interest_id": lane}


class ClassificationTests(unittest.TestCase):
    def test_summarizer_keeps_robotics_and_retires_engineering(self) -> None:
        self.assertEqual(_normalize_trending_summary(_summary("robotics"))["interest_id"], "robotics")
        self.assertEqual(_normalize_trending_summary(_summary("robots"))["interest_id"], "robotics")
        self.assertEqual(_normalize_trending_summary(_summary("engineering"))["interest_id"], "tech")

    def test_prompt_offers_robotics_not_engineering(self) -> None:
        self.assertIn("ai, tech, startups, markets, robotics, product-design, marketing", TRENDING_BRIEF)
        self.assertNotIn("-> engineering", TRENDING_BRIEF)
        self.assertIn('"Figure raises $1B for its humanoids" -> robotics', TRENDING_BRIEF)

    def test_cached_classifications_regenerate(self) -> None:
        self.assertEqual(_cache_bucket("trending"), "trending_v14")

    def test_build_maps_cached_engineering_to_tech(self) -> None:
        self.assertEqual(_normalize_trending_interest_id("engineering"), "tech")
        self.assertEqual(_normalize_trending_interest_id("Robotics"), "robotics")
        self.assertEqual(_normalize_trending_interest_id("physical-ai"), "robotics")


class FloorTests(unittest.TestCase):
    def test_robotics_floors_default_and_env_override(self) -> None:
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("TRENDING_ROBOTICS_FLOOR", None)
            os.environ.pop("TRENDING_ROBOTICS_FLAT_FLOOR", None)
            self.assertEqual(_topic_lane_floors()["robotics"], 4)
            self.assertEqual(_flat_lane_floors()["robotics"], 2)
        with patch.dict(os.environ, {"TRENDING_ROBOTICS_FLOOR": "0", "TRENDING_ROBOTICS_FLAT_FLOOR": "5"}):
            self.assertEqual(_topic_lane_floors()["robotics"], 0)
            self.assertEqual(_flat_lane_floors()["robotics"], 5)
        # Engineering no longer reserves anything.
        self.assertNotIn("engineering", _topic_lane_floors())


class ThinLaneFoldTests(unittest.TestCase):
    def test_fold_target_is_ai(self) -> None:
        self.assertEqual(THIN_LANE_FOLD, {"robotics": "ai"})

    def test_two_robotics_stories_fold_into_ai(self) -> None:
        topics = [
            _topic("t1", "robotics", ["https://r/1"]),
            _topic("t2", "ai", ["https://a/1", "https://r/2"]),
        ]
        topics[1]["articles"][1]["interest_id"] = "robotics"
        rows = [_row("https://r/3", "robotics"), _row("https://a/2", "ai")]

        folded = _fold_thin_lanes(topics, rows, 3)

        self.assertEqual(folded, {"robotics": 2})
        self.assertEqual(topics[0]["interest_id"], "ai")
        self.assertEqual(topics[0]["lane_detail"], "robotics")
        self.assertEqual(topics[0]["articles"][0]["interest_id"], "ai")
        # A robotics article inside an AI topic is relabelled too.
        self.assertEqual(topics[1]["articles"][1]["interest_id"], "ai")
        self.assertEqual(topics[1]["articles"][1]["lane_detail"], "robotics")
        self.assertNotIn("lane_detail", topics[1])
        self.assertEqual(rows[0], {"url": "https://r/3", "interest_id": "ai", "lane_detail": "robotics"})
        self.assertNotIn("lane_detail", rows[1])

    def test_three_robotics_stories_keep_their_lane(self) -> None:
        topics = [_topic("t1", "robotics", ["https://r/1"]), _topic("t2", "robotics", ["https://r/2"])]
        rows = [_row("https://r/3", "robotics")]

        self.assertEqual(_fold_thin_lanes(topics, rows, 3), {})
        self.assertEqual({t["interest_id"] for t in topics}, {"robotics"})
        self.assertEqual(rows[0]["interest_id"], "robotics")

    def test_only_stories_a_reader_sees_count(self) -> None:
        # The Jev-rejected topic and the flat row that repeats a topic's own
        # article are not separate stories, so two robotics topics (one
        # rejected) plus that row is one story: below the minimum.
        topics = [
            _topic("t1", "robotics", ["https://r/1"]),
            _topic("t2", "robotics", ["https://r/2"], send_worthy=0),
        ]
        rows = [_row("https://r/1", "robotics")]

        self.assertEqual(_fold_thin_lanes(topics, rows, 2), {"robotics": 1})
        self.assertEqual({t["interest_id"] for t in topics}, {"ai"})

    def test_unjudged_topics_count_like_kept_ones(self) -> None:
        # No verdict (None) is shown to readers, so it counts; only 0 does not.
        topics = [_topic(f"t{i}", "robotics", [f"https://r/{i}"], send_worthy=None) for i in range(3)]
        self.assertEqual(_fold_thin_lanes(topics, [], 3), {})
        self.assertEqual({t["interest_id"] for t in topics}, {"robotics"})

    def test_no_robotics_or_zero_minimum_does_nothing(self) -> None:
        topics = [_topic("t1", "ai", ["https://a/1"])]
        self.assertEqual(_fold_thin_lanes(topics, [], 3), {})
        robotics = [_topic("t1", "robotics", ["https://r/1"])]
        self.assertEqual(_fold_thin_lanes(robotics, [], 0), {})
        self.assertEqual(robotics[0]["interest_id"], "robotics")


if __name__ == "__main__":
    unittest.main()
