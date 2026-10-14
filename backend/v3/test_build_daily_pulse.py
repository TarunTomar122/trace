import unittest
import json
from pathlib import Path
from unittest.mock import patch
from types import SimpleNamespace

from v3.build_daily_pulse import (
    COMPACT_SUMMARY_MAX_WORDS,
    ROLE_ORDER,
    _builder_focus_score,
    _freshness_score,
    _item_payload,
    _normalize_item_summary,
    _normalize_summary_payload,
    _summarize_item,
    _summary_instructions,
    _write_shared_pulse,
)


class DailyPulseSummaryTest(unittest.TestCase):
    def test_tools_and_discussions_are_one_short_sentence(self) -> None:
        long_text = " ".join(f"word{i}" for i in range(40)) + "."
        multi_sentence = "A compact summary. A second sentence must not survive."

        for section in ("tools", "discussions"):
            summary = _normalize_item_summary(section, long_text)
            self.assertLessEqual(len(summary.split()), COMPACT_SUMMARY_MAX_WORDS)
            self.assertEqual(_normalize_item_summary(section, multi_sentence), "A compact summary.")

    def test_blog_detail_is_not_compacted(self) -> None:
        text = "First detailed paragraph.\n\nSecond detailed paragraph."
        self.assertEqual(_normalize_item_summary("blogs", text), text)

    def test_blog_prompt_requires_replacement_brief_and_takeaways(self) -> None:
        prompt = _summary_instructions("blogs")
        self.assertIn("replacement brief", prompt)
        self.assertIn("numbers, evidence, constraints", prompt)
        self.assertIn("key_takeaways array", prompt)
        self.assertIn("does not support", prompt)

    def test_flattened_blog_takeaways_are_structured(self) -> None:
        summary = _normalize_summary_payload(
            "blogs",
            "Concrete brief.\n\nKey takeaways: - First lesson. - Second lesson.",
        )
        self.assertEqual(summary["body"], "Concrete brief.")
        self.assertEqual(summary["key_takeaways"], ["First lesson.", "Second lesson."])

    def test_builder_focus_prefers_ai_engineering_over_sales_content(self) -> None:
        ai_score = _builder_focus_score({
            "title": "Claude coding agents improve TypeScript workflows",
            "snippet": "An open source developer tool.",
        })
        sales_score = _builder_focus_score({
            "title": "Warm prospects before sales outreach",
            "snippet": "AI lead generation for marketing teams.",
        })
        self.assertGreater(ai_score, sales_score)

    @patch("v3.build_daily_pulse.datetime")
    def test_freshness_prefers_current_items(self, datetime_mock) -> None:
        datetime_mock.now.return_value = __import__("datetime").datetime(
            2026, 7, 27, tzinfo=__import__("datetime").timezone.utc
        )
        datetime_mock.fromisoformat.side_effect = __import__("datetime").datetime.fromisoformat
        self.assertGreater(
            _freshness_score({"published_date": "2026-07-27T00:00:00+00:00"}),
            _freshness_score({"published_date": "2026-05-20T00:00:00+00:00"}),
        )
        self.assertEqual(
            _freshness_score({"published_date": "Mon, 27 Jul 2026 05:40:48 -0500"}),
            30,
        )

    def test_creator_sources_are_in_developer_sources(self) -> None:
        config = json.loads(
            (Path(__file__).parent / "config" / "brief_sources.json").read_text()
        )
        sources = config["rss"]["developer"]
        by_name = {source["name"]: source for source in sources}
        theo = by_name["Theo - t3.gg"]
        self.assertEqual(
            theo["url"],
            "https://www.youtube.com/feeds/videos.xml?channel_id=UCbRP3c757lWg9M-U7TyEkXA",
        )
        self.assertTrue(
            {
                "Fireship",
                "AI Explained",
                "AI Engineer",
                "Latent Space",
                "Eugene Yan",
                "Hugging Face",
                "Hamel's Blog",
            }
            <= by_name.keys()
        )
        self.assertNotIn("GitHub Changelog", by_name)
        self.assertNotIn("Changelog News", by_name)

    @patch.dict("os.environ", {"OPENAI_API_KEY": "test-key"})
    @patch("v3.build_daily_pulse.fetch_content", return_value={"content": ""})
    @patch("v3.build_daily_pulse.OpenAI")
    def test_video_summary_uses_official_description(self, openai, _fetch_content) -> None:
        response = SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(
                content='{"body":"A grounded video brief.","key_takeaways":["One supported takeaway.","Another supported takeaway."]}',
            ))]
        )
        openai.return_value.chat.completions.create.return_value = response

        class Store:
            def get_cached_summary_v2(self, *_):
                return None
            def save_cached_summary_v2(self, *_):
                pass

        summary = _summarize_item(
            Store(),
            "2026-07-27",
            "developer",
            "blogs",
            {
                "title": "A new AI model",
                "source": "AI Explained",
                "url": "https://www.youtube.com/watch?v=test",
                "snippet": "The official description explains the model release, its benchmark results, and its practical limits. " * 2,
            },
        )
        self.assertEqual(summary["body"], "A grounded video brief.")
        self.assertEqual(len(summary["key_takeaways"]), 2)

    @patch.dict("os.environ", {"OPENAI_API_KEY": "test-key"})
    @patch("v3.build_daily_pulse.fetch_content")
    @patch("v3.build_daily_pulse.OpenAI")
    def test_blog_summary_uses_extracted_article_content(self, openai, fetch_content) -> None:
        fetch_content.return_value = {"content": "Concrete source fact. " * 80}
        response = SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(
                content='{"body":"Grounded brief.","key_takeaways":["Specific lesson."]}',
            ))]
        )
        openai.return_value.chat.completions.create.return_value = response

        class Store:
            def get_cached_summary_v2(self, *_):
                return None
            def save_cached_summary_v2(self, *_):
                pass

        summary = _summarize_item(
            Store(),
            "2026-07-27",
            "developer",
            "blogs",
            {"title": "Test", "source": "Source", "url": "https://example.com"},
        )

        self.assertEqual(summary, {
            "body": "Grounded brief.",
            "key_takeaways": ["Specific lesson."],
        })
        prompt = openai.return_value.chat.completions.create.call_args.kwargs["messages"][1]["content"]
        self.assertIn("Article text excerpt: Concrete source fact.", prompt)
        schema = openai.return_value.chat.completions.create.call_args.kwargs["response_format"]["json_schema"]["schema"]
        self.assertEqual(schema["properties"]["key_takeaways"]["minItems"], 2)

    @patch("v3.build_daily_pulse._summarize_item", return_value={"body": "One line.", "key_takeaways": []})
    def test_items_keep_the_hacker_news_submitter(self, _summarize) -> None:
        article = {"title": "A post", "url": "https://a.dev/post", "source": "Hacker News", "signal": "300 points",
                   "thumbnail": "https://a.dev/img.png", "by": "jane"}
        self.assertEqual(_item_payload(None, "2026-10-14", "developer", "discussions", article)["by"], "jane")
        self.assertEqual(_item_payload(None, "2026-10-14", "developer", "discussions", {**article, "by": None})["by"], "")

    def test_shared_pulse_keeps_legacy_mobile_role_buckets(self) -> None:
        writes = []

        class Store:
            def write_global_role_digests(self, date, section, payloads, metadata_by_role):
                writes.append((date, section, payloads, metadata_by_role))

        payload = {"tools": [{"id": "tool"}], "blogs": [], "discussions": []}
        _write_shared_pulse(Store(), "2026-07-27", payload, {"shared": True})

        self.assertEqual(len(writes), 1)
        self.assertEqual(list(writes[0][2]), list(ROLE_ORDER))
        self.assertTrue(all(role_payload is payload for role_payload in writes[0][2].values()))
        self.assertTrue(all(metadata["shared"] for metadata in writes[0][3].values()))


if __name__ == "__main__":
    unittest.main()
