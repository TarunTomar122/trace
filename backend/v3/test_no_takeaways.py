"""Summaries no longer carry skim bullets (short_article.key_takeaways).
Ones cached before that change lose them on read, so they never reach the feed."""

import unittest

from v3.lib.summarizer import (
    _normalize_short_article_summary,
    batch_presummarize,
    get_or_generate_summary,
    without_takeaways,
)

OLD = {
    "interest_id": "ai",
    "short_article": {"headline": "H", "body": "Body.", "key_takeaways": ["Old bullet."]},
}


class FakeStore:
    def get_cached_summary_v2(self, url, bucket):
        return {"summary": OLD}

    def save_cached_summary_v2(self, *args):
        raise AssertionError("a cached summary must not be regenerated")


class NoTakeawaysTests(unittest.TestCase):
    def test_without_takeaways_strips_and_leaves_the_cache_copy_alone(self):
        clean = without_takeaways(OLD)
        self.assertEqual(clean["short_article"], {"headline": "H", "body": "Body."})
        self.assertEqual(clean["interest_id"], "ai")
        self.assertIn("key_takeaways", OLD["short_article"])
        self.assertIsNone(without_takeaways(None))

    def test_cached_reads_drop_takeaways(self):
        summary, cached = get_or_generate_summary(FakeStore(), "https://a.example/1", "T", "text", feed_type="trending")
        self.assertTrue(cached)
        self.assertNotIn("key_takeaways", summary["short_article"])
        stats = batch_presummarize(
            FakeStore(), [{"url": "https://a.example/1", "title": "T", "content": "text"}], feed_type="trending"
        )
        self.assertNotIn("key_takeaways", stats["summary_map"]["https://a.example/1"]["short_article"])

    def test_fresh_summaries_drop_any_takeaways_the_model_returns(self):
        parsed = _normalize_short_article_summary(
            {"short_article": {"subtitle": "S", "body": "Body.", "key_takeaways": ["x"]}}
        )
        self.assertNotIn("key_takeaways", parsed["short_article"])


if __name__ == "__main__":
    unittest.main()
