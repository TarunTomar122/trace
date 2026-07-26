import unittest
from unittest.mock import patch

from v2.flows import send_unified_newsletter as newsletter
from v2.flows.send_unified_newsletter import (
    EMAIL_TEMPLATE,
    _generate_html,
    _is_targeted_delivery,
)


SAMPLE_STORIES = [
    {
        "title": "A <script> test title",
        "url": "https://www.yourtrace.online/articles/tr_example",
        "body": "A concrete thing changed. This is why the reader should care.",
        "image_url": "https://images.example.com/story.jpg",
    }
]


class UnifiedNewsletterRenderTests(unittest.TestCase):
    def test_official_pulse_template_renders_a_safe_story(self):
        self.assertEqual(EMAIL_TEMPLATE, "daily_pulse_newsletter.html")
        html = _generate_html(
            "2026-07-23",
            "A concise overview of the day.",
            SAMPLE_STORIES,
            "See you tomorrow.",
        )
        self.assertIn('href="https://www.yourtrace.online/articles/tr_example"', html)
        self.assertNotIn("Open in Trace", html)
        self.assertIn("A &lt;script&gt; test title", html)
        self.assertNotIn("A <script> test title", html)

    def test_targeted_delivery_never_advances_the_campaign(self):
        self.assertTrue(_is_targeted_delivery("preview@example.com", ""))
        self.assertTrue(_is_targeted_delivery("", "a-user-id"))
        self.assertFalse(_is_targeted_delivery("", ""))

    def test_direct_preview_does_not_mutate_the_campaign_document(self):
        class FakeDocument:
            exists = True

            def __init__(self):
                self.set_calls = []

            def to_dict(self):
                return {
                    "status": "sent",
                    "email_subject": "Existing subject",
                    "intro": "An overview.",
                    "stories": SAMPLE_STORIES,
                }

            def get(self):
                return self

            def set(self, *args, **kwargs):
                self.set_calls.append((args, kwargs))

        class FakeCollection:
            def __init__(self, document):
                self.document_value = document

            def document(self, _date):
                return self.document_value

        class FakeStore:
            def __init__(self, document):
                self.db = type("Db", (), {"collection": lambda _, __: FakeCollection(document)})()

        document = FakeDocument()
        sent_subjects = []
        with patch.object(newsletter, "FirestoreStore", return_value=FakeStore(document)), patch.object(
            newsletter,
            "send_newsletter_email",
            side_effect=lambda **kwargs: sent_subjects.append(kwargs["subject"]) or {"success": True},
        ):
            result = newsletter.send_unified_newsletter(
                date="2026-07-23",
                to_email="preview@example.com",
            )

        self.assertTrue(result["success"])
        self.assertTrue(result["targeted_delivery"])
        self.assertEqual(document.set_calls, [])
        self.assertEqual(sent_subjects, ["[Preview] Existing subject"])


if __name__ == "__main__":
    unittest.main()
