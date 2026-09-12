import json
import os
import unittest
from collections import Counter

from v3.build_trending import (
    _apply_topic_merges,
    _merge_candidate_pairs,
    _merge_related_topics,
    _topic_tokens_for_item,
)


class FakeStore:
    def __init__(self):
        self.cache = {}

    def get_cached_synthesis(self, key):
        return self.cache.get(key)

    def cache_synthesis(self, key, value):
        self.cache[key] = value


def make_cluster(title, url, source="Source", interest="ai"):
    item = {
        "title": title,
        "url": url,
        "source_name": source,
        "interest_id": interest,
        "_trend_score": 1.0,
    }
    tokens = _topic_tokens_for_item(item)
    return {
        "items": [item],
        "tokens": set(tokens),
        "token_counts": Counter(tokens),
        "consensus_tokens": set(),
    }


def anthropic_clusters():
    return [
        make_cluster(
            "Anthropic's Amodei proposes plan to 'slow the pace' of advancing AI capabilities",
            "https://cnbc.com/amodei-slow",
            "CNBC Technology",
        ),
        make_cluster(
            "Anthropic CEO says it's time to pump the brakes on AI",
            "https://theverge.com/pump-brakes",
            "The Verge",
        ),
    ]


class TopicMergeTests(unittest.TestCase):
    def test_real_fragmented_case_merges(self):
        store = FakeStore()
        clusters = anthropic_clusters()

        def complete(_prompt):
            return json.dumps({"verdicts": [{"pair": [1, 2], "same_event": True, "event": "Anthropic slowdown call"}]})

        merged = _merge_related_topics(store, clusters, complete=complete)
        self.assertEqual(len(merged), 1)
        self.assertEqual(len(merged[0]["items"]), 2)

    def test_guard_rejects_unrelated_topics(self):
        store = FakeStore()
        clusters = [
            make_cluster(
                "Apple Launches iPhone 18 Pro and Pro Max Preorders",
                "https://theverge.com/iphone-preorder",
                "The Verge",
                "tech",
            ),
            make_cluster(
                "Alibaba's $10.2 Billion AI Capital Raise",
                "https://yahoo.com/alibaba-raise",
                "Yahoo Finance",
                "markets",
            ),
        ]
        # Not even a candidate pair: the model is never asked, and a forged
        # verdict for a non-candidate pair cannot merge anything.
        self.assertEqual(_merge_candidate_pairs(clusters), [])

        def complete(_prompt):
            return json.dumps({"verdicts": [{"pair": [1, 2], "same_event": True, "event": "nope"}]})

        merged = _merge_related_topics(store, clusters, complete=complete)
        self.assertEqual(len(merged), 2)

    def test_bad_json_keeps_original_clusters(self):
        store = FakeStore()
        clusters = anthropic_clusters()

        def complete(_prompt):
            return "not json"

        merged = _merge_related_topics(store, clusters, complete=complete)
        self.assertEqual(len(merged), 2)
        self.assertNotIn("topic_merge", "".join(store.cache.keys()))

    def test_cache_avoids_second_model_call(self):
        store = FakeStore()
        clusters = anthropic_clusters()
        calls = {"n": 0}

        def complete(_prompt):
            calls["n"] += 1
            return json.dumps({"verdicts": [{"pair": [1, 2], "same_event": True, "event": "x"}]})

        _merge_related_topics(store, clusters, complete=complete)
        _merge_related_topics(store, anthropic_clusters(), complete=complete)
        self.assertEqual(calls["n"], 1)

    def test_kill_switch(self):
        store = FakeStore()
        clusters = anthropic_clusters()
        os.environ["TRENDING_MERGE_AI"] = "0"
        try:
            merged = _merge_related_topics(store, clusters, complete=lambda _p: json.dumps({"verdicts": [{"pair": [1, 2], "same_event": True, "event": "x"}]}))
        finally:
            os.environ.pop("TRENDING_MERGE_AI", None)
        self.assertEqual(len(merged), 2)

    def test_apply_rejects_overlapping_or_out_of_range_groups(self):
        clusters = anthropic_clusters()
        merged = _apply_topic_merges(clusters, [[1, 2], [2, 1], [1, 99]])
        self.assertEqual(len(merged), 1)
        self.assertEqual(len(merged[0]["items"]), 2)


if __name__ == "__main__":
    unittest.main()
