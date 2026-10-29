#!/usr/bin/env python3

from __future__ import annotations

import json
import threading
import unittest
from pathlib import Path
from unittest.mock import patch

from v2.utils.fetch_article_links import ExtractResult, _extract_from_rss_or_atom
from v3.build_trending import _title_has_excluded_keywords, refresh_pool


BACKEND_ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = BACKEND_ROOT / "v3/config/trending_sources.json"

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
    # Robotics lane: checked 2026-10-20 (HTTP 200 with the pipeline's user
    # agent, parsed by its own RSS/Atom reader).
    "The Robot Report": {
        "url": "https://www.therobotreport.com/feed/",
        "type": "rss",
        "interest_id": "robotics",
    },
    "IEEE Spectrum Robotics": {
        "url": "https://spectrum.ieee.org/feeds/topic/robotics.rss",
        "type": "rss",
        "interest_id": "robotics",
    },
    "TechCrunch Robotics": {
        "url": "https://techcrunch.com/category/robotics/feed/",
        "type": "rss",
        "interest_id": "robotics",
    },
    "Waymo Blog": {
        "url": "https://waymo.com/blog/rss.xml",
        "type": "rss",
        "interest_id": "robotics",
    },
    "Humanoid Robotics Technology": {
        "url": "https://humanoidroboticstechnology.com/feed/",
        "type": "rss",
        "interest_id": "robotics",
    },
    "Humanoids Daily": {
        "url": "https://www.humanoidsdaily.com/feed.xml",
        "type": "rss",
        "interest_id": "robotics",
    },
    "New Atlas Robotics": {
        "url": "https://newatlas.com/robotics/index.rss",
        "type": "rss",
        "interest_id": "robotics",
    },
    "The Verge Robots": {
        "url": "https://www.theverge.com/rss/robot/index.xml",
        "type": "atom",
        "interest_id": "robotics",
    },
    "The Verge Autonomous Cars": {
        "url": "https://www.theverge.com/rss/autonomous-cars/index.xml",
        "type": "atom",
        "interest_id": "robotics",
    },
}

REJECTED_SOURCES = {
    "Cloudflare Blog",
    "NVIDIA Technical Blog",
    "Rest of World",
    # Robotics candidates that failed the check: raw preprints, SEO filler,
    # or no working feed. (Humanoids Daily was here for malformed XML; the
    # link fetcher now repairs its bare "&".)
    "arXiv cs.RO",
    "Robotics & Automation News",
    "Interesting Engineering",
    "Robotics 24/7",
}

# The lanes a source may seed. The model's classification decides the final
# lane, but a source's own lane is the fallback, so it must be a live one.
SOURCE_LANES = {"ai", "tech", "startups", "markets", "ux-design", "robotics"}


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

        self.assertTrue(all(source["interest_id"] in SOURCE_LANES for source in sources))
        self.assertGreaterEqual(
            sum(1 for source in sources if source["interest_id"] == "robotics"), 8
        )

        tldr = by_name["AI/TLDR Models"]
        self.assertEqual(tldr["url"], "https://ai-tldr.dev/feed.json")
        self.assertEqual(tldr["type"], "ai_tldr")
        self.assertEqual(tldr["interest_id"], "ai")
        self.assertIn("model", tldr["include_categories"])
        self.assertEqual(set(tldr["include_importance"]), {"seismic", "major"})

    def test_robot_report_drops_event_and_sponsor_posts_but_keeps_news(self) -> None:
        config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        excluded = {s["name"]: s for s in config["sources"]}["The Robot Report"]["exclude_title_keywords"]
        for promo in (
            "A guide to Day 1 of RoboBusiness 2026",
            "2027 TRR50 Robotics Innovation Awards open nominations",
            "How to choose a BLDC motor for robotic arms and mobile robots",
        ):
            self.assertTrue(_title_has_excluded_keywords(promo, excluded), promo)
        for news in (
            "Gecko Robotics secures $300M contract with the U.S. Navy",
            "Stryker invests $400M into CMR Surgical",
            # "awards" as a verb is contract news, not the outlet's own prize.
            "U.S. Army awards Anduril $99M contract for autonomous ground robots",
        ):
            self.assertFalse(_title_has_excluded_keywords(news, excluded), news)

    def test_parser_repairs_a_bare_ampersand_but_not_a_broken_feed(self) -> None:
        rss = (
            "<rss><channel><item><title>Q&amp;A &#38; more</title>"
            "<link>https://example.com/a</link><category>FM&M</category></item></channel></rss>"
        )
        items = _extract_from_rss_or_atom(rss, "https://example.com/feed.xml")
        self.assertEqual([(i["url"], i["title"]) for i in items], [("https://example.com/a", "Q&A & more")])
        self.assertEqual(_extract_from_rss_or_atom("<rss><item>broken<</rss>", "https://example.com/"), [])

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

    def test_video_and_podcast_pages_are_filtered(self) -> None:
        store = MemoryPoolStore()
        source = {
            "name": "Video Feed",
            "url": "https://video.example/feed.xml",
            "type": "rss",
            "interest_id": "markets",
            "source_weight": 1.0,
        }
        config = {"max_age_hours": 12, "discovery": {"enabled": False}, "sources": [source]}

        def _fetch(url: str, limit: int) -> ExtractResult:
            del limit
            return ExtractResult(
                source_url=url,
                source_type="rss",
                articles=[
                    {
                        "url": "https://video.example/news/videos/2026/09/agentic-ai",
                        "title": "Scientist on safety issues with agentic AI",
                        "published_date": "2026-07-23T18:40:38+00:00",
                        "og_image": "",
                    },
                    {
                        "url": "https://video.example/posts/real-story",
                        "title": "Real market story",
                        "published_date": "2026-07-23T18:40:38+00:00",
                        "og_image": "",
                    },
                ],
            )

        with (
            patch("v3.build_trending.fetch_article_links", side_effect=_fetch),
            patch(
                "v3.build_trending.fetch_content",
                return_value={"content": "Substantive content. " * 40, "image": "", "source": "http"},
            ),
        ):
            stats = refresh_pool(store, config, limit_per_source=5)

        self.assertEqual(stats["new_items"], 1)
        self.assertEqual(stats["filtered"], 1)
        self.assertIn("https://video.example/posts/real-story", store.items)
        self.assertNotIn("https://video.example/news/videos/2026/09/agentic-ai", store.items)

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
