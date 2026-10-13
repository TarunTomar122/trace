"""Welcome email for new readers: an email-only subscriber or a new web account.

  cd backend
  ../.venv/bin/python -m v3.flows.send_welcome --dry-run                 # who would get it, plus previews
  ../.venv/bin/python -m v3.flows.send_welcome --test-to you@example.com # one copy of each version
  ../.venv/bin/python -m v3.flows.send_welcome                           # send

trace-welcome.timer runs it every 5 minutes. A reader gets one welcome, ever,
whichever way they joined: a marker in `welcome_sends` is written before each
send, and anyone with a marker that is sending, sent or skipped is never mailed
again. Someone who subscribed by email and also made an account gets the
account version once. Accounts wait until they finish onboarding (or 30
minutes), so the email can say whether their daily brief is on.

Only signups since WELCOME_SINCE (the day this shipped) and within the last
LOOKBACK_DAYS count, so older readers are never mailed and a stopped timer
never sends a stale welcome. Mobile-app accounts live in Firebase, not LocalDB,
so they aren't seen here.
"""

from __future__ import annotations

import argparse
import fcntl
import hashlib
import html
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))
load_dotenv(BACKEND_ROOT.parent / ".env")

from v1.storage import FirestoreStore  # noqa: E402
from v3.flows.send_audience_newsletter import _email_enabled  # noqa: E402  (the daily's own opt-in rule)

BUCKET = "welcome"
MARKERS = "welcome_sends"
APP_URL = (os.getenv("TRACE_APP_URL") or "https://yourtrace.online").rstrip("/")
WELCOME_SINCE = datetime(2026, 10, 13, tzinfo=timezone.utc)
LOOKBACK_DAYS = 3
MAX_PER_RUN = 25
# More new readers than this in an hour looks like a bot filling the form:
# stop and let a person look, rather than burn the sending reputation.
HOURLY_CAP = 30
MAX_ATTEMPTS = 3
RETRY_AFTER = timedelta(minutes=30)
# Accounts get their welcome after onboarding, or after this long without it.
ACCOUNT_DELAY = timedelta(minutes=30)
# "Your first brief lands Wednesday" only while the signup is fresh.
FRESH = timedelta(hours=1)
# The daily brief goes out at 10:30 Europe/Berlin (trace-newsletter.timer),
# which is 9:30 in the UK all year: both switch clocks on the same days.
BRIEF_ZONE, BRIEF_HOUR, BRIEF_MINUTE = ZoneInfo("Europe/Berlin"), 10, 30
BRIEF_TIME_UK = "9:30am UK time"
LOCK_FILE = BACKEND_ROOT.parent / ".welcome.lock"
FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"


def _log(message: str) -> None:
    print(f"[{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')}] [welcome] {message}", flush=True)


def _when(value: Any) -> datetime | None:
    """A timestamp as stored (datetime, ISO string, epoch, {seconds}), or None.

    Never raises: one malformed profile must not stop everyone's welcome.
    """
    try:
        if isinstance(value, datetime):
            return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        if isinstance(value, dict):
            seconds = value.get("seconds", value.get("_seconds"))
            return datetime.fromtimestamp(float(seconds), timezone.utc) if seconds is not None else None
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return datetime.fromtimestamp(value / (1000 if value > 1e11 else 1), timezone.utc)
        if isinstance(value, str) and value[:4].isdigit():
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except (ValueError, OverflowError, OSError, TypeError):
        return None
    return None


def _first_name(name: str) -> str:
    """First name for the greeting: "MICHELLE V" -> "Michelle", "o'neil" -> "O'Neil", "DJ" stays."""
    name = (name or "").strip()
    if not name or "@" in name:
        return ""
    first = name.split()[0]
    if first.islower() or (first.isupper() and len(first) > 2):
        first = first.title()
    return first


def _marker_id(email: str) -> str:
    return hashlib.sha256(email.encode("utf-8")).hexdigest()[:32]


# ---------------------------------------------------------------------------
# Who
# ---------------------------------------------------------------------------


