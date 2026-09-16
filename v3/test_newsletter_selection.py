#!/usr/bin/env python3

from __future__ import annotations

import unittest

from v3.flows.send_three_feed_newsletter import _candidate_stories, _pick_items


def _topic(title, url, articles, interest="ai"):
    return {
        "title": title,
        "interest_id": interest,
        "article_count": len(articles),
        "articles": [{"title": t, "url": u, "source": s} for t, u, s in articles],
    }


class NewsletterSelectionTests(unittest.TestCase):
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
