import unittest
from unittest.mock import patch
from types import SimpleNamespace

from v3.build_daily_pulse import (
    COMPACT_SUMMARY_MAX_WORDS,
    ROLE_ORDER,
    _blend_role_selections,
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

    def test_role_mix_keeps_builder_core_and_cross_discipline_items(self) -> None:
        primary = [{"url": f"developer-{i}"} for i in range(4)]
        secondary = [[{"url": "designer"}], [{"url": "product"}], [{"url": "founder"}]]
        mixed = _blend_role_selections(primary, secondary, 4)
        self.assertEqual([item["url"] for item in mixed], [
            "developer-0",
            "developer-1",
            "designer",
            "product",
        ])

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
