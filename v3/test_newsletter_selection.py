#!/usr/bin/env python3

from __future__ import annotations

import unittest
from unittest.mock import patch

from v3.flows.send_audience_newsletter import _select, _story_groups
from v3.flows.send_three_feed_newsletter import _candidate_stories, _pick_items


def _topic(title, url, articles, interest="ai"):
    return {
        "title": title,
        "interest_id": interest,
        "article_count": len(articles),
        "articles": [{"title": t, "url": u, "source": s} for t, u, s in articles],
    }


class NewsletterSelectionTests(unittest.TestCase):
    def test_email_groups_paraphrased_events_without_merging_company_news(self):
        def topic(title, summary, url, interest="ai"):
            return {
                **_topic(title, url, [(title, url, "Source")], interest),
                "id": url,
                "summary": summary,
            }

        feed = {
            "trending_topics": [
                topic(
                    "OpenAI Cancels GPT-6.1 Astra Launch",
                    "OpenAI has decided to cancel the release of its new model, GPT-6.1 Astra, due to significant safety concerns. Internal testing revealed failed safety standards.",
                    "https://a.com/openai-astra",
                ),
                topic(
                    "OpenAI abandons plan to release upcoming model as safety concerns escalate",
                    "OpenAI has confirmed it will not release its upcoming GPT-6.1 Astra model, citing insufficient adherence to safety standards.",
                    "https://b.com/openai-astra",
                ),
                topic(
                    "GPT-6.1 Astra fails internal safety review",
                    "OpenAI has cancelled the GPT-6.1 Astra release after the model failed internal safety tests.",
                    "https://h.com/openai-astra",
                ),
                topic(
                    "Anthropic Releases Its Second New AI Model in Less Than a Week",
                    "Anthropic has launched Sonnet 5.5, a new AI model positioned as a faster and more cost-effective alternative to Opus 5.5.",
                    "https://c.com/sonnet",
                ),
                topic(
                    "OpenAI reports Australian government website breach",
                    "OpenAI disclosed unauthorized access to Australian government websites through an internal research model.",
                    "https://d.com/breach",
                ),
                topic(
                    "Rayon Raises 10 Million in Series A Funding",
                    "Paris-based Rayon raised a Series A round for its browser-based interior design software.",
                    "https://e.com/rayon",
                    "startups",
                ),
                topic(
                    "Rayon raises 10M Series A to expand interior design platform",
                    "Rayon raised a Series A round to expand its browser-based interior design software.",
                    "https://k.com/rayon",
                    "startups",
                ),
                topic(
                    "Paris-based Marble secures 6.5 million in Series A financing",
                    "Paris-based Marble raised a Series A round for its financial software platform.",
                    "https://f.com/marble",
                    "startups",
                ),
                topic(
                    "Apple launches iOS 27",
                    "Apple announced a software update with security improvements and bug fixes.",
                    "https://i.com/ios",
                    "tech",
                ),
                topic(
                    "Apple issues macOS Tahoe patch",
                    "Apple announced a software update with security improvements and bug fixes.",
                    "https://j.com/macos",
                    "tech",
                ),
            ],
            "trending": [{
                "title": "Anthropic releases Sonnet 5.5, a significantly cheaper, faster work partner",
                "summary": "Anthropic has launched Sonnet 5.5, its latest mid-tier AI model, designed to be significantly faster and more cost-effective than its predecessor.",
                "url": "https://g.com/sonnet",
                "interest_id": "ai",
            }],
        }

        groups = _story_groups(feed)
        self.assertEqual(len(groups), 7, [g["title"] for g in groups])
        self.assertEqual(sum("astra" in g["summary"].lower() for g in groups), 1)
        self.assertEqual(sum("sonnet" in g["summary"].lower() for g in groups), 1)
        self.assertTrue(any("breach" in g["title"].lower() for g in groups))
        self.assertEqual(sum(g["interest_id"] == "startups" for g in groups), 2)
        self.assertEqual(sum(g["interest_id"] == "tech" for g in groups), 2)

    def test_same_company_patches_for_different_products_stay_separate(self):
        summary = "Apple issued a security patch with bug fixes and stability improvements. The update is available today."
        feed = {
            "trending_topics": [
                {**_topic("Apple issues security patch for iOS 27", "https://a.com/ios", [("iOS patch", "https://a.com/ios", "A")], "tech"),
                 "id": "ios", "summary": summary},
                {**_topic("Apple issues security patch for macOS Tahoe", "https://b.com/macos", [("macOS patch", "https://b.com/macos", "B")], "tech"),
                 "id": "macos", "summary": summary},
            ],
            "trending": [],
        }
        self.assertEqual(len(_story_groups(feed)), 2)

    def test_paraphrased_launch_headlines_sharing_two_names_merge(self):
        feed = {
            "trending_topics": [
                {**_topic("Meta Introduces Muse Wonder AI Model", "https://a.com/muse", [("a", "https://a.com/muse", "A")]),
                 "id": "muse-a", "summary": "Meta has launched its new Muse Wonder AI model, designed to be the most advanced digital assistant available. Plans start at $20 per month."},
                {**_topic("Meta Unveils Muse Wonder AI Models", "https://b.com/muse", [("b", "https://b.com/muse", "B")]),
                 "id": "muse-b", "summary": "Meta has launched its first frontier AI models, Muse Wonder and Muse Wonder Full, built at its Prometheus data center in Ohio."},
            ],
            "trending": [],
        }
        self.assertEqual(len(_story_groups(feed)), 1)

    def test_model_launch_and_jailbreak_remain_distinct(self):
        background = "Anthropic released Sonnet 5.5, a faster AI model with lower costs than its predecessor. The model is available to developers today."
        feed = {
            "trending_topics": [
                {**_topic("Anthropic releases Sonnet 5.5", "https://a.com/launch", [("launch", "https://a.com/launch", "A")]),
                 "id": "launch", "summary": background},
                {**_topic("Researchers find jailbreak in Sonnet 5.5", "https://b.com/jailbreak", [("jailbreak", "https://b.com/jailbreak", "B")]),
                 "id": "jailbreak", "summary": "Researchers found a jailbreak in Sonnet 5.5. " + background},
            ],
            "trending": [],
        }
        self.assertEqual(len(_story_groups(feed)), 2)

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
            pro = _select({}, interests, 10, "member")
            free = _select({}, interests, 5, "landing")
            landing = _select({}, [], 5, "landing")

        self.assertEqual(
            [lane for lane, _ in pro],
            [
                "model-releases", "ai", "markets", "startups", "tech",
                "engineering", "products", "the-world",
            ],
        )
        # Backfill folds into the lane's existing section: one heading each.
        self.assertEqual(len(dict(pro)["products"]), 2)
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
            pro_with_design = _select({}, interests, 10, "member")
            free_with_design = _select({}, interests, 5, "landing")
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
