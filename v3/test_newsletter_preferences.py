import unittest

from v1.newsletter_preferences import is_newsletter_enabled
from v3.flows.send_three_feed_newsletter import _has_required_mix, _pick_items, _render_item
from v3.scheduler import JOBS


class NewsletterPreferenceTests(unittest.TestCase):
    def test_daily_newsletter_requires_explicit_opt_in(self):
        self.assertFalse(is_newsletter_enabled({}))
        self.assertFalse(is_newsletter_enabled({"dailyNewsletterEnabled": False}))
        self.assertTrue(is_newsletter_enabled({"dailyNewsletterEnabled": True}))

    def test_legacy_explicit_opt_in_remains_valid(self):
        self.assertTrue(is_newsletter_enabled({"newsletterOptIn": True}))
        self.assertFalse(is_newsletter_enabled({"newsletterOptIn": False}))
        self.assertFalse(is_newsletter_enabled({
            "newsletterOptIn": True,
            "dailyNewsletterEnabled": False,
        }))

    def test_scheduler_uses_personalized_newsletter_sender(self):
        self.assertEqual(
            JOBS["newsletter_send"]["module"],
            "v3.flows.send_three_feed_newsletter",
        )

    def test_newsletter_uses_fixed_editorial_mix(self):
        topics = [
            {
                "title": f"{interest}-{i}",
                "interest_id": interest,
                "articles": [{"url": f"https://example.com/{interest}-{i}"}],
            }
            for interest in ("ai", "engineering", "markets", "startups")
            for i in range(3)
        ]
        pulse = {
            "tools": [{"url": f"https://example.com/build-{i}"} for i in range(3)],
            "discussions": [{"url": f"https://example.com/conversation-{i}"} for i in range(2)],
            "blogs": [{"url": f"https://example.com/briefing-{i}"} for i in range(2)],
        }

        picked = _pick_items({
            "trending_topics": topics,
            "daily_pulse_roles": {"developer": pulse},
        })

        self.assertEqual(len(picked), 9)
        self.assertEqual(
            {interest: sum(row.get("interest_id") == interest for row in picked)
             for interest in ("ai", "startups", "engineering")},
            {"ai": 3, "startups": 1, "engineering": 1},
        )
        self.assertNotIn("markets", {row.get("interest_id") for row in picked})
        self.assertEqual(
            [row["newsletter_group"] for row in picked[5:]],
            ["builds", "builds", "conversation", "briefing"],
        )
        self.assertTrue(_has_required_mix(picked))

    def test_newsletter_rejects_an_incomplete_editorial_mix(self):
        self.assertFalse(_has_required_mix([
            {"interest_id": "ai", "newsletter_group": "top_stories"},
            {"interest_id": "startups", "newsletter_group": "top_stories"},
            {"interest_id": "engineering", "newsletter_group": "top_stories"},
            {"newsletter_group": "builds"},
            {"newsletter_group": "conversation"},
            {"newsletter_group": "briefing"},
        ]))

    def test_newsletter_story_renders_its_image(self):
        html = _render_item({
            "url": "https://example.com/story",
            "title": "Story",
            "interest_id": "ai",
            "thumbnail": "https://example.com/story.jpg",
            "editorial_body": "First readable paragraph.\n\nSecond readable paragraph.",
            "editorial_takeaways": ["A **specific** fact.", "Another concrete fact."],
            "summary": {
                "short_article": {
                    "body": "The full useful summary.",
                    "key_takeaways": ["A **specific** fact."],
                    "slides": ["Slide 1: Another concrete fact."],
                },
            },
        })
        self.assertIn('src="https://example.com/story.jpg"', html)
        self.assertIn("First readable paragraph.", html)
        self.assertIn("Second readable paragraph.", html)
        self.assertIn("A specific fact.", html)
        self.assertIn("Another concrete fact.", html)
        self.assertNotIn("The full useful summary.", html)


if __name__ == "__main__":
    unittest.main()
