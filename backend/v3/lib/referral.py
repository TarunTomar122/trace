"""Readers bring readers: each one's personal share link and how many signed up through it.

A reader's code is the first 8 characters of an HMAC of their email under REFERRAL_SECRET, so it
never shows the address, needs no stored state, and the email, the signup route and the admin
snapshot all agree on it. The site stores the code a newcomer arrived with as `referredBy` on
their subscriber or account record (frontend lib/first-touch.ts).
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import os
from typing import Any

CODE_LENGTH = 8
COLLECTIONS = ("free_newsletter_subscribers", "user_profiles")


def code_for(email: str, secret: str | None = None) -> str:
    """The reader's referral code (8 of a-z, 2-7), or "" without REFERRAL_SECRET or an email."""
    secret = os.getenv("REFERRAL_SECRET", "") if secret is None else secret
    email = (email or "").strip().lower()
    if not secret or not email:
        return ""
    digest = hmac.new(secret.encode(), email.encode(), hashlib.sha256).digest()
    return base64.b32encode(digest).decode().lower()[:CODE_LENGTH]


def counts(store: Any, secret: str | None = None) -> dict[str, int]:
    """Signups credited to each code, one per person (by email), never the code's own reader.
    A person on the newsletter list is credited by that record alone, so a reader who later makes
    an account through someone's link isn't counted as joining (admin snapshot: same rule). Best
    effort: an unreadable collection counts nothing."""
    people: dict[str, str] = {}
    for name in COLLECTIONS:
        try:
            for doc in store.db.collection(name).stream():
                data = doc.to_dict() or {}
                email = str(data.get("email") or "").strip().lower()
                if email and email not in people:
                    people[email] = str(data.get("referredBy") or "").strip().lower()
        except Exception:  # noqa: BLE001 - the email goes out without the count
            continue
    out: dict[str, int] = {}
    for email, ref in people.items():
        if len(ref) == CODE_LENGTH and code_for(email, secret) != ref:
            out[ref] = out.get(ref, 0) + 1
    return out
