#!/usr/bin/env python3

from __future__ import annotations

import unittest
from unittest.mock import patch

from v3.flows.send_audience_newsletter import _select
from v3.flows.send_three_feed_newsletter import _candidate_stories, _pick_items


def _topic(title, url, articles, interest="ai"):
    return {
        "title": title,
        "interest_id": interest,
        "article_count": len(articles),
        "articles": [{"title": t, "url": u, "source": s} for t, u, s in articles],
    }


class NewsletterSelectionTests(unittest.TestCase):
    def test_pro_reorders_finished_sections_only(self):
        groups = [
            {"topic_id": "release", "interest_id": "ai", "model_release": True},
            {"topic_id": "ai", "interest_id": "ai", "model_release": False},
            {"topic_id": "markets", "interest_id": "markets", "model_release": False},
            {"topic_id": "tech", "interest_id": "tech", "model_release": False},
            {"topic_id": "startups", "interest_id": "startups", "model_release": False},
            {"topic_id": "engineering", "interest_id": "engineering", "model_release": False},
            {"topic_id": "product-1", "interest_id": "products", "model_release": False},
            {"topic_id": "product-2", "interest_id": "products", "model_release": False},
            {"topic_id": "world-1", "interest_id": "the-world", "model_release": False},
            {"topic_id": "world-2", "interest_id": "the-world", "model_release": False},
        ]
        for group in groups:
            group.update(send_worthy=1, source_count=1, coverage=1, macro=False)
        groups[2]["macro"] = True
        interests = [
            "ai", "markets", "startups", "tech", "ux-design", "engineering", "products", "the-world",
        ]

        with patch("v3.flows.send_audience_newsletter._story_groups", return_value=groups):
            pro = _select({}, interests, 10, "pro")
            free = _select({}, interests, 5, "free")
            landing = _select({}, [], 5, "landing")

        self.assertEqual(
            [lane for lane, _ in pro],
            [
                "model-releases", "ai", "markets", "startups", "tech",
                "engineering", "products", "the-world", "products", "the-world",
            ],
        )
        selected = [group["topic_id"] for _, stories in pro for group in stories]
        self.assertCountEqual(
            selected,
            ["release", "ai", "markets", "tech", "startups", "engineering", "product-1", "product-2", "world-1", "world-2"],
        )
        self.assertEqual(
            [lane for lane, _ in free],
            ["model-releases", "ai", "markets", "tech", "startups"],
        )
        self.assertEqual(
            [lane for lane, _ in landing],
            ["model-releases", "ai", "markets", "tech", "startups"],
        )

        design = {"topic_id": "design", "interest_id": "ux-design", "model_release": False,
                  "send_worthy": 1, "source_count": 1, "coverage": 1, "macro": False}
        with patch("v3.flows.send_audience_newsletter._story_groups", return_value=[*groups, design]):
            pro_with_design = _select({}, interests, 10, "pro")
            free_with_design = _select({}, interests, 5, "free")
            landing_with_design = _select({}, [], 5, "landing")
        lanes_with_design = [lane for lane, _ in pro_with_design]
        self.assertIn("ux-design", lanes_with_design)
        self.assertEqual(lanes_with_design[3:6], ["startups", "tech", "ux-design"])
        self.assertEqual(sum(len(stories) for _, stories in pro_with_design), 10)
        self.assertEqual(
            [lane for lane, _ in free_with_design],
            ["model-releases", "ai", "markets", "tech", "ux-design"],
        )
        self.assertEqual(
            [lane for lane, _ in landing_with_design],
            ["model-releases", "ai", "markets", "tech", "ux-design"],
        )

    def test_same_event_topics_do_not_all_make_the_email(self):
        feed = {
            "trending_topics": [
                _topic(
                    "Zuckerberg and Huang Advocate for AI Safety",
                    "https://a.com/1",
                    [("Zuckerberg says every AI lab must build safely", "https://a.com/1", "A")],
                ),
                _topic(
                    "Meta CEO Mark Zuckerberg sides with Nvidia's Huang on AI safety",
                    "https://b.com/2",
                    [("Meta CEO sides with Nvidia's Huang", "https://b.com/2", "B")],
                ),
                _topic(
                    "We don't need AI regulation, Nvidia's Jensen Huang says",
                    "https://c.com/3",
                    [("Huang says no new AI regulation", "https://c.com/3", "C")],
                ),
                _topic(
                    "EU Plans Social Media Ban for Kids Under 13",
                    "https://d.com/4",
                    [("EU social media ban", "https://d.com/4", "D")],
                ),
            ],
            "trending": [],
        }
        picked = _pick_items(feed)
        titles = [str(p.get("title")) for p in picked]
        safety = [t for t in titles if "safety" in t.lower() or "regulation" in t.lower()]
        self.assertEqual(len(safety), 1)
        self.assertTrue(any("social media ban" in t.lower() for t in titles))

    def test_flat_articles_inside_a_topic_are_not_resurfaced(self):
        feed = {
            "trending_topics": [
                _topic(
                    "OpenAI buys Glass Imaging",
                    "https://a.com/1",
                    [
                        ("OpenAI buys Glass Imaging", "https://a.com/1", "A"),
                        ("OpenAI quietly acquired Glass Imaging", "https://b.com/2", "B"),
                    ],
                    interest="startups",
                ),
            ],
            "trending": [
                {
                    "title": "OpenAI quietly acquired Glass Imaging",
                    "url": "https://b.com/2",
                    "interest_id": "startups",
                    "source": "B",
                },
            ],
        }
        candidates = _candidate_stories(feed)
        urls = [str(c.get("url")) for c in candidates]
        self.assertEqual(urls.count("https://b.com/2"), 0)
        self.assertIn("https://a.com/1", urls)


if __name__ == "__main__":
    unittest.main()
