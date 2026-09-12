import json
import os
import unittest
from collections import Counter

from v3.build_trending import (
    _apply_topic_merges,
    _cluster_popularity_score,
    _merge_candidate_pairs,
    _merge_components,
    _merge_related_topics,
    _topic_tokens_for_item,
    _validated_merge_groups,
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


def anthropic_three_way():
    return anthropic_clusters() + [
        make_cluster(
            "Anthropic boss Dario Amodei calls for AI development to slow down",
            "https://bbc.com/amodei-slowdown",
            "BBC News",
        ),
    ]


class TopicMergeTests(unittest.TestCase):
    def test_real_fragmented_case_merges(self):
        store = FakeStore()
        clusters = anthropic_clusters()

        def complete(_prompt):
            return json.dumps({"groups": [[1, 2]]})

        merged = _merge_related_topics(store, clusters, complete=complete)
        self.assertEqual(len(merged), 1)
        self.assertEqual(len(merged[0]["items"]), 2)

    def test_three_way_split_merges_in_one_pass(self):
        store = FakeStore()
        clusters = anthropic_three_way()

        def complete(_prompt):
            return json.dumps({"groups": [[1, 2, 3]]})

        merged = _merge_related_topics(store, clusters, complete=complete)
        self.assertEqual(len(merged), 1)
        self.assertEqual(len(merged[0]["items"]), 3)

    def test_merged_topic_is_finalized_like_a_native_cluster(self):
        store = FakeStore()
        clusters = anthropic_clusters()

        def complete(_prompt):
            return json.dumps({"groups": [[1, 2]]})

        merged = _merge_related_topics(store, clusters, complete=complete)
        score = float(merged[0].get("popularity_score", 0.0))
        self.assertGreater(score, 0.0)
        self.assertEqual(score, _cluster_popularity_score(merged[0]))
        self.assertEqual(merged[0]["consensus_tokens"], {t for t, cnt in merged[0]["token_counts"].items() if cnt >= 2})

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
        # Not candidate pairs: the model is never asked, and a forged group
        # for non-candidate topics cannot merge anything.
        self.assertEqual(_merge_candidate_pairs(clusters), [])
        calls = {"n": 0}

        def complete(_prompt):
            calls["n"] += 1
            return json.dumps({"groups": [[1, 2]]})

        merged = _merge_related_topics(store, clusters, complete=complete)
        self.assertEqual(len(merged), 2)
        self.assertEqual(calls["n"], 0)

    def test_bad_json_keeps_original_clusters_and_skips_cache(self):
        store = FakeStore()
        clusters = anthropic_clusters()

        def complete(_prompt):
            return "not json"

        merged = _merge_related_topics(store, clusters, complete=complete)
        self.assertEqual(len(merged), 2)
        self.assertEqual(store.cache, {})

    def test_groups_of_wrong_type_are_a_no_op(self):
        for payload in ('{"groups": "false"}', '{"groups": [[1, 99]]}', '{"groups": 3}', "{}"):
            store = FakeStore()
            clusters = anthropic_clusters()
            merged = _merge_related_topics(store, clusters, complete=lambda _p, p=payload: p)
            self.assertEqual(len(merged), 2, payload)

    def test_valid_empty_partition_is_cached_and_skips_second_call(self):
        store = FakeStore()
        calls = {"n": 0}

        def complete(_prompt):
            calls["n"] += 1
            return json.dumps({"groups": []})

        merged = _merge_related_topics(store, anthropic_clusters(), complete=complete)
        self.assertEqual(len(merged), 2)
        merged = _merge_related_topics(store, anthropic_clusters(), complete=complete)
        self.assertEqual(len(merged), 2)
        self.assertEqual(calls["n"], 1)

    def test_cache_avoids_second_model_call(self):
        store = FakeStore()
        clusters = anthropic_clusters()
        calls = {"n": 0}

        def complete(_prompt):
            calls["n"] += 1
            return json.dumps({"groups": [[1, 2]]})

        _merge_related_topics(store, clusters, complete=complete)
        _merge_related_topics(store, anthropic_clusters(), complete=complete)
        self.assertEqual(calls["n"], 1)

    def test_legacy_or_tampered_cache_is_ignored_and_recomputed(self):
        store = FakeStore()
        calls = {"n": 0}

        def complete(_prompt):
            calls["n"] += 1
            return json.dumps({"groups": [[1, 2]]})

        _merge_related_topics(store, anthropic_clusters(), complete=complete)
        self.assertEqual(calls["n"], 1)
        for key in list(store.cache):
            # Old pairwise format / missing ok flag / tampered groups.
            store.cache[key] = {"merge_groups": [[1, 2, 3]], "verdicts": []}

        merged = _merge_related_topics(store, anthropic_clusters(), complete=complete)
        self.assertEqual(calls["n"], 2)
        self.assertEqual(len(merged), 1)

    def test_kill_switch_values(self):
        for value in ("0", "false", "OFF", "no"):
            store = FakeStore()
            calls = {"n": 0}
            os.environ["TRENDING_MERGE_AI"] = value
            try:
                merged = _merge_related_topics(
                    store,
                    anthropic_clusters(),
                    complete=lambda _p: calls.__setitem__("n", calls["n"] + 1) or json.dumps({"groups": [[1, 2]]}),
                )
            finally:
                os.environ.pop("TRENDING_MERGE_AI", None)
            self.assertEqual(len(merged), 2, value)
            self.assertEqual(calls["n"], 0, value)

    def test_apply_rejects_overlapping_or_out_of_range_groups(self):
        clusters = anthropic_clusters()
        merged = _apply_topic_merges(clusters, [[1, 2], [2, 1], [1, 99]])
        self.assertEqual(len(merged), 1)
        self.assertEqual(len(merged[0]["items"]), 2)

    def test_components_only_follow_candidate_edges(self):
        # A group of three merges fully when 1-2 and 2-3 are candidates.
        self.assertEqual(_merge_components([[1, 2, 3]], {(0, 1), (1, 2)}), [[1, 2, 3]])
        # A single endorsed edge merges only that pair.
        self.assertEqual(_merge_components([[1, 2, 3]], {(0, 1)}), [[1, 2]])
        # No candidate edges: the forged group is inert.
        self.assertEqual(_merge_components([[1, 2, 3]], set()), [])

    def test_validated_groups_normalization(self):
        self.assertIsNone(_validated_merge_groups("not json", 3))
        self.assertIsNone(_validated_merge_groups({"groups": "x"}, 3))
        self.assertEqual(_validated_merge_groups({"groups": []}, 3), [])
        self.assertEqual(_validated_merge_groups({"groups": [[3, 1, 1]]}, 3), [[1, 3]])
        self.assertEqual(_validated_merge_groups({"groups": [[1], [1, 2, 99]]}, 3), [[1, 2]])


if __name__ == "__main__":
    unittest.main()
