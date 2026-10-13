"""Transport choice in v1.tools.email_sender.send_email when the local MTA is down."""

import unittest
from unittest.mock import patch

from v1.tools import email_sender


class MtaDownTests(unittest.TestCase):
    def send(self, mode, brevo_ok):
        with patch.object(email_sender, "transport_mode", return_value=mode), \
                patch.object(email_sender, "brevo_route_reason", return_value=""), \
                patch.object(email_sender, "brevo_can_send", return_value=brevo_ok), \
                patch.object(email_sender, "_mta_reachable", return_value=False), \
                patch.object(email_sender, "_record_send") as record, \
                patch.object(email_sender, "brevo_send_email", return_value={"success": True, "message_id": "m"}) as brevo:
            result = email_sender.send_email("reader@gmail.com", None, "Hi", "<p>Hi</p>", "Hi", bucket="welcome")
        return result, brevo, record

    def test_auto_without_brevo_fails_loudly(self):
        result, brevo, record = self.send("auto", brevo_ok=False)
        self.assertFalse(result["success"])
        brevo.assert_not_called()
        self.assertEqual(record.call_args.kwargs["status"], "failed")

    def test_strict_smtp_never_falls_back_to_brevo(self):
        result, brevo, _ = self.send("smtp", brevo_ok=True)
        self.assertFalse(result["success"])
        brevo.assert_not_called()

    def test_auto_with_brevo_still_falls_back(self):
        result, brevo, _ = self.send("auto", brevo_ok=True)
        self.assertTrue(result["success"])
        self.assertEqual(result["transport"], "brevo")
        self.assertEqual(brevo.call_args.kwargs["tags"], ["welcome"])


if __name__ == "__main__":
    unittest.main()
