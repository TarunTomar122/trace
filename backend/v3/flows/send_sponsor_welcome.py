"""Welcome email for a new sponsor: their tool is live, where it shows, and how clicks are tracked.

  cd backend
  ../.venv/bin/python -m v3.flows.send_sponsor_welcome --dry-run                  # who would get it, plus previews
  ../.venv/bin/python -m v3.flows.send_sponsor_welcome --test-to you@example.com  # a preview copy to you
  ../.venv/bin/python -m v3.flows.send_sponsor_welcome                            # send
  ../.venv/bin/python -m v3.flows.send_sponsor_welcome --id <promoted_tools id>   # just this sponsor

trace-sponsor-welcome.timer runs it every 10 minutes. A sponsor is a
`promoted_tools` record the payment webhook (frontend
app/api/subscription/webhook) made active. Each gets one welcome, ever: its
`welcome_status` is set to "sending" before the send and "sent" after, and only
a "failed" send is tried again (up to MAX_ATTEMPTS). Only sponsors created
since SPONSOR_SINCE count, so earlier sponsors are never mailed by the timer
(created_at, not activated_at: the webhook resets activated_at on renewals).

The email links the sponsor's private stats page (/sponsor/{id}?k={token});
the token is made here, on the record, the first time it is needed.
"""

from __future__ import annotations

import argparse
import fcntl
import html
import secrets
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))
load_dotenv(BACKEND_ROOT.parent / ".env")

from v1.storage import FirestoreStore  # noqa: E402
from v3.flows.send_welcome import (  # noqa: E402  (the reader welcome's look and helpers)
    APP_URL,
    BLUE,
    _first_name,
    _p,
    _when,
    page_shell,
)

COLLECTION = "promoted_tools"
# The first sponsor to get this email bought on this day; earlier ones never will.
SPONSOR_SINCE = datetime(2026, 10, 27, tzinfo=timezone.utc)
MAX_ATTEMPTS = 3
RETRY_AFTER = timedelta(minutes=30)
# Sent through the welcome bucket: same transport routing and Brevo tag.
BUCKET = "welcome"
LOCK_FILE = BACKEND_ROOT.parent / ".sponsor-welcome.lock"


def _log(message: str) -> None:
    print(f"[{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')}] [sponsor-welcome] {message}", flush=True)


def due(sponsor: dict[str, Any], now: datetime) -> bool:
    """Active, created since SPONSOR_SINCE, and never welcomed (or a failed try that may be retried)."""
    if sponsor.get("status") != "active" or "@" not in str(sponsor.get("email") or ""):
        return False
    created = _when(sponsor.get("created_at"))
    if not created or created < SPONSOR_SINCE:
        return False
    state = sponsor.get("welcome_status")
    if not state:
        return True
    if state != "failed" or int(sponsor.get("welcome_attempts") or 0) >= MAX_ATTEMPTS:
        return False
    last = _when(sponsor.get("welcome_updated_at"))
    return not last or now - last >= RETRY_AFTER


def stats_path(sponsor: dict[str, Any]) -> str:
    return f"/sponsor/{sponsor['id']}?k={sponsor['stats_token']}"


def _day(value: Any) -> str:
    when = _when(value)
    return f"{when.day} {when:%B}" if when else ""


def _bullets(items: list[str]) -> str:
    """An HTML list that survives mail apps (items already escaped)."""
    rows = "".join(
        f'<li style="margin: 0 0 8px 0; font-size: 16px; line-height: 24px; color: #0a0a0a;">{item}</li>' for item in items
    )
    return f'<ul style="margin: 0 0 16px 0; padding-left: 22px;">{rows}</ul>'


def _a(url: str, text: str = "") -> str:
    return (f'<a href="{html.escape(url)}" style="color: {BLUE}; font-weight: 600; text-decoration: none;">'
            f"{html.escape(text or url.replace('https://', ''))}</a>")


def render(sponsor: dict[str, Any], name: str) -> tuple[str, str, str]:
    """(subject, html, text) for this sponsor's welcome."""
    title = str(sponsor.get("title") or sponsor.get("host") or "Your tool").strip()
    first = _first_name(name)
    hi = f"Hi {first}," if first else "Hi there,"
    until = _day(sponsor.get("expires_at"))
    stats = f"{APP_URL}{stats_path(sponsor)}"
    feed, brief = f"{APP_URL}/feed", f"{APP_URL}/brief"
    subject = f"{title} is live on Trace"

    if not until:
        live = f"Thank you for sponsoring Trace. {title} is live now."
    elif sponsor.get("subscription_id"):
        live = f"Thank you for sponsoring Trace. {title} is live now, and your spot renews on {until}."
    else:
        live = f"Thank you for sponsoring Trace. {title} is live now and stays up until {until}."
    where_lead = "Readers see it in two places:"
    where = [
        ("The feed", feed, "in the Tools column on desktop, at the top of Top articles on phones, and at the end of Home."),
        ("The daily brief pages", brief, "in the right-hand column on wider screens."),
    ]
    own = ("On your side: every visit from Trace arrives tagged utm_source=trace and utm_medium=sponsored, with the spot "
           "it came from in utm_content (desktop_tools, pulse_mobile, home_feed_end or brief_rail; your stats page "
           "says which is which). Filter by source \"trace\" in Google Analytics, Plausible or whatever you use.")
    ours = ("On our side: we count every click too, by day and by where it happened. Your numbers are on your own "
            "stats page, updated live:")
    gap = ("Our count can run a little higher than yours, because some visitors leave before your page loads and some "
           "block analytics.")
    change = "Want to change your title, description or link? Just reply to this email."
    thanks = "Thanks again for backing Trace. It keeps the site free for everyone who reads it."

    text = "\n\n".join([
        hi, live, where_lead,
        "\n".join(f"- {label}: {url}, {what}" for label, url, what in where),
        own, f"{ours}\n{stats}", gap, change, thanks, "Tarat, founder of Trace",
        "You're getting this because you bought a sponsor spot on yourtrace.online.",
    ])
    body = "".join([
        _p(html.escape(hi)),
        _p(html.escape(live)),
        _p(html.escape(where_lead)),
        _bullets([f"<strong>{html.escape(label)}</strong> ({_a(url)}), {html.escape(what)}" for label, url, what in where]),
        _p(html.escape(own)),
        _p(html.escape(ours.rstrip(":") + ".")),
        _p(html.escape(gap)),
        _p(html.escape(change)),
        _p(html.escape(thanks)),
    ])
    footer = html.escape("You're getting this because you bought a sponsor spot on yourtrace.online.")
    page = page_shell(subject, body, ("See your stats", stats_path(sponsor)), footer)
    return subject, page, text


