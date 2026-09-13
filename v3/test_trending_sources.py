#!/usr/bin/env python3

from __future__ import annotations

import json
import threading
import unittest
from pathlib import Path
from unittest.mock import patch

from v2.utils.fetch_article_links import ExtractResult, _extract_from_rss_or_atom
from v3.build_trending import refresh_pool


REPO_ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = REPO_ROOT / "v3/config/trending_sources.json"

EXPECTED_SOURCES = {
    "Crunchbase News": {
        "url": "https://news.crunchbase.com/feed/",
        "type": "rss",
        "interest_id": "startups",
    },
    "BBC Technology": {
        "url": "https://feeds.bbci.co.uk/news/technology/rss.xml",
        "type": "rss",
        "interest_id": "tech",
    },
    "404 Media": {
        "url": "https://www.404media.co/rss/",
        "type": "rss",
        "interest_id": "tech",
    },
    "SecurityWeek Malware & Threats": {
        "url": "https://www.securityweek.com/category/malware-cyber-threats/feed/",
        "type": "rss",
        "interest_id": "tech",
    },
}

REJECTED_SOURCES = {
    "Cloudflare Blog",
    "NVIDIA Technical Blog",
    "Rest of World",
}


class MemoryPoolStore:
    """Thread-safe in-memory stand-in for the Firestore pool contract."""

    def __init__(self) -> None:
        self.items: dict[str, dict] = {}
        self._lock = threading.Lock()

    def pool_items_exist(self, collection: str, urls: list[str]) -> set[str]:
        del collection
        with self._lock:
            return {url for url in urls if url in self.items}

    def upsert_pool_item(
        self, collection: str, url: str, data: dict
    ) -> str:
        del collection
        with self._lock:
            self.items[url] = {"url": url, **data}
        return url

    def deactivate_stale(self, collection: str, max_age_days: int) -> int:
        del collection, max_age_days
        return 0


class TrendingSourceConfigTests(unittest.TestCase):
    def test_new_sources_use_unique_native_feeds(self) -> None:
        config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        sources = config["sources"]
        by_name = {source["name"]: source for source in sources}

        self.assertEqual(len(by_name), len(sources))
        self.assertTrue(REJECTED_SOURCES.isdisjoint(by_name))
        self.assertEqual(
            len({source["url"] for source in sources}),
            len(sources),
        )

        for name, expected in EXPECTED_SOURCES.items():
            source = by_name[name]
            self.assertEqual(source["url"], expected["url"])
            self.assertEqual(source["type"], expected["type"])
            self.assertEqual(source["interest_id"], expected["interest_id"])
            self.assertGreaterEqual(source["source_weight"], 1.0)
            self.assertIn(source["type"], {"rss", "atom"})

    def test_parser_normalizes_representative_rss_and_atom_items(self) -> None:
        rss = """\
        <rss version="2.0">
          <channel>
            <item>
              <title>Infrastructure launch</title>
              <link>https://example.com/posts/infrastructure-launch/?utm_source=rss</link>
              <pubDate>Thu, 23 Jul 2026 18:40:38 GMT</pubDate>
            </item>
          </channel>
        </rss>
        """
        atom = """\
        <feed xmlns="http://www.w3.org/2005/Atom">
          <entry>
            <title>Production AI engineering</title>
            <link rel="alternate" href="https://example.org/blog/production-ai-engineering/" />
            <updated>2026-07-23T16:07:03Z</updated>
          </entry>
        </feed>
        """

        rss_items = _extract_from_rss_or_atom(
            rss, "https://example.com/feed/"
        )
        atom_items = _extract_from_rss_or_atom(
            atom, "https://example.org/blog/feed/"
        )

        self.assertEqual(
            rss_items,
            [
                {
                    "url": "https://example.com/posts/infrastructure-launch",
                    "title": "Infrastructure launch",
                    "description": "",
                    "published_date": "2026-07-23T18:40:38+00:00",
                    "og_image": "",
                }
            ],
        )
        self.assertEqual(
            atom_items,
            [
                {
                    "url": "https://example.org/blog/production-ai-engineering",
                    "title": "Production AI engineering",
                    "description": "",
                    "published_date": "2026-07-23T16:07:03+00:00",
                    "og_image": "",
                }
            ],
        )


class TrendingSourcePipelineTests(unittest.TestCase):
    def setUp(self) -> None:
        self.good_source = {
            "name": "Good Engineering Feed",
            "url": "https://good.example/feed.xml",
            "type": "rss",
            "interest_id": "tech",
            "source_weight": 1.1,
        }
        self.bad_source = {
            "name": "Unavailable Feed",
            "url": "https://bad.example/feed.xml",
            "type": "rss",
            "interest_id": "tech",
            "source_weight": 1.0,
        }
        self.config = {
            "max_age_hours": 12,
            "discovery": {"enabled": False},
            "sources": [self.good_source, self.bad_source],
        }

    @staticmethod
    def _fetch_links(url: str, limit: int) -> ExtractResult:
        del limit
        if "bad.example" in url:
            raise TimeoutError("simulated source timeout")
        return ExtractResult(
            source_url=url,
            source_type="rss",
            articles=[
                {
                    "url": "https://good.example/posts/reliable-ingestion",
                    "title": "Reliable ingestion for engineering teams",
                    "published_date": "2026-07-23T18:40:38+00:00",
                    "og_image": "https://good.example/image.jpg",
                }
            ],
        )

    def test_source_failure_isolated_and_item_normalized(self) -> None:
        store = MemoryPoolStore()
        with (
            patch(
                "v3.build_trending.fetch_article_links",
                side_effect=self._fetch_links,
            ),
            patch(
                "v3.build_trending.fetch_content",
                return_value={
                    "content": "Substantive engineering content. " * 30,
                    "image": "",
                    "source": "http",
                },
            ),
        ):
            stats = refresh_pool(store, self.config, limit_per_source=5)

        self.assertEqual(stats["sources"], 2)
        self.assertEqual(stats["errors"], 1)
        self.assertEqual(stats["new_items"], 1)
        self.assertEqual(stats["links_found"], 1)

        item = store.items[
            "https://good.example/posts/reliable-ingestion"
        ]
        self.assertEqual(item["source_name"], "Good Engineering Feed")
        self.assertEqual(item["source_url"], self.good_source["url"])
        self.assertEqual(item["interest_id"], "tech")
        self.assertEqual(item["content_source"], "http")
        self.assertTrue(item["is_active"])
        self.assertLessEqual(len(item["content"]), 10000)

    def test_second_refresh_is_idempotent(self) -> None:
        store = MemoryPoolStore()
        config = {**self.config, "sources": [self.good_source]}

        with (
            patch(
                "v3.build_trending.fetch_article_links",
                side_effect=self._fetch_links,
            ),
            patch(
                "v3.build_trending.fetch_content",
                return_value={
                    "content": "Substantive engineering content. " * 30,
                    "image": "",
                    "source": "http",
                },
            ) as fetch_content,
        ):
            first = refresh_pool(store, config, limit_per_source=5)
            second = refresh_pool(store, config, limit_per_source=5)

        self.assertEqual(first["new_items"], 1)
        self.assertEqual(second["new_items"], 0)
        self.assertEqual(second["skipped"], 1)
        self.assertEqual(len(store.items), 1)
        fetch_content.assert_called_once()


if __name__ == "__main__":
    unittest.main()
