import json
import unittest
from pathlib import Path

from v3.lib.ai_tldr import item_to_article, select_model_releases


def release(
    title: str,
    *,
    url: str = "",
    categories: list[str] | None = None,
    importance: str = "major",
    summary: str = "A new model ships.",
) -> dict:
    slug = title.lower().replace(" ", "-")
    return {
        "id": slug,
        "title": title,
        "url": url or f"https://example.com/{slug}",
        "categories": categories or ["model"],
        "importance": importance,
        "summary": summary,
        "date": "2026-09-15",
        "publishDate": "2026-09-15T12:00:00.000Z",
        "image": {"url": "https://example.com/cover.jpg"},
        "explainer": {
            "tagline": "Typed decisions instead of chat.",
            "whatIsIt": "A model that returns structured answers software can use.",
            "howItWorks": "It scores options and returns a confidence number.",
        },
        "quickFacts": [
            {"label": "Maker", "value": "TypeSafe AI"},
            {"label": "Price", "value": "$0.042 / 1M tokens"},
        ],
    }


class AiTldrSourceTests(unittest.TestCase):
    def test_keeps_major_model_launches_and_drops_noise(self) -> None:
        items = [
            release("Jev"),
            release("Bonsai 2 27B"),
            release("Needle 2"),
            release("A coding agent", categories=["tool"]),
            release("A Fireship recap", categories=["video"], importance="major"),
            release("A tiny fine-tune", importance="notable"),
            release("A leaked checkpoint", importance="rumor"),
        ]
        selected = select_model_releases(items, limit=10)
        titles = [item["title"] for item in selected]
        self.assertEqual(titles, ["Jev", "Bonsai 2 27B", "Needle 2"])

    def test_model_plus_tool_still_counts_as_a_model_release(self) -> None:
        selected = select_model_releases(
            [release("Jev", categories=["model", "tool"])],
            limit=5,
        )
        self.assertEqual(selected[0]["url"], "https://example.com/jev")
        self.assertIn("TypeSafe AI", selected[0]["description"])
        self.assertIn("structured answers", selected[0]["description"])
        self.assertTrue(selected[0]["published_date"].startswith("2026-09-15"))
        self.assertEqual(selected[0]["og_image"], "https://example.com/cover.jpg")

    def test_prefers_primary_source_url_over_tracker_page(self) -> None:
        article = item_to_article(
            release(
                "Jev",
                url="https://typesafe.ai/blog/introducing-system-one-models-and-jev",
            )
        )
        self.assertIsNotNone(article)
        assert article is not None
        self.assertEqual(
            article["url"],
            "https://typesafe.ai/blog/introducing-system-one-models-and-jev",
        )

    def test_respects_limit(self) -> None:
        items = [release(f"Model {index}") for index in range(8)]
        selected = select_model_releases(items, limit=3)
        self.assertEqual(len(selected), 3)

    def test_trending_config_points_at_the_model_json_feed(self) -> None:
        config = json.loads(
            (Path(__file__).resolve().parents[1] / "v3/config/trending_sources.json").read_text(
                encoding="utf-8"
            )
        )
        source = next(item for item in config["sources"] if item["name"] == "AI/TLDR Models")
        self.assertEqual(source["url"], "https://ai-tldr.dev/feed.json")
        self.assertEqual(source["type"], "ai_tldr")
        self.assertEqual(source["interest_id"], "ai")
        self.assertEqual(source["include_categories"], ["model"])
        self.assertEqual(set(source["include_importance"]), {"seismic", "major"})


if __name__ == "__main__":
    unittest.main()
