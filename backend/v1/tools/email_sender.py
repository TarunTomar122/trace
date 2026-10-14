"""Transport-agnostic email sender with automatic fallback.

Why this exists: we are moving the daily send off Brevo onto our own MTA, but
the transition has to be gradual and reversible. This module is the single
place that decides which transport carries a message, so no caller has to know
whether we are on Brevo, on our own Postfix, or mid-ramp.

Transports:
  * ``smtp``  — the VPS's own MTA on 127.0.0.1:25 (Postfix once installed).
  * ``brevo`` — the Brevo API. Now only used when asked for, never implicitly.

``EMAIL_TRANSPORT`` selects behaviour:
  ``smtp`` (default) — local MTA only. An unconfigured run cannot reach Brevo.
  ``brevo``          — Brevo only, and only ever because someone asked for it.
  ``auto``           — the local MTA, Brevo per the warm-up routing rules
                       (``EMAIL_BREVO_BUCKETS`` / ``EMAIL_BREVO_DOMAINS``), and
                       per-message fall back to Brevo when the MTA is
                       unreachable. This is what the VPS runs.

Messages to RFC 2606 / RFC 6761 names (``example.com``, anything under
``.test``) are dropped rather than sent anywhere: they cannot be delivered, and
a load test aimed at them would otherwise bounce and spend real quota.

Every attempt is recorded (recipient, bucket, transport, status, message id,
tracking id, note) so the dashboard can report volume, transport split and
failures.
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
    """Which transport carries a message.

    Defaults to ``smtp`` rather than ``brevo``: an unconfigured run — a load
    test on a laptop, say — must not quietly spend the production Brevo quota.
    Reaching Brevo is now an explicit choice.
    """
    mode = (os.getenv("EMAIL_TRANSPORT", "smtp") or "smtp").strip().lower()
    return mode if mode in {"brevo", "smtp", "auto"} else "smtp"


# RFC 2606 / RFC 6761 names that can never receive mail.
RESERVED_DOMAINS = (
    "example",
    "example.com",
    "example.org",
    "example.net",
    "test",
    "invalid",
    "localhost",
)


def reserved_recipient(to_email: str) -> bool:
    """True when the address cannot be delivered to by design.

    A load test aimed at example.com is meant to be harmless, but it is not: on
    2026-09-22 a stress run sent 300 messages to loadNNN@example.com through the
    Brevo API, hard-bounced every single one, and spent the day's whole quota
    before the newsletter could use it. Sending these anywhere real is pure
    harm, so they are dropped before a transport is even chosen.
    """
    host = (to_email.rsplit("@", 1)[-1] if "@" in to_email else "").strip().lower().strip(".")
    if not host:
        return False
    return any(host == domain or host.endswith("." + domain) for domain in RESERVED_DOMAINS)


def reply_to() -> str:
    """Where a reader's reply goes.

    Our sending host is a send-only null client: mail.yourtrace.online has no
    MX, so a missing Reply-To means every reply bounces. The root domain does
    accept mail, so the default points at a real mailbox there.
    """
    return (os.getenv("EMAIL_REPLY_TO", "support@yourtrace.online") or "").strip()


def brevo_sender() -> tuple[str, str]:
    """The From identity Brevo sends as.

    Defaults to the legacy address because Brevo only accepts senders it has
    verified. That default is a gmail.com address, which no relay can align
    SPF or DKIM for: our own docs already say a Gmail From gets filtered. Once
    the sending domain is verified in Brevo, set
    EMAIL_SENDER_BREVO=newsletter@mail.yourtrace.online and the Brevo route
    authenticates like the MTA route does.
    """
    email = (os.getenv("EMAIL_SENDER_BREVO", "") or "").strip() or DEFAULT_SENDER_EMAIL
    name = (os.getenv("EMAIL_SENDER_BREVO_NAME", "") or "").strip() or DEFAULT_SENDER_NAME
    return email, name


_BREVO_SENDABLE: Optional[bool] = None


def brevo_can_send() -> bool:
    """Whether Brevo will actually deliver anything right now.

    A successful-looking Brevo response proves nothing: it answers the API with
    a message id and fails later, so an exhausted account reports every send as
    accepted and then logs "Email not sent: Your account has insufficient
    credits" while the mail quietly disappears. On a free plan shared with other
    services that is not hypothetical.

    Check the balance up front and cache it for the run. An unreadable answer
    counts as "cannot send" so mail still leaves through our own MTA instead of
    vanishing.
    """
    global _BREVO_SENDABLE
    if _BREVO_SENDABLE is not None:
        return _BREVO_SENDABLE

    _BREVO_SENDABLE = False
    api_key = (os.getenv("BREVO_API_KEY", "") or "").strip()
    if not api_key:
        return False
    try:
        import json as _json
        import urllib.request as _urllib

        request = _urllib.Request(
            "https://api.brevo.com/v3/account",
            headers={"api-key": api_key, "accept": "application/json"},
        )
        with _urllib.urlopen(request, timeout=10) as response:
            account = _json.load(response)
        for plan in account.get("plan", []) or []:
            credits = plan.get("credits")
            if credits is None or int(credits) > 0:
                _BREVO_SENDABLE = True
                break
    except Exception as exc:
        print(f"[email-sender] Brevo balance check failed ({type(exc).__name__}: {exc}); treating Brevo as unavailable")
    return _BREVO_SENDABLE


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
    attachments: Optional[list[tuple[str, bytes, str]]] = None,
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
    for name, data, mime in attachments or []:
        maintype, _, subtype = (mime or "application/octet-stream").partition("/")
        message.add_attachment(data, maintype=maintype, subtype=subtype or "octet-stream", filename=name)

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


def brevo_route_reason(to_email: str, bucket: str) -> str:
    """Why this send should leave through Brevo, or "" for our own MTA.

    Two levers, both empty by default:

    * `EMAIL_BREVO_DOMAINS` — receiver domains. Gmail and Microsoft police new
      senders hardest, so they are the ones worth another relay's reputation.
    * `EMAIL_BREVO_BUCKETS` — audience buckets. Lets paying readers ride Brevo
      while our own IP warms on the rest, which also keeps the MTA's daily
      volume low enough to look like a real sender rather than a blast.
    """
    domain = brevo_routed_domain(to_email)
    if domain:
        return f"domain {domain}"

    wanted = (os.getenv("EMAIL_BREVO_BUCKETS", "") or "").strip().lower()
    bucket_name = (bucket or "").strip().lower()
    if bucket_name and wanted:
        if bucket_name in {part.strip() for part in wanted.split(",") if part.strip()}:
            return f"bucket {bucket_name}"
    return ""


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
    attachments: Optional[list[tuple[str, bytes, str]]] = None,
) -> dict[str, Any]:
    """Send one email, choosing the transport and falling back to Brevo.

    ``attachments`` are ``(filename, bytes, mime type)`` files, sent by either
    transport. Returns Brevo's result shape plus a ``transport`` key so callers
    can report or assert which path carried the message.
    """
    track_id = track_id or uuid.uuid4().hex

    if reserved_recipient(to_email):
        # Nothing to deliver to, and trying would bounce and burn quota.
        if log:
            _record_send(
                to_email=to_email,
                bucket=bucket,
                subject=subject,
                transport="none",
                status="skipped",
                track_id=track_id,
                note="reserved test domain: not sent",
            )
        return {
            "success": False,
            "error": "reserved test domain",
            "transport": "none",
            "track_id": track_id,
            "skipped": True,
        }

    mode = transport_mode()
    attempted: list[str] = []
    # Warm-up routing, `auto` only (a strict `smtp` run means the local MTA,
    # full stop): a receiver we deliberately keep on Brevo never touches our
    # own IP, so it can build history on everyone else. Routing is skipped when
    # Brevo cannot actually send, so a drained Brevo account costs placement
    # rather than delivery.
    routed = brevo_route_reason(to_email, bucket) if mode == "auto" else ""
    note = ""
    if routed:
        if brevo_can_send():
            note = f"brevo route: {routed}"
        else:
            note = f"brevo route skipped for {routed}: Brevo cannot send"
            routed = ""

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
                attachments=attachments,
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
                    note=note,
                )
            return {**result, "transport": "smtp", "track_id": track_id}
        except Exception as exc:
            # Fall through to Brevo: a local MTA problem must not lose the send.
            print(f"[email-sender] local MTA failed ({type(exc).__name__}); using Brevo")
            if mode == "smtp" or not brevo_can_send():
                # No transport left. Say so rather than recording a Brevo send
                # that the API would accept and then quietly drop.
                _record_send(
                    to_email=to_email,
                    bucket=bucket,
                    subject=subject,
                    transport="smtp",
                    status="failed",
                    track_id=track_id,
                    error=str(exc),
                    note="no transport: MTA failed and Brevo cannot send",
                )
                return {
                    "success": False,
                    "error": f"smtp failed: {exc}",
                    "transport": "smtp",
                    "track_id": track_id,
                }

    if not routed and not attempted and mode in {"smtp", "auto"} and (mode == "smtp" or not brevo_can_send()):
        # The local MTA is unreachable and there is no Brevo to fall back on (a
        # strict `smtp` run never uses Brevo). Say so rather than recording a
        # Brevo send that the API would accept and then quietly drop.
        if log:
            _record_send(
                to_email=to_email,
                bucket=bucket,
                subject=subject,
                transport="smtp",
                status="failed",
                track_id=track_id,
                error="local MTA unreachable",
                note="no transport: MTA unreachable and Brevo cannot send",
            )
        return {"success": False, "error": "local MTA unreachable", "transport": "smtp", "track_id": track_id}

    brevo_from_email, brevo_from_name = brevo_sender()
    result = brevo_send_email(
        to_email=to_email,
        to_name=to_name,
        subject=subject,
        html_content=html_content,
        text_content=text_content,
        sender_email=brevo_from_email,
        sender_name=brevo_from_name,
        reply_to_email=reply_to() or None,
        # One-off emails get their own tag so Brevo's stats keep the daily apart.
        tags=[bucket] if bucket in {"welcome", "supporter_thanks", "post_kit", "test"} else ["newsletter", "daily"],
        attachments=attachments,
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
