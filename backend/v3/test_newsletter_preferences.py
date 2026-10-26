import unittest

from v1.newsletter_preferences import is_newsletter_enabled
from v3.flows.send_three_feed_newsletter import (
    _editorial_briefing,
    _edition_is_complete,
    _takeaway_review_is_complete,
    _editorial_model_options,
    _has_required_mix,
    _pick_items,
    _render_item,
)
from v3.scheduler import JOBS


class NewsletterPreferenceTests(unittest.TestCase):
    def test_daily_newsletter_requires_explicit_opt_in(self):
        self.assertFalse(is_newsletter_enabled({}))
        self.assertFalse(is_newsletter_enabled({"dailyNewsletterEnabled": False}))
        self.assertTrue(is_newsletter_enabled({"dailyNewsletterEnabled": True}))

    def test_gpt5_editorial_options_omit_unsupported_temperature(self):
        self.assertEqual(
            _editorial_model_options("gpt-5-mini", 100, 0.4),
            {"max_completion_tokens": 100, "reasoning_effort": "minimal"},
        )

    def test_gpt6_editorial_options_use_lowest_supported_effort(self):
        self.assertEqual(
            _editorial_model_options("gpt-6.1-terra", 100, 0.4),
            {"max_completion_tokens": 100, "reasoning_effort": "none"},
        )

    def test_takeaway_review_requires_every_source_url(self):
        items = [{"url": "https://example.com/story"}]
        self.assertTrue(_takeaway_review_is_complete({"stories": [{
            "url": items[0]["url"],
            "takeaways": [],
        }]}, items))
        self.assertFalse(_takeaway_review_is_complete({"stories": []}, items))

    def test_legacy_explicit_opt_in_remains_valid(self):
        self.assertTrue(is_newsletter_enabled({"newsletterOptIn": True}))
        self.assertFalse(is_newsletter_enabled({"newsletterOptIn": False}))
        self.assertFalse(is_newsletter_enabled({
            "newsletterOptIn": True,
            "dailyNewsletterEnabled": False,
        }))

    def test_scheduler_uses_audience_newsletter_sender(self):
        # The daily is the audience sender (member / winback / landing); the
        # three-feed sender below is kept for reference but no longer scheduled.
        self.assertEqual(
            JOBS["newsletter_send"]["module"],
            "v3.flows.send_audience_newsletter",
        )

    @unittest.skip("legacy three-feed sender: no longer scheduled, mix not maintained")
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
        self.assertIn('href="https://example.com/story"', html)
        self.assertEqual(html.count('href="https://example.com/story"'), 1)
        self.assertNotIn("Open original source", html)

    def test_newsletter_story_renders_the_model_takeaways_unchanged(self):
        html = _render_item({
            "url": "https://example.com/story",
            "title": "Story",
            "editorial_body": "Apple released a robotics model for warehouse control.",
            "editorial_takeaways": [
                "It runs on-device.",
                "It uses a warehouse-specific control loop.",
            ],
        })
        self.assertEqual(html.count("Apple released a robotics model for warehouse control."), 1)
        self.assertIn("It runs on-device.", html)
        self.assertIn("It uses a warehouse-specific control loop.", html)

    def test_newsletter_story_does_not_fall_back_to_source_takeaways(self):
        html = _render_item({
            "url": "https://example.com/story",
            "title": "Story",
            "editorial_body": "A model was released for warehouse control.",
            "summary": {"short_article": {"slides": ["Slide 1: It runs on-device."]}},
        })
        self.assertNotIn("It runs on-device.", html)
        self.assertNotIn("Key takeaways", html)

    def test_editorial_briefing_keeps_candidate_takeaways_for_the_editor(self):
        briefing = _editorial_briefing([{
            "url": "https://example.com/story",
            "title": "Story",
            "newsletter_group": "top_stories",
            "summary": {
                "short_article": {
                    "body": "The company launched a model.",
                    "slides": ["Slide 1: The model has 2.4 trillion parameters."],
                },
            },
        }])
        self.assertEqual(briefing[0]["takeaways"], ["The model has 2.4 trillion parameters."])
        self.assertEqual(briefing[0]["format"], "two short paragraphs")

    def test_newsletter_story_omits_missing_image(self):
        html = _render_item({
            "url": "https://example.com/story",
            "title": "Story",
            "description": "A compact summary.",
        })
        self.assertNotIn("<img ", html)

    def test_newsletter_rejects_partial_cached_ai_edition(self):
        items = [{"url": "https://example.com/story"}]
        self.assertFalse(_edition_is_complete({
            "subject": "Subject",
            "intro": "Intro",
            "stories": [{"url": items[0]["url"], "body": "", "takeaways": []}],
        }, items))


if __name__ == "__main__":
    unittest.main()
