"""Transport choice in v1.tools.email_sender.send_email when the local MTA is down."""

import email
import email.policy
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


class AttachmentTests(unittest.TestCase):
    FILES = [("cover-1.jpg", b"\xff\xd8jpeg-bytes", "image/jpeg")]

    def test_local_mta_sends_attachments(self):
        sent = {}

        class FakeSMTP:
            def __init__(self, *_args, **_kwargs):
                pass

            def __enter__(self):
                return self

            def __exit__(self, *_exc):
                return False

            def ehlo(self):
                pass

            def starttls(self):
                pass

            def sendmail(self, _from, _to, raw):
                sent["raw"] = raw

        with patch.object(email_sender, "transport_mode", return_value="smtp"), \
                patch.object(email_sender, "_mta_reachable", return_value=True), \
                patch.object(email_sender, "_dkim_sign", side_effect=lambda raw, _headers: (raw, "off")), \
                patch.object(email_sender, "_record_send"), \
                patch.object(email_sender.smtplib, "SMTP", FakeSMTP):
            result = email_sender.send_email("me@yourtrace.online", None, "Kit", "<p>Kit</p>", "Kit",
                                             bucket="post_kit", attachments=self.FILES)
        self.assertTrue(result["success"])
        message = email.message_from_bytes(sent["raw"], policy=email.policy.default)
        [part] = list(message.iter_attachments())
        self.assertEqual((part.get_filename(), part.get_content_type()), ("cover-1.jpg", "image/jpeg"))
        self.assertEqual(part.get_content(), b"\xff\xd8jpeg-bytes")
        self.assertEqual(message.get_body(("html",)).get_content().strip(), "<p>Kit</p>")

    def test_brevo_gets_the_attachments_and_its_own_tag(self):
        with patch.object(email_sender, "transport_mode", return_value="brevo"), \
                patch.object(email_sender, "brevo_route_reason", return_value=""), \
                patch.object(email_sender, "_record_send"), \
                patch.object(email_sender, "brevo_send_email", return_value={"success": True}) as brevo:
            email_sender.send_email("me@yourtrace.online", None, "Kit", "<p>Kit</p>", bucket="post_kit",
                                    attachments=self.FILES)
        self.assertEqual(brevo.call_args.kwargs["attachments"], self.FILES)
        self.assertEqual(brevo.call_args.kwargs["tags"], ["post_kit"])


if __name__ == "__main__":
    unittest.main()
