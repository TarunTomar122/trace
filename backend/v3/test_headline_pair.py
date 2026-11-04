"""Headline and summary are written as one pair, and the email shows both.

The summary under a headline must add to it, not restate it. The trending
prompts say so, gpt-6-luna writes them (gpt-4o-mini kept restating), and the
feed and the daily email show our own headline above the short card summary.

  python3 -m v3.test_headline_pair
"""

from __future__ import annotations

import json
import unittest
from unittest.mock import MagicMock, patch

import v3.build_trending as B
import v3.flows.send_audience_newsletter as N
import v3.lib.summarizer as S


def _reply(payload: dict) -> MagicMock:
    reply = MagicMock()
    reply.usage = None
    reply.choices = [MagicMock()]
    reply.choices[0].message.content = json.dumps(payload)
    return reply


BRIEF = {
    "rejected": False,
    "interest_id": "ai",
    "short_article": {
        "headline": "Meituan launches LongCat-2.5 for long coding tasks",
        "subtitle": "A 1.6-trillion-parameter coding model.",
        "body": "It has 1.6 trillion parameters. It is on Meituan's API now.",
        "mobile_card_summary": "It has 1.6 trillion parameters, 48 billion active. It is on the API now.",
    },
}


class SummarizerModelTests(unittest.TestCase):
    def summarize(self, feed_type: str, output_format: str = ""):
        client = MagicMock()
        client.chat.completions.create.return_value = _reply(BRIEF)
        with patch.object(S, "_get_client", return_value=client):
            summary, error = S.generate_summary(
                "Meituan launches LongCat-2.5 multimodal AI model for extended coding tasks",
                "https://e.com/a", "Article text.", feed_type=feed_type, output_format=output_format,
            )
        return summary, error, client.chat.completions.create.call_args.kwargs

    def test_trending_uses_luna_with_low_effort_and_no_temperature(self):
        summary, error, kwargs = self.summarize("trending")
        self.assertEqual(error, "")
        self.assertEqual(kwargs["model"], "gpt-6-luna")
        self.assertEqual(kwargs["reasoning_effort"], "low")
        self.assertNotIn("temperature", kwargs)
        self.assertEqual(summary["short_article"]["headline"], BRIEF["short_article"]["headline"])

    def test_trending_prompt_asks_for_a_pair_and_always_a_card(self):
        _, _, kwargs = self.summarize("trending")
        prompt = kwargs["messages"][1]["content"]
        self.assertIn("HEADLINE AND SUMMARY ARE ONE PAIR", prompt)
        self.assertIn("Never restate the headline", prompt)
        # The gate suffix repeats the JSON shape; the card must be in it too,
        # or the model drops it (7 of 27 stories had none on 2026-11-02).
        suffix = prompt[prompt.rindex('"rejected": <true|false>'):]
        self.assertIn('"mobile_card_summary"', suffix)

    def test_other_feeds_keep_their_models(self):
        _, _, for_you = self.summarize("for_you")
        self.assertEqual(for_you["model"], S.FOR_YOU_PROSE_MODEL)
        self.assertNotIn("temperature", for_you)
        self.assertNotIn("reasoning_effort", for_you)
        _, _, deep = self.summarize("deep_dives")
        self.assertEqual(deep["model"], S.MODEL)
        self.assertEqual(deep["temperature"], S.TEMPERATURE)

    def test_a_non_reasoning_rollback_model_gets_a_temperature(self):
        self.assertEqual(S.trending_request_tuning("gpt-4o-mini"), {"temperature": S.TEMPERATURE})
        self.assertEqual(S.trending_request_tuning("gpt-6-luna"), {"reasoning_effort": "low"})

    def test_cache_records_the_model_that_wrote_it(self):
        self.assertEqual(S._summary_model("trending"), "gpt-6-luna")
        self.assertEqual(S._summary_model("for_you"), S.FOR_YOU_PROSE_MODEL)
        self.assertEqual(S._summary_model("deep_dives"), S.MODEL)
        self.assertEqual(S._summary_model("for_you", "cards"), S.MODEL)


class _Mem:
    def __init__(self):
        self.cache = {}

    def get_cached_synthesis(self, key):
        return self.cache.get(key)

    def cache_synthesis(self, key, value):
        self.cache[key] = value


def _item(title, url):
    return {"title": title, "url": url, "source_name": "S", "published_date": "2026-11-02T07:00:00+00:00"}


LEAD = _item("Publisher's long original title for the story", "https://a.example/1")
OTHER = _item("Another outlet's title", "https://b.example/2")
SUMMARIES = {
    LEAD["url"]: {"short_article": {"headline": "Our own headline", "body": "The lead's body."}},
}


