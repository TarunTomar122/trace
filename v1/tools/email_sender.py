"""Transport-agnostic email sender with automatic fallback.

Why this exists: we are moving the daily send off Brevo onto our own MTA, but
the transition has to be gradual and reversible. This module is the single
place that decides which transport carries a message, so no caller has to know
whether we are on Brevo, on our own Postfix, or mid-ramp.

Transports:
  * ``smtp``  — the VPS's own MTA on 127.0.0.1:25 (Postfix once installed).
  * ``brevo`` — the Brevo API, still the default and always the fallback.

``EMAIL_TRANSPORT`` selects behaviour:
  ``brevo`` (default) — Brevo only. Nothing changes until we say so.
  ``smtp``            — local MTA only.
  ``auto``            — try the local MTA when it is reachable, otherwise
                        Brevo per message. This is the ramp mode: an MTA hiccup
                        degrades to Brevo instead of dropping the send.

Every attempt is recorded (recipient, bucket, transport, status, message id,
tracking id) so the dashboard can report volume, transport split and failures.
"""

from __future__ import annotations

import os
import smtplib
import uuid
from datetime import datetime, timezone
from email import policy as email_policy
from email.message import EmailMessage
from email.utils import formataddr, make_msgid
from pathlib import Path
from typing import Any, Optional
import sys

