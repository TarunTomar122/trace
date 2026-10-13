"""When the overview model is unavailable, topics fall back to the lead
article's own headline and summary, and the failure is not cached."""

import unittest
from unittest.mock import MagicMock, patch

from v3.build_trending import (
    _build_singleton_topic_overview,
    _build_topic_overview,
    _build_topic_timeline,
    _topic_cache_key,
    _topic_title,
)


class FakeStore:
    def __init__(self):
        self.cache = {}

    def get_cached_synthesis(self, key):
        return self.cache.get(key)

    def cache_synthesis(self, key, value):
        self.cache[key] = value


def item(title, url, score=1.0, source="Source"):
    return {
        "title": title,
        "url": url,
        "source_name": source,
        "published_date": "2026-10-13T07:30:00+00:00",
        "_trend_score": score,
    }


LEAD = item("Anthropic says small AI models may soon copy themselves onto smart devices", "https://tnw.example/a", 3.0, "The Next Web")
# Enriched outlets arrive with no score and no summary.
EXTRA = [
    item("Anthropic: AI may soon self-replicate on smart TVs and ovens", "https://madrobot.example/b", 0.0, "madrobot.blog"),
    item("Anthropic warns small AI models may soon self-replicate on IoT devices", "https://crypto.example/c", 0.0, "cryptobriefing.com"),
]
ITEMS = [LEAD, *EXTRA]
SUMMARIES = {
    LEAD["url"]: {
        "short_article": {
            "body": "Anthropic's red team found small open models can copy themselves onto smart TVs.",
            "key_takeaways": ["The test used devices with 4GB of RAM."],
        }
    }
}


def overview_with(client):
    store = FakeStore()
    timeline = _build_topic_timeline("tt_x", ITEMS, SUMMARIES)
    with patch("openai.OpenAI", return_value=client):
        result = _build_topic_overview(store, "tt_x", _topic_title({"items": ITEMS}), ITEMS, timeline, SUMMARIES)
    return result, store


class TopicOverviewFallbackTests(unittest.TestCase):
    def test_fallback_title_is_the_lead_headline(self):
        self.assertEqual(_topic_title({"items": list(reversed(ITEMS))}), LEAD["title"])
        self.assertEqual(_topic_title({"items": []}), "Trending now")

    def test_model_failure_uses_the_lead_article_and_is_not_cached(self):
        client = MagicMock()
        client.chat.completions.create.side_effect = RuntimeError("401 token_invalidated")
        (title, overview, points, from_cache), store = overview_with(client)
        self.assertEqual(title, LEAD["title"])
        self.assertIn("red team", overview)
        self.assertEqual(points, ["The test used devices with 4GB of RAM."])
        self.assertFalse(from_cache)
        self.assertEqual(store.cache, {})

    def test_model_overview_survives_generic_phrases(self):
        reply = MagicMock()
        reply.usage = None
        reply.choices = [MagicMock()]
        reply.choices[0].message.content = (
            '{"title": "Anthropic Warns AI Could Self-Replicate on Smart Devices",'
            ' "overview": "Anthropic signals that small models could spread to smart TVs amid market volatility.",'
            ' "key_points": []}'
        )
        client = MagicMock()
        client.chat.completions.create.return_value = reply
        (title, overview, _points, _cached), store = overview_with(client)
        self.assertEqual(title, "Anthropic Warns AI Could Self-Replicate on Smart Devices")
        self.assertTrue(overview.startswith("Anthropic signals that small models"))
        self.assertEqual(len(store.cache), 1)

    def test_cached_template_overview_is_retried(self):
        store = FakeStore()
        store.cache[_topic_cache_key(ITEMS)] = {
            "title": "Soon and Anthropic",
            "overview": "Soon and Anthropic saw 3 notable updates in the last 24 hours across 3 sources.",
            "key_points": [],
        }
        client = MagicMock()
        client.chat.completions.create.side_effect = RuntimeError("down")
        timeline = _build_topic_timeline("tt_x", ITEMS, SUMMARIES)
        with patch("openai.OpenAI", return_value=client):
            title, overview, _points, from_cache = _build_topic_overview(
                store, "tt_x", LEAD["title"], ITEMS, timeline, SUMMARIES
            )
        self.assertEqual(title, LEAD["title"])
        self.assertNotIn("notable updates", overview)
        self.assertFalse(from_cache)

    def test_empty_model_overview_falls_back_and_is_not_cached(self):
        reply = MagicMock()
        reply.usage = None
        reply.choices = [MagicMock()]
        reply.choices[0].message.content = '{"title": "Something", "overview": "", "key_points": []}'
        client = MagicMock()
        client.chat.completions.create.return_value = reply
        (title, overview, _points, from_cache), store = overview_with(client)
        self.assertEqual(title, LEAD["title"])
        self.assertIn("red team", overview)
        self.assertFalse(from_cache)
        self.assertEqual(store.cache, {})

    def test_real_cached_overview_is_served(self):
        store = FakeStore()
        store.cache[_topic_cache_key(ITEMS)] = {
            "title": "Anthropic Warns of Self-Copying AI",
            "overview": "Anthropic found small models can copy themselves onto smart TVs.",
            "key_points": ["The test used 4GB devices."],
        }
        client = MagicMock()
        timeline = _build_topic_timeline("tt_x", ITEMS, SUMMARIES)
        with patch("openai.OpenAI", return_value=client):
            result = _build_topic_overview(store, "tt_x", LEAD["title"], ITEMS, timeline, SUMMARIES)
        self.assertEqual(result, (
            "Anthropic Warns of Self-Copying AI",
            "Anthropic found small models can copy themselves onto smart TVs.",
            ["The test used 4GB devices."],
            True,
        ))
        client.chat.completions.create.assert_not_called()

    def test_singleton_without_summary_has_no_filler(self):
        title, overview, points, from_cache = _build_singleton_topic_overview(EXTRA[0], "fallback", {})
        self.assertEqual(title, EXTRA[0]["title"])
        self.assertEqual((overview, points, from_cache), ("", [], False))


if __name__ == "__main__":
    unittest.main()
