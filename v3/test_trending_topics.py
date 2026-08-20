#!/usr/bin/env python3

from __future__ import annotations

import unittest

from v3.build_trending import _cluster_topic_candidates, _topic_tokens_for_item


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

    def test_cluster_candidates_merge_verb_variants_for_same_story(self) -> None:
        items = [
            {
                "title": "Anthropic's Claude Code Leak Unveils Future Features",
                "metadata": {},
                "source_name": "Source A",
            },
            {
                "title": "Anthropic's leaked AI coding tool has been cloned over 8,000 times",
                "metadata": {},
                "source_name": "Source B",
            },
        ]

        clusters = _cluster_topic_candidates(items)

        self.assertEqual(len(clusters), 1)
        self.assertEqual(len(clusters[0]["items"]), 2)

if __name__ == "__main__":
    unittest.main()
