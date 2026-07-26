import unittest

from v1.newsletter_preferences import is_newsletter_enabled
from v3.scheduler import JOBS


class NewsletterPreferenceTests(unittest.TestCase):
    def test_daily_newsletter_requires_explicit_opt_in(self):
        self.assertFalse(is_newsletter_enabled({}))
        self.assertFalse(is_newsletter_enabled({"dailyNewsletterEnabled": False}))
        self.assertTrue(is_newsletter_enabled({"dailyNewsletterEnabled": True}))

    def test_legacy_explicit_opt_in_remains_valid(self):
        self.assertTrue(is_newsletter_enabled({"newsletterOptIn": True}))
        self.assertFalse(is_newsletter_enabled({"newsletterOptIn": False}))
        self.assertFalse(is_newsletter_enabled({
            "newsletterOptIn": True,
            "dailyNewsletterEnabled": False,
        }))

    def test_scheduler_uses_personalized_newsletter_sender(self):
        self.assertEqual(
            JOBS["newsletter_send"]["module"],
            "v3.flows.send_three_feed_newsletter",
        )


if __name__ == "__main__":
    unittest.main()