def new_readers(store: FirestoreStore, now: datetime) -> list[dict[str, Any]]:
    """Signups in the window, one per email; an account beats an email-only signup."""
    since = max(WELCOME_SINCE, now - timedelta(days=LOOKBACK_DAYS))
    readers: dict[str, dict[str, Any]] = {}
    subscribed: set[str] = set()

    for doc in store.db.collection("free_newsletter_subscribers").stream():
        data = doc.to_dict() or {}
        email = str(data.get("email") or doc.id or "").strip().lower()
        if "@" not in email or data.get("active") is not True:
            continue
        subscribed.add(email)
        joined = _when(data.get("subscribedAt"))
        if joined and since <= joined <= now:
            readers[email] = {"email": email, "name": "", "kind": "newsletter", "joined": joined}

    for doc in store.db.collection("user_profiles").stream():
        data = doc.to_dict() or {}
        email = str(data.get("email") or "").strip().lower()
        joined = _when(data.get("createdAt"))
        if "@" not in email or data.get("deleted") is True or not joined or not since <= joined <= now:
            continue
        readers[email] = {
            "email": email,
            "name": str(data.get("displayName") or data.get("name") or ""),
            "kind": "account",
            "joined": joined,
            "onboarded": data.get("onboarded") is True,
            # The daily's own rule: an explicit opt-out wins; otherwise onboarded
            # accounts, builder sign-ups and email subscribers get it.
            "daily": _email_enabled(data)
            and (data.get("onboarded") is True or data.get("dailyNewsletterEnabled") is True or email in subscribed),
        }

    return sorted(readers.values(), key=lambda reader: reader["joined"])


def ready(reader: dict[str, Any], now: datetime) -> bool:
    """Accounts wait for onboarding (or ACCOUNT_DELAY) so the copy is right."""
    return reader["kind"] != "account" or bool(reader.get("onboarded")) or now - reader["joined"] >= ACCOUNT_DELAY


def markers(store: FirestoreStore) -> dict[str, dict[str, Any]]:
    return {d.id: d.to_dict() or {} for d in store.db.collection(MARKERS).stream()}


def due(marker: dict[str, Any] | None, now: datetime) -> bool:
    """No marker yet, or a failed send that may be tried again.

    "sending" means the send may have happened (the run died after it), so it
    is never retried; "skipped" is an address we can't deliver to.
    """
    if not marker:
        return True
    if marker.get("status") != "failed" or int(marker.get("attempts") or 0) >= MAX_ATTEMPTS:
        return False
    last = _when(marker.get("updated_at"))
    return not last or now - last >= RETRY_AFTER


# ---------------------------------------------------------------------------
# What
# ---------------------------------------------------------------------------


def first_brief_day(joined: datetime) -> str:
    """Weekday of the first daily brief after `joined`, e.g. "Wednesday".

    A weekday reads right in every timezone; "this morning" doesn't.
    """
    local = joined.astimezone(BRIEF_ZONE)
    send = local.replace(hour=BRIEF_HOUR, minute=BRIEF_MINUTE, second=0, microsecond=0)
    if local >= send:
        send += timedelta(days=1)
    return send.strftime("%A")


def _link(path: str) -> str:
    url = f"{APP_URL}{path}"
    text = url.replace("https://", "").replace("http://", "")
    return f'<a href="{html.escape(url)}" style="color: #1d9bf0; font-weight: 700; text-decoration: none;">{html.escape(text)}</a>'


def _para(text: str, *paths: str) -> tuple[str, str]:
    """(plain, html) for a paragraph whose {} slots are app paths, shown as links in HTML."""
    return text.format(*(f"{APP_URL}{path}" for path in paths)), html.escape(text).format(*map(_link, paths))