def sponsors(store: FirestoreStore) -> list[dict[str, Any]]:
    return [{"id": d.id, **(d.to_dict() or {})} for d in store.db.collection(COLLECTION).stream()]


def owner_name(store: FirestoreStore, sponsor: dict[str, Any]) -> str:
    try:
        uid = str(sponsor.get("user_id") or "")
        data = (store.db.collection("user_profiles").document(uid).get().to_dict() or {}) if uid else {}
        return str(data.get("displayName") or data.get("name") or "")
    except Exception:
        return ""


def ensure_token(store: FirestoreStore, sponsor: dict[str, Any]) -> None:
    if len(str(sponsor.get("stats_token") or "")) >= 16:
        return
    sponsor["stats_token"] = secrets.token_urlsafe(18)
    store.db.collection(COLLECTION).document(sponsor["id"]).set({"stats_token": sponsor["stats_token"]}, merge=True)


def _send(sponsor: dict[str, Any], name: str, to: str, bucket: str) -> dict[str, Any]:
    from v1.tools.email_sender import send_email
    subject, page, text = render(sponsor, name)
    return send_email(to, name or None, subject, page, text, bucket=bucket)


def welcome_all(store: FirestoreStore, args: argparse.Namespace, now: datetime) -> int:
    todo = [s for s in sponsors(store) if (not args.id or s["id"] == args.id) and due(s, now)]
    if not todo:
        if args.id:
            _log(f"{args.id}: not due (not active, before {SPONSOR_SINCE:%Y-%m-%d}, or already welcomed)")
        return 0
    failed = 0
    for sponsor in todo:
        name = owner_name(store, sponsor)
        if args.dry_run:
            sponsor.setdefault("stats_token", "PREVIEW-TOKEN-NOT-SAVED")
            subject, page, _ = render(sponsor, name)
            preview = Path(args.out) / f"sponsor-{sponsor['id']}.html"
            preview.parent.mkdir(parents=True, exist_ok=True)
            preview.write_text(page)
            _log(f"[dry-run] {sponsor['email']} ({sponsor.get('title')}) - {subject} -> {preview}")
            continue
        ref = store.db.collection(COLLECTION).document(sponsor["id"])
        attempts = int(sponsor.get("welcome_attempts") or 0) + 1
        # Token and marker go down before the email: a send we can't record
        # would be repeated every run.
        try:
            ensure_token(store, sponsor)
            ref.set({"welcome_status": "sending", "welcome_attempts": attempts,
                     "welcome_updated_at": now.isoformat()}, merge=True)
        except Exception as exc:
            _log(f"cannot record sponsor welcomes, stopping: {exc}")
            return 1
        try:
            result = _send(sponsor, name, sponsor["email"], BUCKET)
        except Exception as exc:
            result = {"success": False, "error": str(exc)}
        ok = result.get("success") is not False
        try:
            ref.set({"welcome_status": "sent" if ok else "failed",
                     "welcome_error": "" if ok else str(result.get("error") or "")[:300],
                     "welcome_updated_at": now.isoformat()}, merge=True)
        except Exception as exc:
            _log(f"cannot record the result for {sponsor['email']}, stopping: {exc}")
            return 1
        if ok:
            _log(f"sent sponsor welcome to {sponsor['email']} ({sponsor.get('title')}) via {result.get('transport')}")
        else:
            failed += 1
            _log(f"FAILED sponsor welcome to {sponsor['email']} (attempt {attempts}/{MAX_ATTEMPTS}): {result.get('error')}")
    return 1 if failed else 0


def run(args: argparse.Namespace, now: datetime | None = None) -> int:
    now = now or datetime.now(timezone.utc)
    if args.test_to:
        # A preview to you, with a placeholder sponsor; nothing is saved.
        # Its stats link goes nowhere: the sample isn't a real record.
        sample = {"id": "preview", "title": "Calenteri", "host": "calenteri.com", "stats_token": "preview",
                  "expires_at": now + timedelta(days=30)}
        result = _send(sample, "Tarat Tomar", args.test_to, "test")
        _log(f"test sponsor welcome to {args.test_to}: {result.get('transport')} success={result.get('success', True)}")
        return 0
    with open(getattr(args, "lock", None) or LOCK_FILE, "a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            _log("another sponsor welcome run is going; skipping")
            return 0
        return welcome_all(FirestoreStore(), args, now)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true", help="list who would be welcomed and write HTML previews; send nothing")
    parser.add_argument("--out", default="/tmp/trace-sponsor-welcome", help="where --dry-run writes previews")
    parser.add_argument("--test-to", help="send one preview copy to this address only")
    parser.add_argument("--id", help="only this promoted_tools record")
    parser.add_argument("--lock", help=argparse.SUPPRESS)
    sys.exit(run(parser.parse_args()))


if __name__ == "__main__":
    main()
