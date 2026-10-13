import os
import unittest
from unittest.mock import patch

from v3.build_trending import (
    RANKING_SCORE_MAX,
    RANKING_SCORE_WEIGHTS,
    _score_clusters_with_jev,
    _sort_topic_clusters,
    _validated_ranking_result,
)


class FakeStore:
    def __init__(self):
        self.cache = {}

    def get_cached_synthesis(self, key):
        return self.cache.get(key)

    def cache_synthesis(self, key, value):
        self.cache[key] = value


def cluster(title, source_count, article_count, popularity=1.0):
    return {
        "items": [
            {
                "title": title,
                "url": f"https://example.com/{title.replace(' ', '-').lower()}",
                "source_name": f"Source {index}",
                "published_date": "2026-09-16T10:00:00+00:00",
                "_trend_score": 1.0,
            }
            for index in range(source_count)
        ][:article_count],
        "source_count": source_count,
        "article_count": article_count,
        "popularity_score": popularity,
    }


def valid_result(score=1.0, confidence=0.9):
    # Every dimension the ranker validates, including the newsletter's
    # zero-weight send_worthy score.
    scores = {name: min(score, maximum) for name, maximum in RANKING_SCORE_MAX.items()}
    return {
        "scores": scores,
        "confidence": {name: confidence for name in RANKING_SCORE_WEIGHTS},
        "semantic_score": sum(
            RANKING_SCORE_WEIGHTS[name] * scores[name] / maximum
            for name, maximum in RANKING_SCORE_MAX.items()
        ),
    }


class JevRankingTests(unittest.TestCase):
    def test_validated_score_composes_normalized_weighted_score(self):
        result = _validated_ranking_result(
            {
                "scores": {
                    "importance": 4,
                    "novelty": 3,
                    "usefulness": 3,
                    "general_interest": 3,
                    "evidence_quality": 3,
                    "send_worthy": 2,
                },
                "confidence": {name: 1.0 for name in RANKING_SCORE_WEIGHTS},
            },
            0.5,
        )
        self.assertIsNotNone(result)
        self.assertEqual(result["semantic_score"], 1.0)

    def test_low_confidence_score_is_rejected(self):
        result = _validated_ranking_result(
            {**valid_result(), "confidence": {name: 0.49 for name in RANKING_SCORE_WEIGHTS}},
            0.5,
        )
        self.assertIsNone(result)

    def test_rank_key_prioritizes_consensus_before_jev(self):
        clusters = [
            {"source_count": 3, "article_count": 1, "_jev_semantic_score": 0.1, "popularity_score": 9, "_rank_index": 0},
            {"source_count": 2, "article_count": 4, "_jev_semantic_score": 1.0, "popularity_score": 20, "_rank_index": 1},
        ]
        ranked = _sort_topic_clusters(clusters, jev_enabled=True)
        self.assertEqual(ranked[0]["source_count"], 3)

    def test_missing_key_preserves_deterministic_fallback(self):
        clusters = [cluster("One story", 1, 1, popularity=2)]
        with patch.dict(os.environ, {}, clear=True):
            self.assertFalse(_score_clusters_with_jev(FakeStore(), clusters, {}))
        self.assertNotIn("_jev_semantic_score", clusters[0])

    def test_scores_are_cached_and_reused(self):
        clusters = [cluster("One story", 1, 1), cluster("Two story", 1, 1)]
        store = FakeStore()
        with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}, clear=False), patch(
            "v3.build_trending._rank_decisions",
            return_value={"t0": valid_result(2.0), "t1": valid_result(1.0)},
        ) as decide:
            self.assertTrue(_score_clusters_with_jev(store, clusters, {}))
            self.assertEqual(len(store.cache), 2)
            self.assertTrue(_score_clusters_with_jev(store, clusters, {}))
        decide.assert_called_once()
        self.assertGreater(clusters[0]["_jev_semantic_score"], clusters[1]["_jev_semantic_score"])

    def test_partial_or_low_confidence_batch_falls_back(self):
        clusters = [cluster("One story", 1, 1), cluster("Two story", 1, 1)]
        with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}, clear=False), patch(
            "v3.build_trending._rank_decisions",
            return_value={"t0": valid_result()},
        ):
            self.assertFalse(_score_clusters_with_jev(FakeStore(), clusters, {}))
        # Ordering stays deterministic (False), but the verdict Jev did give is
        # kept so the newsletter's send-worthiness gate still works.
        self.assertIn("_jev_semantic_score", clusters[0])
        self.assertNotIn("_jev_semantic_score", clusters[1])


if __name__ == "__main__":
    unittest.main()
