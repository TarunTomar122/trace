#!/usr/bin/env python3

from __future__ import annotations

import unittest

from datetime import datetime, timezone

from v3.build_trending import (
    _effective_max_age_hours,
    _looks_like_entertainment,
    _looks_like_market_blog,
    _topic_tokens_for_item,
)


class TrendingTopicClusteringTests(unittest.TestCase):
    def test_topic_tokens_normalize_event_verbs(self) -> None:
        item = {
            "title": "Anthropic's leaked AI coding tool unveils future features",
            "metadata": {},
        }

        tokens = _topic_tokens_for_item(item)

        self.assertIn("anthropic", tokens)
        self.assertIn("leak", tokens)
        self.assertIn("code", tokens)
        self.assertIn("unveil", tokens)
        self.assertNotIn("leaked", tokens)
        self.assertNotIn("coding", tokens)
        self.assertNotIn("unveils", tokens)

    def test_market_blog_filter_drops_advice_listicles(self) -> None:
        # Real titles that were wrongly featured as markets news.
        self.assertTrue(_looks_like_market_blog("Could Upstart 10x From Here? The AI Fintech Platform Could Be the Most"))
        self.assertTrue(_looks_like_market_blog("If You'd Invested $5,000 in VGT 10 Years Ago, Here's Exactly How Much"))
        self.assertTrue(_looks_like_market_blog("Rivian vs. Lucid: This Stock Is Clearly the Better Buy"))
        self.assertTrue(_looks_like_market_blog("Retiring in 2027? 3 Essential Financial Moves to Make"))
        self.assertTrue(_looks_like_market_blog("Toncoin (TON) Price Prediction 2025, 2026, 2027-2030"))
        self.assertTrue(_looks_like_market_blog("Where Will XRP Be in 3 Years?"))
        self.assertTrue(_looks_like_market_blog("She Inherited Her Father's $400,000 401(k). One Direct Rollover Turned"))

    def test_weekend_freshness_window(self) -> None:
        config = {"max_age_hours": 36}
        wednesday = datetime(2026, 9, 16, 12, 0, tzinfo=timezone.utc)
        saturday = datetime(2026, 9, 12, 12, 0, tzinfo=timezone.utc)
        sunday = datetime(2026, 9, 13, 20, 0, tzinfo=timezone.utc)
        self.assertEqual(_effective_max_age_hours(config, now=wednesday), 36)
        self.assertEqual(_effective_max_age_hours(config, now=saturday), 72)
        self.assertEqual(_effective_max_age_hours(config, now=sunday), 72)
        # explicit override still wins when the config has no window
        self.assertEqual(
            _effective_max_age_hours({}, override=24, now=wednesday), 24,
        )

    def test_entertainment_filter_drops_culture_items(self) -> None:
        self.assertTrue(_looks_like_entertainment("Three Batman Movies Return to Theaters Next Week"))
        self.assertTrue(_looks_like_entertainment("Universal Studios Japan Celebrates Halloween With First R-Rated Attraction"))
        self.assertTrue(_looks_like_entertainment("The band's album review is a return to form"))
        self.assertTrue(_looks_like_entertainment("Marvel's next film festival slate revealed"))
        self.assertFalse(_looks_like_entertainment("Apple Develops Game Controllers for iPhone"))
        self.assertFalse(_looks_like_entertainment("Waymo Calls Police on Armed Riders"))
        # Real news that the earlier single-word list would have dropped.
        self.assertFalse(_looks_like_entertainment("Adobe Premiere Pro adds AI-powered text editing"))
        self.assertFalse(_looks_like_entertainment("AMC Theaters posts record quarterly revenue"))
        self.assertFalse(_looks_like_entertainment("Google Photos brings AI albums to more users"))
        self.assertFalse(_looks_like_entertainment("US trailer orders fall for a third month"))

    def test_investment_spam_filter(self) -> None:
        self.assertTrue(_looks_like_market_blog("Want in on Anthropic Before the IPO? Buy These 8 Stocks"))
        self.assertTrue(_looks_like_market_blog("Could Upstart 10x From Here?"))

    def test_market_blog_filter_keeps_real_market_news(self) -> None:
        self.assertFalse(_looks_like_market_blog("Stocks stumble on inflation fears"))
        self.assertFalse(_looks_like_market_blog("Larry Ellison nixes plan to offload $7.5 billion of Oracle stock"))
        self.assertFalse(_looks_like_market_blog("Pay is back on the rise for job switchers"))
        self.assertFalse(_looks_like_market_blog("Bank exits squeeze truck financing for mid-size fleets"))
        self.assertFalse(_looks_like_market_blog("Anthropic has chosen the Nasdaq for its IPO listing"))


if __name__ == "__main__":
    unittest.main()