def render(reader: dict[str, Any], now: datetime) -> tuple[str, str, str]:
    """(subject, html, text) for this reader's version of the welcome."""
    first = _first_name(reader.get("name", ""))
    hi = f"Hi {first}," if first else "Hi there,"
    customize = "pick your topics, how many stories (5, 10 or 15) and whether you want images"
    intro = _para(
        "You're in. Trace reads the internet so you don't have to: hundreds of tech sources, "
        "boiled down to the stories that matter, each with a link to the original."
    )
    free = _para("It's all free and open source. No ads, no paywall, nothing to unlock.")
    reply = _para("Hit reply anytime. I read every email and I'd love to hear what you think.")

    if reader["kind"] == "newsletter":
        joined = reader.get("joined") or now
        if now - joined <= FRESH:
            day = first_brief_day(joined)
            subject = f"You're in. Your first Trace brief lands {day}"
            when = _para(
                f"Your first daily brief lands {day} around {BRIEF_TIME_UK}. One short email a day "
                "with the biggest stories in AI, tech, markets, startups and design."
            )
        else:
            subject = "You're in. Welcome to the Trace daily brief"
            when = _para(
                f"Your daily brief lands every morning around {BRIEF_TIME_UK}. One short email a day "
                "with the biggest stories in AI, tech, markets, startups and design."
            )
        paragraphs = [
            intro,
            when,
            _para("Can't wait? The latest brief is already up: {}", "/brief"),
            _para("Want it your way? Sign in at {} to " + customize + ".", "/brief/customize"),
            free,
            reply,
        ]
        button = ("Read the latest brief", "/brief")
        unsubscribe = f"{APP_URL}/api/unsubscribe?email={quote(reader['email'], safe='')}"
        footer_text = f"You're getting this because you signed up at yourtrace.online. Unsubscribe: {unsubscribe}"
        footer_html = (
            "You're getting this because you signed up at yourtrace.online. "
            f'<a href="{html.escape(unsubscribe)}" style="color: #536471;">Unsubscribe</a>'
        )
    else:
        subject = "You're in. Welcome to Trace"
        if reader.get("daily"):
            inbox = _para(
                f"Your daily brief lands every morning around {BRIEF_TIME_UK}, matched to your topics. "
                "To change it, head to {}: " + customize + ".",
                "/brief/customize",
            )
        else:
            inbox = _para(
                "Want it in your inbox too? Set up your daily email at {}: " + customize
                + f". It lands every morning around {BRIEF_TIME_UK}.",
                "/brief/customize",
            )
        paragraphs = [
            intro,
            _para(
                "Your feed is ready: {}. It updates all day, with each story grouped once "
                "however many outlets cover it.",
                "/feed",
            ),
            inbox,
            free,
            reply,
        ]
        button = ("Open your feed", "/feed")
        footer_text = "You're getting this because you just created a Trace account."
        footer_html = html.escape(footer_text)

    text = "\n\n".join([hi, *(plain for plain, _ in paragraphs), "Tarat, founder of Trace", footer_text])
    body = "".join(
        f'<p style="margin: 0 0 16px 0; font-size: 16px; line-height: 25px; color: #0f1419; font-family: {FONT};">{part}</p>'
        for part in [html.escape(hi), *(rich for _, rich in paragraphs)]
    )
    # A table-cell button: Outlook ignores padding and radius on a bare link.
    cta = (
        '<table cellpadding="0" cellspacing="0" border="0" style="margin: 8px 0 24px 0;"><tr>'
        '<td bgcolor="#0f1419" style="border-radius: 999px; background: #0f1419;">'
        f'<a href="{html.escape(APP_URL + button[1])}" style="display: inline-block; padding: 12px 22px; '
        f'font-family: {FONT}; font-size: 15px; font-weight: 700; color: #ffffff; text-decoration: none;">'
        f"{html.escape(button[0])}</a></td></tr></table>"
    )
    page = (
        "<!doctype html><html><head>"
        '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
        '<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">'
        f"<title>{html.escape(subject)}</title></head>"
        '<body style="margin: 0; padding: 0; background: #ffffff;">'
        '<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff"><tr>'
        '<td align="center" style="padding: 32px 16px;">'
        '<table width="560" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 560px;"><tr><td>'
        f'<p style="margin: 0 0 24px 0; font-size: 12px; font-weight: 800; letter-spacing: 0.14em; color: #1d9bf0; font-family: {FONT};">TRACE</p>'
        f"{body}{cta}"
        f'<p style="margin: 0; font-size: 16px; font-weight: 700; color: #0f1419; font-family: {FONT};">Tarat</p>'
        f'<p style="margin: 0 0 32px 0; font-size: 14px; color: #536471; font-family: {FONT};">Founder, Trace</p>'
        f'<p style="margin: 0; font-size: 12px; line-height: 18px; color: #536471; font-family: {FONT};">{footer_html}</p>'
        "</td></tr></table></td></tr></table></body></html>"
    )
    return subject, page, text


# ---------------------------------------------------------------------------
# Send
# ---------------------------------------------------------------------------


def _send(reader: dict[str, Any], now: datetime, *, to: str | None = None, bucket: str = BUCKET) -> dict[str, Any]:
    from v1.tools.email_sender import send_email

    subject, page, text = render(reader, now)
    unsubscribe = (
        f"{APP_URL}/api/unsubscribe?email={quote(reader['email'], safe='')}" if reader["kind"] == "newsletter" else None
    )
    return send_email(to or reader["email"], reader.get("name") or None, subject, page, text,
                      bucket=bucket, list_unsubscribe=unsubscribe)


