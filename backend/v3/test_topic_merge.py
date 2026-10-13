import unittest
from unittest.mock import patch

from v3.build_trending import (
    _clusters_from_group_decisions,
    _group_cache_key,
    _group_candidate_pairs,
    _group_story_clusters,
)
from v3.lib.diversity import dedupe_trending_latest_story


class FakeStore:
    def __init__(self):
        self.cache = {}

    def get_cached_synthesis(self, key):
        return self.cache.get(key)

    def cache_synthesis(self, key, value):
        self.cache[key] = value


def item(title, url, score=1.0):
    return {
        "title": title,
        "url": url,
        "source_name": "Source",
        "published_date": "2026-09-16T10:00:00+00:00",
        "_trend_score": score,
    }


def summary(body):
    return {"short_article": {"body": body}}


class TopicGroupingTests(unittest.TestCase):
    def test_embedding_threshold_changes_cache_key(self):
        states = [{"url": "https://example.com/a", "title": "A"}]
        low = _group_cache_key(states, "jev", "embed", 0.60, 0.70, 8, 240)
        high = _group_cache_key(states, "jev", "embed", 0.70, 0.70, 8, 240)
        self.assertNotEqual(low, high)

    def test_embedding_candidates_keep_top_k_and_threshold(self):
        pairs = _group_candidate_pairs(
            [[1.0, 0.0], [0.99, 0.01], [0.0, 1.0]],
            threshold=0.65,
            top_k=1,
        )
        self.assertEqual([(left, right) for left, right, _score in pairs], [(0, 1)])

    def test_updates_never_merge_even_with_high_same_card_probability(self):
        articles = [
            item("Initial AI safety proposal", "https://example.com/a"),
            item("Follow-up reaction to AI safety proposal", "https://example.com/b"),
        ]
        decisions = {(0, 1): {"same_card": 0.99, "relationship": "same_ongoing_event_update"}}
        clusters = _clusters_from_group_decisions(articles, decisions, threshold=0.70)
        self.assertEqual([len(cluster["items"]) for cluster in clusters], [1, 1])
        self.assertEqual(clusters[0]["thread_id"], clusters[1]["thread_id"])

    def test_same_event_requires_strict_threshold_and_relationship(self):
        articles = [
            item("Meta launches One subscriptions", "https://example.com/a"),
            item("Meta introduces One subscription bundles", "https://example.com/b"),
        ]
        self.assertEqual(
            len(_clusters_from_group_decisions(
                articles,
                {(0, 1): {"same_card": 0.69, "relationship": "same_concrete_event"}},
                threshold=0.70,
            )),
            2,
        )
        clusters = _clusters_from_group_decisions(
            articles,
            {(0, 1): {"same_card": 0.70, "relationship": "same_concrete_event"}},
            threshold=0.70,
        )
        self.assertEqual(len(clusters), 1)
        self.assertEqual(len(clusters[0]["items"]), 2)

    def test_embedding_failure_keeps_singletons(self):
        articles = [
            item("Meta launches One subscriptions", "https://example.com/a"),
            item("Meta introduces One subscription bundles", "https://example.com/b"),
        ]
        summaries = {
            article["url"]: summary("Meta launched a subscription bundle.")
            for article in articles
        }
        with patch("v3.build_trending._group_embeddings", return_value=None):
            clusters = _group_story_clusters(FakeStore(), articles, summaries)
        self.assertEqual([len(cluster["items"]) for cluster in clusters], [1, 1])

    def test_partial_jev_failure_keeps_singletons(self):
        articles = [
            item("Meta launches One subscriptions", "https://example.com/a"),
            item("Meta introduces One subscription bundles", "https://example.com/b"),
        ]
        summaries = {article["url"]: summary("Meta launched a subscription bundle.") for article in articles}
        with patch("v3.build_trending._group_embeddings", return_value=[[1.0, 0.0], [0.99, 0.01]]), patch(
            "v3.build_trending._typesafe_group_decisions",
            return_value=({(0, 1): {"same_card": 0.99, "relationship": "same_concrete_event"}}, False),
        ):
            clusters = _group_story_clusters(FakeStore(), articles, summaries)
        self.assertEqual([len(cluster["items"]) for cluster in clusters], [1, 1])

    def test_success_is_cached_and_skips_second_call(self):
        articles = [
            item("Meta launches One subscriptions", "https://example.com/a", score=2.0),
            item("Meta introduces One subscription bundles", "https://example.com/b"),
        ]
        summaries = {
            article["url"]: summary("Meta launched a subscription bundle.")
            for article in articles
        }
        store = FakeStore()
        with patch("v3.build_trending._group_embeddings", return_value=[[1.0, 0.0], [0.99, 0.01]]), \
             patch(
                 "v3.build_trending._typesafe_group_decisions",
                 return_value=({(0, 1): {"same_card": 0.9, "relationship": "same_concrete_event"}}, True),
             ) as decide:
            first = _group_story_clusters(store, articles, summaries)
            second = _group_story_clusters(store, articles, summaries)
        self.assertEqual(len(first), 1)
        self.assertEqual(len(second), 1)
        decide.assert_called_once()
        self.assertEqual(len(store.cache), 1)

    def test_url_duplicates_are_removed_before_grouping(self):
        articles = [
            item("Same article", "https://example.com/a", score=2.0),
            item("Same article copied", "https://example.com/a"),
            item("Different article", "https://example.com/b"),
        ]
        summaries = {article["url"]: summary("Article body") for article in articles}
        with patch("v3.build_trending._group_embeddings", return_value=None):
            clusters = _group_story_clusters(FakeStore(), articles, summaries)
        self.assertEqual(sum(len(cluster["items"]) for cluster in clusters), 2)

    def test_flat_feed_dedupe_only_collapses_canonical_url_duplicates(self):
        items = [
            item("Same event, first source", "https://Example.com/story/?utm_source=feed"),
            item("Same event, second source", "https://example.com/story"),
            item("Different event", "https://example.com/other"),
        ]
        kept, stats = dedupe_trending_latest_story(items)
        self.assertEqual(len(kept), 2)
        self.assertEqual(stats["dropped_exact_url"], 1)


if __name__ == "__main__":
    unittest.main()
