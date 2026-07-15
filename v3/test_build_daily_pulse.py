import unittest

from v3.build_daily_pulse import COMPACT_SUMMARY_MAX_WORDS, _normalize_item_summary


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


if __name__ == "__main__":
    unittest.main()