class TopicPairTests(unittest.TestCase):
    def test_overview_uses_luna_and_asks_for_a_pair(self):
        client = MagicMock()
        client.chat.completions.create.return_value = _reply(
            {"title": "T", "overview": "New detail. Another."}
        )
        timeline = B._build_topic_timeline("tt_x", [LEAD, OTHER], SUMMARIES)
        with patch("openai.OpenAI", return_value=client):
            title, overview, _ = B._build_topic_overview(
                _Mem(), "tt_x", LEAD["title"], [LEAD, OTHER], timeline, SUMMARIES
            )
        kwargs = client.chat.completions.create.call_args.kwargs
        self.assertEqual(kwargs["model"], "gpt-6-luna")
        self.assertEqual(kwargs["reasoning_effort"], "low")
        self.assertNotIn("temperature", kwargs)
        self.assertIn("never restate the title", kwargs["messages"][1]["content"])
        self.assertNotIn("key_points", kwargs["messages"][1]["content"])
        self.assertEqual((title, overview), ("T", "New detail. Another."))

    def test_fallback_pairs_the_lead_summary_with_its_own_headline(self):
        client = MagicMock()
        client.chat.completions.create.side_effect = RuntimeError("down")
        timeline = B._build_topic_timeline("tt_x", [LEAD, OTHER], SUMMARIES)
        with patch("openai.OpenAI", return_value=client):
            title, overview, cached = B._build_topic_overview(
                _Mem(), "tt_x", LEAD["title"], [LEAD, OTHER], timeline, SUMMARIES
            )
        self.assertEqual((title, overview, cached), ("Our own headline", "The lead's body.", False))

    def test_fallback_without_a_lead_summary_keeps_the_fallback_title(self):
        title, overview, _ = B._build_topic_overview(_Mem(), "tt_x", "Fallback", [OTHER], [], {})
        self.assertEqual((title, overview), ("Fallback", ""))

    def test_singleton_shows_our_headline(self):
        title, overview, _ = B._build_singleton_topic_overview(LEAD, "fallback", SUMMARIES)
        self.assertEqual((title, overview), ("Our own headline", "The lead's body."))
        title, _, _ = B._build_singleton_topic_overview(OTHER, "fallback", SUMMARIES)
        self.assertEqual(title, OTHER["title"])


def _row(url, title, short):
    return {"url": url, "title": title, "interest_id": "ai", "summary": {"short_article": short}}