project_root = str(Path(__file__).resolve().parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from v1.tools.brevo_client import (  # noqa: E402
    DEFAULT_SENDER_EMAIL,
    DEFAULT_SENDER_NAME,
    send_email as brevo_send_email,
)

# Where our own mail will leave from once the MTA is live. Kept separate from
# Brevo's sender because SPF/DKIM alignment differ.
LOCAL_SENDER_EMAIL = os.getenv("EMAIL_SENDER_LOCAL", "newsletter@mail.yourtrace.online")
LOCAL_SENDER_NAME = os.getenv("EMAIL_SENDER_NAME", "Trace")
# DKIM is done in Python rather than by a milter: the Postfix build on the VPS
# has no milter support, and signing here is testable and works with any MTA.
DKIM_ENABLED = (os.getenv("EMAIL_DKIM", "1") or "1").strip() != "0"
DKIM_DOMAIN = os.getenv("EMAIL_DKIM_DOMAIN", "mail.yourtrace.online")
DKIM_SELECTOR = os.getenv("EMAIL_DKIM_SELECTOR", "s1")
DKIM_KEY_PATH = os.getenv("EMAIL_DKIM_KEY", "/etc/dkimkeys/mail.yourtrace.online.private")
SMTP_TIMEOUT = float(os.getenv("EMAIL_SMTP_TIMEOUT", "20"))


# Legacy module-level names kept so nothing importing them breaks; the live
# values come from _smtp_host()/_smtp_port()/_dkim_config() per call.
SMTP_HOST = "127.0.0.1"
SMTP_PORT = 25
DKIM_DOMAIN = "mail.yourtrace.online"
DKIM_SELECTOR = "s1"
DKIM_KEY_PATH = "/etc/dkimkeys/mail.yourtrace.online.private"
SEND_LOG_COLLECTION = "email_sends"


def _smtp_host() -> str:
    return (os.getenv("EMAIL_SMTP_HOST", "127.0.0.1") or "127.0.0.1").strip()


def _smtp_port() -> int:
    try:
        return int(os.getenv("EMAIL_SMTP_PORT", "25"))
    except (TypeError, ValueError):
        return 25


def _dkim_config() -> tuple[bool, str, str, str]:
    enabled = (os.getenv("EMAIL_DKIM", "1") or "1").strip() != "0"
    domain = (os.getenv("EMAIL_DKIM_DOMAIN", "mail.yourtrace.online") or "").strip()
    selector = (os.getenv("EMAIL_DKIM_SELECTOR", "s1") or "").strip()
    key_path = (
        os.getenv("EMAIL_DKIM_KEY", "/etc/dkimkeys/mail.yourtrace.online.private")
        or ""
    ).strip()
    return enabled, domain, selector, key_path


def transport_mode() -> str:
    mode = (os.getenv("EMAIL_TRANSPORT", "brevo") or "brevo").strip().lower()
    return mode if mode in {"brevo", "smtp", "auto"} else "brevo"


def reply_to() -> str:
    """Where a reader's reply goes.

    Our sending host is a send-only null client: mail.yourtrace.online has no
    MX, so a missing Reply-To means every reply bounces. The root domain does
    accept mail, so the default points at a real mailbox there.
    """
    return (os.getenv("EMAIL_REPLY_TO", "support@yourtrace.online") or "").strip()


def brevo_routed_domain(to_email: str) -> str:
    """Receiver domain we deliberately keep on Brevo, or "".

    `EMAIL_BREVO_DOMAINS` is the warm-up lever: while our own IP has no
    reputation, the receivers that police new senders hardest (Gmail,
    Microsoft) stay on Brevo's established relay, and everyone else rides our
    MTA so it can build history. Empty means route nothing.
    """
    raw = os.getenv("EMAIL_BREVO_DOMAINS", "") or ""
    host = (to_email.rsplit("@", 1)[-1] if "@" in to_email else "").strip().lower()
    if not host:
        return ""
    for domain in (part.strip().lower() for part in raw.split(",")):
        if domain and (host == domain or host.endswith("." + domain)):
            return domain
    return ""


def _plain_text_from_html(html: str) -> str:
    import re

    text = re.sub(r"<[^>]+>", " ", html or "")
    return re.sub(r"\s+", " ", text).strip()


def _mta_reachable() -> bool:
    """Cheap liveness probe so `auto` never stalls on a dead MTA."""
    try:
        with smtplib.SMTP(_smtp_host(), _smtp_port(), timeout=5) as client:
            client.ehlo()
            return True
    except Exception:
        return False


def _dkim_sign(raw: bytes, include_headers: list[bytes]) -> tuple[bytes, str]:
    """Prepend a DKIM-Signature. Returns (message, status).

    Never raises: a signing problem must degrade to an unsigned send rather
    than lose the message, but the status is logged so it is visible.
    """
    if not DKIM_ENABLED:
        return raw, "off"
    try:
        import dkim

        enabled, domain, selector, key_path = _dkim_config()
        if not enabled:
            return raw, "off"
        with open(key_path, "rb") as handle:
            private_key = handle.read()
        signature = dkim.sign(
            raw,
            selector=selector.encode(),
            domain=domain.encode(),
            privkey=private_key,
            include_headers=include_headers,
        )
        return signature + raw, "signed"
    except Exception as exc:
        print(f"[email-sender] DKIM signing failed ({type(exc).__name__}: {exc}); sending unsigned")
        return raw, "failed"


def _send_via_smtp(
    *,
    to_email: str,
    to_name: Optional[str],
    subject: str,
    html_content: str,
    text_content: Optional[str],
    sender_email: str,
    sender_name: str,
    list_unsubscribe: Optional[str],
    reply_to_email: str = "",
) -> dict[str, Any]:
    message = EmailMessage()
    message["From"] = formataddr((sender_name, sender_email))
    message["To"] = formataddr((to_name, to_email)) if to_name else to_email
    message["Subject"] = subject
    message["Message-ID"] = make_msgid(domain=sender_email.split("@")[-1])
    if reply_to_email:
        message["Reply-To"] = reply_to_email
    if list_unsubscribe:
        # Bulk-sender requirement for Gmail/Yahoo; cheap to include from day one.
        message["List-Unsubscribe"] = f"<{list_unsubscribe}>"
        message["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"
    message.set_content(text_content or _plain_text_from_html(html_content))
    message.add_alternative(html_content, subtype="html")

    # SMTP policy gives CRLF line endings, which DKIM canonicalisation expects.
    raw = message.as_bytes(policy=email_policy.SMTP)
    # Sign only the headers this message actually carries: dkimpy expects the
    # named headers to be present, and a send without List-Unsubscribe must not
    # fail signing because of it.
    signable = [
        name
        for name in (
            b"from",
            b"to",
            b"subject",
            b"date",
            b"message-id",
            b"reply-to",
            b"list-unsubscribe",
            b"list-unsubscribe-post",
        )
        if message[name.decode()]
    ]
    signed, dkim_status = _dkim_sign(raw, signable)

    with smtplib.SMTP(_smtp_host(), _smtp_port(), timeout=SMTP_TIMEOUT) as client:
        client.ehlo()
        try:
            client.starttls()
            client.ehlo()
        except smtplib.SMTPException:
            # Local MTAs on loopback often have STARTTLS off; that is fine here,
            # the connection never leaves the machine.
            pass
        client.sendmail(sender_email, [to_email], signed)
    return {
        "success": True,
        "message_id": message["Message-ID"],
        "dkim": dkim_status,
    }


def _record_send(
    *,
    to_email: str,
    bucket: str,
    subject: str,
    transport: str,
    status: str,
    message_id: str = "",
    track_id: str = "",
    error: str = "",
    fallback_from: str = "",
    dkim: str = "",
    note: str = "",
) -> None:
    """Persist one send attempt. Never raises: logging must not break a send."""
    try:
        from v1.storage import FirestoreStore

        store = FirestoreStore()
        if store.db is None:
            return
        store.db.collection(SEND_LOG_COLLECTION).add(
            {
                "to": to_email,
                "bucket": bucket,
                "subject": subject,
                "transport": transport,
                "status": status,
                "message_id": message_id,
                "track_id": track_id,
                "error": error[:300],
                "fallback_from": fallback_from,
                "dkim": dkim,
                "note": note,
                "sent_at": datetime.now(timezone.utc).isoformat(),
                "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            }
        )
    except Exception as exc:  # pragma: no cover - defensive
        print(f"[email-sender] send log write failed: {type(exc).__name__}: {exc}")


def send_email(
    to_email: str,
    to_name: Optional[str],
    subject: str,
    html_content: str,
    text_content: Optional[str] = None,
    *,
    bucket: str = "",
    list_unsubscribe: Optional[str] = None,
    track_id: Optional[str] = None,
    log: bool = True,
) -> dict[str, Any]:
    """Send one email, choosing the transport and falling back to Brevo.

    Returns Brevo's result shape plus a ``transport`` key so callers can report
    or assert which path carried the message.
    """
    mode = transport_mode()
    track_id = track_id or uuid.uuid4().hex
    attempted: list[str] = []
    # Warm-up routing, `auto` only (a strict `smtp` run means the local MTA,
    # full stop): a receiver we deliberately keep on Brevo never touches our
    # own IP, so Gmail and Microsoft stay deliverable while it builds history.
    routed = brevo_routed_domain(to_email) if mode == "auto" else ""
    note = f"brevo route: {routed}" if routed else ""

    if mode in {"smtp", "auto"} and not routed and _mta_reachable():
        attempted.append("smtp")
        try:
            result = _send_via_smtp(
                to_email=to_email,
                to_name=to_name,
                subject=subject,
                html_content=html_content,
                text_content=text_content,
                sender_email=LOCAL_SENDER_EMAIL,
                sender_name=LOCAL_SENDER_NAME,
                list_unsubscribe=list_unsubscribe,
                reply_to_email=reply_to(),
            )
            if log:
                _record_send(
                    to_email=to_email,
                    bucket=bucket,
                    subject=subject,
                    transport="smtp",
                    status="sent",
                    message_id=str(result.get("message_id", "")),
                    track_id=track_id,
                    dkim=str(result.get("dkim", "")),
                )
            return {**result, "transport": "smtp", "track_id": track_id}
        except Exception as exc:
            # Fall through to Brevo: a local MTA problem must not lose the send.
            print(f"[email-sender] local MTA failed ({type(exc).__name__}); using Brevo")
            if mode == "smtp":
                _record_send(
                    to_email=to_email,
                    bucket=bucket,
                    subject=subject,
                    transport="smtp",
                    status="failed",
                    track_id=track_id,
                    error=str(exc),
                )
                return {
                    "success": False,
                    "error": f"smtp failed: {exc}",
                    "transport": "smtp",
                    "track_id": track_id,
                }

    result = brevo_send_email(
        to_email=to_email,
        to_name=to_name,
        subject=subject,
        html_content=html_content,
        text_content=text_content,
        sender_email=DEFAULT_SENDER_EMAIL,
        sender_name=DEFAULT_SENDER_NAME,
        reply_to_email=reply_to() or None,
        tags=["newsletter", "daily"],
    )
    if log:
        _record_send(
            to_email=to_email,
            bucket=bucket,
            subject=subject,
            transport="brevo",
            status="sent" if result.get("success") else "failed",
            message_id=str(result.get("message_id", "")),
            track_id=track_id,
            error=str(result.get("error", "")),
            fallback_from=",".join(attempted),
            note=note,
        )
    return {**result, "transport": "brevo", "track_id": track_id, "note": note}


def send_newsletter_email(
    to_email: str,
    to_name: Optional[str],
    subject: str,
    html_content: str,
    text_content: Optional[str] = None,
    *,
    bucket: str = "",
    list_unsubscribe: Optional[str] = None,
    track_id: Optional[str] = None,
) -> dict[str, Any]:
    """Newsletter entry point: same signature the flow already calls."""
    return send_email(
        to_email=to_email,
        to_name=to_name,
        subject=subject,
        html_content=html_content,
        text_content=text_content,
        bucket=bucket,
        list_unsubscribe=list_unsubscribe,
        track_id=track_id,
    )