def _welcome_all(store: FirestoreStore, args: argparse.Namespace, now: datetime) -> int:
    from v1.tools.email_sender import reserved_recipient

    seen = markers(store)
    hour_ago = now - timedelta(hours=1)
    recent = sum(1 for m in seen.values() if (_when(m.get("created_at")) or WELCOME_SINCE) >= hour_ago)
    todo = [
        reader for reader in new_readers(store, now)
        if ready(reader, now) and due(seen.get(_marker_id(reader["email"])), now)
    ]
    if not todo:
        return 0
    if recent + len(todo) > HOURLY_CAP and not args.dry_run:
        _log(f"PAUSED: {recent} welcomes in the last hour and {len(todo)} waiting (cap {HOURLY_CAP}/h). "
             "Check the signup form for abuse; sending only what fits.")
        todo = todo[: max(0, HOURLY_CAP - recent)]
    todo = todo[:MAX_PER_RUN]
    if not todo:
        return 0
    _log(f"{len(todo)} new reader(s) to welcome")

    failed = 0
    for reader in todo:
        if args.dry_run:
            subject, page, _ = render(reader, now)
            preview = Path(args.out) / f"welcome-{reader['kind']}.html"
            preview.parent.mkdir(parents=True, exist_ok=True)
            preview.write_text(page)
            _log(f"[dry-run] {reader['kind']}: {reader['email']} (joined {reader['joined']:%Y-%m-%d %H:%M}) - {subject}")
            continue

        ref = store.db.collection(MARKERS).document(_marker_id(reader["email"]))
        previous = seen.get(_marker_id(reader["email"])) or {}
        attempts = int(previous.get("attempts") or 0) + 1
        stamp = now.isoformat()
        base = {"email": reader["email"], "kind": reader["kind"], "created_at": previous.get("created_at") or stamp}
        if reserved_recipient(reader["email"]):
            ref.set({**base, "status": "skipped", "error": "undeliverable address", "updated_at": stamp}, merge=True)
            _log(f"skipped {reader['email']}: undeliverable address")
            continue
        # The marker goes down before the email: if it can't be written, stop,
        # because a send we can't record would be repeated every run.
        try:
            ref.set({**base, "status": "sending", "attempts": attempts, "updated_at": stamp}, merge=True)
        except Exception as exc:
            _log(f"cannot record welcomes, stopping: {exc}")
            return 1
        try:
            result = _send(reader, now)
        except Exception as exc:
            result = {"success": False, "error": str(exc)}
        ok = result.get("success") is not False
        try:
            ref.set({"status": "sent" if ok else "failed", "transport": result.get("transport") or "",
                     "error": "" if ok else str(result.get("error") or "")[:300],
                     "updated_at": now.isoformat()}, merge=True)
        except Exception as exc:
            # Left at "sending": never retried, so never sent twice.
            _log(f"cannot record the result for {reader['email']}, stopping: {exc}")
            return 1
        if ok:
            _log(f"sent {reader['kind']} welcome to {reader['email']} via {result.get('transport')}")
        else:
            failed += 1
            _log(f"FAILED {reader['kind']} welcome to {reader['email']} (attempt {attempts}/{MAX_ATTEMPTS}): {result.get('error')}")
    return 1 if failed else 0


def run(args: argparse.Namespace, now: datetime | None = None) -> int:
    now = now or datetime.now(timezone.utc)
    if args.test_to:
        for reader in (
            {"email": args.test_to, "name": "", "kind": "newsletter", "joined": now},
            {"email": args.test_to, "name": "Tarat Tomar", "kind": "account", "joined": now, "daily": True},
            {"email": args.test_to, "name": "Tarat Tomar", "kind": "account", "joined": now, "daily": False},
        ):
            result = _send(reader, now, to=args.test_to, bucket="test")
            _log(f"test {reader['kind']} welcome to {args.test_to}: {result.get('transport')} success={result.get('success', True)}")
        return 0

    # One run at a time, whether from the timer or by hand.
    with open(getattr(args, "lock", None) or LOCK_FILE, "a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            _log("another welcome run is going; skipping")
            return 0
        return _welcome_all(FirestoreStore(), args, now)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true", help="list who would be welcomed and write HTML previews; send nothing")
    parser.add_argument("--out", default="/tmp/trace-welcome", help="where --dry-run writes previews")
    parser.add_argument("--test-to", help="send one copy of each version to this address only")
    parser.add_argument("--lock", help=argparse.SUPPRESS)
    sys.exit(run(parser.parse_args()))


if __name__ == "__main__":
    main()