class EmailPairTests(unittest.TestCase):
    def test_row_shows_our_headline_and_the_card(self):
        feed = {"trending": [_row("https://e.com/r", "Publisher title", BRIEF["short_article"])]}
        cand = N._candidates(feed)[0]
        self.assertEqual(cand["title"], "Meituan launches LongCat-2.5 for long coding tasks")
        self.assertEqual(cand["brief"], BRIEF["short_article"]["mobile_card_summary"])
        # The judge and the repeat check still read the full summary.
        self.assertIn("1.6 trillion parameters", cand["summary"])

    def test_row_without_our_headline_keeps_the_publisher_title(self):
        feed = {"trending": [_row("https://e.com/r", "Publisher title", {"body": "One. Two."})]}
        self.assertEqual(N._candidates(feed)[0]["title"], "Publisher title")

    def topic(self, title, articles):
        return {
            "id": "tt_1", "title": title, "interest_id": "ai",
            "summary": "The overview's first sentence adds a detail. A second one adds more. "
                       "A third would run past the brief's length limit for sure.",
            "articles": articles,
        }

    def test_one_article_topic_brief_is_the_lead_card(self):
        lead = {"url": "https://e.com/t", "title": "T", "summary": BRIEF}
        cand = N._candidates({"trending_topics": [self.topic("Our topic title", [lead])]})[0]
        self.assertEqual(cand["title"], "Our topic title")
        self.assertEqual(cand["brief"], BRIEF["short_article"]["mobile_card_summary"])

    def test_multi_article_topic_brief_is_its_own_overview(self):
        # The lead card was written for the lead's headline, not this title.
        articles = [{"url": "https://e.com/t", "title": "T", "summary": BRIEF},
                    {"url": "https://f.com/u", "title": "U"}]
        cand = N._candidates({"trending_topics": [self.topic("Chinese labs race to ship coding models", articles)]})[0]
        self.assertTrue(cand["brief"].startswith("The overview's first sentence"))
        self.assertNotIn("48 billion", cand["brief"])
        # A topic falling back to its lead shows the lead's headline: its card pairs.
        same = self.topic(BRIEF["short_article"]["headline"], articles)
        self.assertEqual(N._candidates({"trending_topics": [same]})[0]["brief"],
                         BRIEF["short_article"]["mobile_card_summary"])

    def test_same_publisher_title_still_merges_and_repeats(self):
        a = _row("https://e.com/a", "Wire: Acme raises $5M", {"headline": "Acme raises $5M for robots", "body": "One."})
        b = _row("https://f.com/b", "Wire: Acme raises $5M", {"headline": "Robot startup Acme lands $5M", "body": "Two."})
        groups = N._story_groups({"trending": [a, b]})
        self.assertEqual(len(groups), 1)
        self.assertEqual(sorted(groups[0]["urls"]), ["https://e.com/a", "https://f.com/b"])
        # Yesterday's daily carried it under the publisher's title (before this change).
        sent = {"title": "Wire: Acme raises $5M", "url": "https://old.com/x"}
        index = N._repeat_index([sent])
        self.assertIs(N._sure_repeat(N._candidates({"trending": [a]})[0], index), sent)

    def test_model_release_reads_the_publisher_title_and_rollout_verbs(self):
        # Our reworded headline lost "models"; the publisher's title still says it.
        row = _row("https://e.com/g", "Google launches Gemini 4 Argon and Carbon AI models",
                   {"headline": "Google tests Carbon with cyber defenders", "body": "The AI models are in testing."})
        self.assertTrue(N._candidates({"trending": [row]})[0]["model_release"])
        self.assertTrue(B._looks_like_model_release(
            "Google rolls out Gemini 4 Argon", "", "An AI model for coding."))
        self.assertFalse(N._model_release(("Judge lets NAACP case against xAI proceed",), "", "A lawsuit."))

    def test_brief_falls_back_to_whole_sentences(self):
        long_card = "word " * 70
        full = "First sentence has five words. " * 20
        brief = N._brief(long_card.strip(), full)
        self.assertTrue(brief.endswith("."))
        self.assertLessEqual(len(brief.split()), N.BRIEF_WORDS)
        # One sentence is always kept, however long.
        self.assertEqual(N._brief("", "x " * 80 + "end."), ("x " * 80 + "end."))

    def test_email_web_edition_and_pool_show_the_brief(self):
        story = {
            "title": "Headline", "summary": "Full one. Full two. Full three.", "brief": "Short.",
            "url": "https://e.com/a", "source_name": "S", "sources": ["e.com"], "source_count": 1,
        }
        _, html, text = N._render("member", [("ai", [dict(story)])], "2026-11-02", "r@x.com", "tid")
        self.assertIn(">Short.</p>", html)
        self.assertNotIn("Full two", html)
        self.assertIn("   Short.", text)
        self.assertEqual(N._web_story(story, "ai")["summary"], "Short.")
        # No brief (an old feed doc): the full summary, as before.
        self.assertEqual(N._shown_summary({"summary": "Full."}), "Full.")


class PulsePairTests(unittest.TestCase):
    def test_pulse_prompts_carry_the_pair_rule(self):
        import v3.build_daily_pulse as P
        for section in ("tools", "discussions", "blogs", "top_articles"):
            self.assertIn("Never restate or reword the title", P._summary_instructions(section))
        self.assertEqual(P.ITEM_SUMMARY_MODEL, S.TRENDING_MODEL)

    def test_pulse_fallback_never_restates_the_title(self):
        import v3.build_daily_pulse as P
        for section in ("tools", "blogs", "discussions"):
            self.assertEqual(P._fallback_summary(section, {"title": "Redbean", "source": "HN"}), "")
        # A real snippet is still used.
        self.assertTrue(P._fallback_summary("blogs", {"title": "T", "source": "S", "snippet": "A real description of it."}))

    def test_pulse_item_with_only_a_title_gets_no_line_and_no_call(self):
        import v3.build_daily_pulse as P
        store = MagicMock()
        store.get_cached_summary_v2.return_value = None
        with patch.dict("os.environ", {"OPENAI_API_KEY": "k"}), \
                patch.object(P, "fetch_content", return_value={}), patch.object(P, "OpenAI") as client:
            out = P._summarize_item(store, "2026-11-02", "developer", "tools", {"title": "Foo", "url": "https://e.com"})
        self.assertEqual(out["body"], "")
        client.assert_not_called()

    def test_every_summary_prompt_says_the_headline_is_above(self):
        self.assertIn("never restate or reword the headline", S.SUMMARY_SYSTEM_PROMPT)
        self.assertNotIn("Start with the core idea", S.FOR_YOU_SUMMARY)


if __name__ == "__main__":
    unittest.main()
