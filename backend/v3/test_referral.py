import os
import unittest
from unittest.mock import patch

from datetime import datetime, timezone

from v3.flows import send_audience_newsletter as N
from v3.flows import send_welcome as W
from v3.lib import referral as R
from v3.test_audience_winback import STORY, TODAY


class _Doc:
    def __init__(self, data):
        self._data = data

    def to_dict(self):
        return self._data


class _Store:
    def __init__(self, collections):
        self.db = self
        self._collections = collections

    def collection(self, name):
        self._name = name
        return self

    def stream(self):
        if self._name not in self._collections:
            raise RuntimeError("unreadable")
        return [_Doc(d) for d in self._collections[self._name]]


class CodeTests(unittest.TestCase):
    def test_code_is_stable_short_and_needs_the_secret(self):
        one = R.code_for("Reader@Example.com ", "s3cret")
        self.assertEqual(one, R.code_for("reader@example.com", "s3cret"))
        self.assertRegex(one, r"^[a-z2-7]{8}$")
        self.assertNotEqual(one, R.code_for("reader@example.com", "other"))
        self.assertEqual(R.code_for("reader@example.com", ""), "")
        self.assertEqual(R.code_for("", "s3cret"), "")

    def test_counts_people_once_and_never_the_reader_themselves(self):
        code = R.code_for("a@x.com", "k")
        store = _Store({
            "free_newsletter_subscribers": [
                {"email": "b@x.com", "referredBy": code},
                {"email": "c@x.com", "referredBy": code.upper()},
                {"email": "a@x.com", "referredBy": code},   # their own link
                {"email": "d@x.com", "referredBy": "short"},  # not a code
                {"email": "e@x.com"},
            ],
            # The same person signing up for an account too counts once; profiles aren't readable here.
        })
        self.assertEqual(R.counts(store, "k"), {code: 2})
        store._collections["user_profiles"] = [{"email": "b@x.com", "referredBy": code},
                                               {"email": "f@x.com", "referredBy": code},
                                               {"email": "e@x.com", "referredBy": code}]  # already a reader
        self.assertEqual(R.counts(store, "k"), {code: 3})


class EmailTests(unittest.TestCase):
    def render(self, referred=0):
        return N._render("landing", [("ai", [dict(STORY)])], TODAY, "r@x.com", "", referred=referred)

    def test_each_reader_gets_their_own_link_and_share_credit(self):
        with patch.dict(os.environ, {"REFERRAL_SECRET": "k"}):
            code = R.code_for("r@x.com")
            _, html, text = self.render()
            self.assertIn(f"/r/{code}", html)
            self.assertIn(f"from=email-share&via={code}", html)
            self.assertIn(f"/r/{code}", text)
            self.assertIn(f"&via={code}", text)
            self.assertNotIn("joined through your link", html)
            self.assertIn("2 people have joined through your link. Thank you.", self.render(2)[1])
            self.assertIn("1 person has joined through your link.", self.render(1)[2])

    def test_no_secret_no_referral_block(self):
        with patch.dict(os.environ, {"REFERRAL_SECRET": ""}):
            _, html, text = self.render(3)
            self.assertNotIn("/r/", html)
            self.assertNotIn("REFER", html)
            self.assertNotIn("Send them your link", text)


class WelcomeTests(unittest.TestCase):
    def test_welcome_carries_the_link_for_both_kinds(self):
        now = datetime(2026, 11, 22, 9, tzinfo=timezone.utc)
        with patch.dict(os.environ, {"REFERRAL_SECRET": "k"}):
            code = R.code_for("w@x.com")
            for kind in ("newsletter", "account"):
                _, page, text = W.render({"email": "w@x.com", "name": "", "kind": kind, "joined": now}, now)
                self.assertIn(f"/r/{code}", page, kind)
                self.assertIn(f"Send them your link: {W.APP_URL}/r/{code}", text, kind)
        with patch.dict(os.environ, {"REFERRAL_SECRET": ""}):
            self.assertNotIn("/r/", W.render({"email": "w@x.com", "name": "", "kind": "newsletter", "joined": now}, now)[1])


if __name__ == "__main__":
    unittest.main()
