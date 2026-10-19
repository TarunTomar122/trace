#!/usr/bin/env python3
"""Pull Brevo's view of our mail back into the database.

Brevo carries the mail routed to it (member, win-back, welcome) and tracks it
itself, but none of that reached our database. A reader who unsubscribed
through Gmail's button or Brevo's own link stayed on our list (Brevo then
quietly blocked every later send), and opens and clicks only lived in Brevo.

Each run, safe to repeat:

- Suppressions: an unsubscribe, spam complaint or hard bounce turns the daily
  off with the same flags our own unsubscribe link sets. Two sources: Brevo's
  blocked contacts (opt-outs against our sender, hard bounces from any
  sender) and the matching events on our own sends, which catch opt-outs
  whatever sender Brevo filed them under. Each block is recorded the first
  time it is seen and applied once, so a reader who later turns the daily
  back on is not switched off again for the same block. Brevo keeps its own
  block, though: until it is cleared there, Brevo still drops their mail.
- Events: opens, clicks, unsubscribes, bounces, complaints and blocked sends
  on our own sends, matched by message id (the account also carries other
  mail), land in email_events with the send's track id and bucket, where the
  dashboard reads opens and clicks.

The newsletter runs this before it resolves the audience. On its own, from
~/trace/backend on the VPS:

  ../.venv/bin/python -m v3.flows.sync_brevo --dry-run    # list what would change
  ../.venv/bin/python -m v3.flows.sync_brevo [--full]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from v1.tools.email_sender import LOCAL_SENDER_EMAIL, brevo_sender, reserved_recipient  # noqa: E402

API_URL = "https://api.brevo.com/v3"
STATE_COLLECTION, STATE_DOC = "email_sync", "brevo"
SUPPRESSIONS_COLLECTION = "email_suppressions"
EVENTS_COLLECTION = "email_events"
# First run (or --full): how far back to pull events. Blocked contacts are
# always pulled whole on a first run; an old unsubscribe still counts.
BACKFILL_DAYS = 30
# Later runs re-read a little before the last sync: Brevo's dates are in the
# account's time zone, and every write is idempotent.
OVERLAP_DAYS = 2
# Opens and clicks keep arriving for days; match them to sends this recent.
SEND_LOOKBACK_DAYS = 45
# Brevo's page sizes (blocked contacts allow at most 100) and a hard stop.
EVENT_PAGE, BLOCKED_PAGE, MAX_PAGES = 2500, 100, 200
EVENT_WINDOW_DAYS = 10
# Firestore caps a batch at 500 writes.
WRITE_BATCH = 400
# The block and the event for one opt-out carry slightly different times; a
# block counts as new only if it is later than the recorded one by this much.
SAME_BLOCK = timedelta(minutes=10)
# The send's id on our own "come read" links (send_audience_newsletter's
# EMAIL_VISIT_PARAM); dropped from click targets so they group by link.
EMAIL_VISIT_PARAM = "et"

# Brevo event -> email_events kind. Requests and deliveries are already in the
# send log. Brevo reports Apple Mail's automatic image loads separately from
# opens, so they are kept apart here too. "blocked" is a send Brevo dropped
# because the address is on its block list.
EVENT_KINDS = {
    "opened": "open",
    "clicks": "click",
    "loadedByProxy": "proxy_open",
    "unsubscribed": "unsubscribe",
    "hardBounces": "bounce",
    "spam": "complaint",
    "blocked": "blocked",
}
# Events on our own sends that turn the daily off.
EVENT_SUPPRESSIONS = {"unsubscribe": "unsubscribe", "complaint": "complaint", "bounce": "hard_bounce"}
OPT_OUTS = ("unsubscribe", "complaint")

Getter = Callable[[str, dict], dict]


def _log(msg: str) -> None:
    print(f"[brevo-sync] {msg}", flush=True)


def _brevo_getter(api_key: str) -> Getter:
    import requests

    def get(path: str, params: dict) -> dict:
        resp = requests.get(
            f"{API_URL}{path}",
            params=params,
            headers={"api-key": api_key, "accept": "application/json"},
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json() if resp.content else {}

    return get


def _norm_message_id(value: Any) -> str:
    return str(value or "").strip().strip("<>").lower()


def _parse(value: Any) -> datetime | None:
    try:
        ts = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
    return ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)


def _utc_iso(value: Any) -> str:
    """Brevo's timestamps carry the account's offset; store UTC like the rest."""
    ts = _parse(value)
    return ts.astimezone(timezone.utc).isoformat() if ts else ""


def _mask(email: str) -> str:
    user, _, domain = email.partition("@")
    return f"{user[:2]}***@{domain}"


def _strip_visit_id(url: str) -> str:
    try:
        parts = urlparse(url)
    except ValueError:
        return url
    if not parts.query:
        return url
    query = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True) if k != EMAIL_VISIT_PARAM]
    return urlunparse(parts._replace(query=urlencode(query)))


def _pages(get: Getter, path: str, key: str, params: dict, size: int) -> list[dict]:
    rows: list[dict] = []
    for page in range(MAX_PAGES):
        batch = get(path, {**params, "limit": size, "offset": page * size}).get(key) or []
        rows.extend(row for row in batch if isinstance(row, dict))
        if len(batch) < size:
            return rows
    _log(f"{path}: stopped after {MAX_PAGES} pages")
    return rows


def fetch_blocked(get: Getter, start: date | None, end: date) -> list[dict]:
    params: dict = {"sort": "asc"}
    if start is not None:
        params.update(startDate=start.isoformat(), endDate=end.isoformat())
    return _pages(get, "/smtp/blockedContacts", "contacts", params, BLOCKED_PAGE)


def fetch_events(get: Getter, start: date, end: date) -> list[dict]:
    events: list[dict] = []
    window_start = start
    while window_start <= end:
        window_end = min(window_start + timedelta(days=EVENT_WINDOW_DAYS - 1), end)
        events.extend(
            _pages(
                get,
                "/smtp/statistics/events",
                "events",
                {"startDate": window_start.isoformat(), "endDate": window_end.isoformat(), "sort": "asc"},
                EVENT_PAGE,
            )
        )
        window_start = window_end + timedelta(days=1)
    return events


def suppression_reason(contact: dict, our_senders: set[str]) -> str:
    """Why this blocked contact should stop getting the daily, or "" if it should not."""
    reason = contact.get("reason")
    code = str(reason.get("code") or "") if isinstance(reason, dict) else ""
    sender = str(contact.get("senderEmail") or "").strip().lower()
    if code == "hardBounce":
        # The address itself is dead, whoever found out.
        return "hard_bounce"
    if sender and sender not in our_senders:
        # Filed under the account's other sender. If it was one of our sends,
        # the matching event on it says so (see opt_outs_from_events).
        return ""
    if code.startswith("unsubscribed"):
        return "unsubscribe"
    if code == "contactFlaggedAsSpam":
        return "complaint"
    if code == "adminBlocked":
        return "blocked_in_brevo"
    return ""


def _email_on(profile: dict) -> bool:
    """send_audience_newsletter._email_enabled: on unless explicitly turned off."""
    if "dailyNewsletterEnabled" in profile:
        return profile.get("dailyNewsletterEnabled") is True
    if "newsletterOptIn" in profile:
        return profile.get("newsletterOptIn") is True
    return True


def _suppression_id(email: str) -> str:
    return hashlib.sha1(email.encode("utf-8")).hexdigest()


def _candidates(contacts: list[dict], records: list[tuple[str, dict]], our_senders: set[str]) -> dict[str, dict]:
    """email -> the latest block worth applying, from Brevo's list and our sends' events."""
    found: dict[str, dict] = {}

    def offer(email: str, reason: str, at: str, source: str, detail: str) -> None:
        email = email.strip().lower()
        if not email or not reason or not at or reserved_recipient(email):
            return
        current = found.get(email)
        if current is None or (_parse(at) or datetime.min.replace(tzinfo=timezone.utc)) > _parse(current["at"]):
            found[email] = {"reason": reason, "at": at, "source": source, "detail": detail[:300]}

    for contact in contacts:
        reason_obj = contact.get("reason") if isinstance(contact.get("reason"), dict) else {}
        offer(
            str(contact.get("email") or ""),
            suppression_reason(contact, our_senders),
            _utc_iso(contact.get("blockedAt")),
            f"blocked:{reason_obj.get('code') or ''}",
            f"{contact.get('senderEmail') or ''} {reason_obj.get('message') or ''}".strip(),
        )
    for _, record in records:
        reason = EVENT_SUPPRESSIONS.get(record["kind"], "")
        offer(record["email"], reason, record["at"], f"event:{record['kind']}", record.get("detail", ""))
    return found


def apply_suppressions(db: Any, candidates: dict[str, dict], dry_run: bool) -> dict:
    """Record each new block and turn the daily off where it is still on. Returns counts."""
    recorded = {doc.id: doc.to_dict() or {} for doc in db.collection(SUPPRESSIONS_COLLECTION).stream()}

    def is_new(email: str, block: dict) -> bool:
        prior = _parse(recorded.get(_suppression_id(email), {}).get("blocked_at"))
        at = _parse(block["at"])
        return prior is None or (at is not None and at > prior + SAME_BLOCK)

    fresh = {email: block for email, block in candidates.items() if is_new(email, block)}
    result: dict = {"candidates": len(candidates), "new": 0, "profiles": 0, "landing": 0, "reasons": {}, "changes": []}
    if not fresh:
        return result

    # One pass over each list, rather than a query per address.
    profiles: dict[str, list[tuple[str, bool]]] = {}
    fields = ["email", "dailyNewsletterEnabled", "newsletterOptIn"]
    for doc in db.collection("user_profiles").select(fields).stream():
        data = doc.to_dict() or {}
        email = str(data.get("email") or "").strip().lower()
        if email in fresh:
            profiles.setdefault(email, []).append((doc.id, _email_on(data)))
    landing: dict[str, list[tuple[str, bool]]] = {}
    for doc in db.collection("free_newsletter_subscribers").stream():
        data = doc.to_dict() or {}
        email = str(data.get("email") or doc.id).strip().lower()
        if email in fresh:
            landing.setdefault(email, []).append((doc.id, data.get("active") is True))

    now = datetime.now(timezone.utc).isoformat()
    reasons: Counter = Counter()
    for email, block in fresh.items():
        reason, at = block["reason"], block["at"]
        uids = [uid for uid, on in profiles.get(email, []) if on]
        forms = [doc_id for doc_id, active in landing.get(email, []) if active]
        if uids or forms:
            reasons[reason] += 1
            result["new"] += 1
            result["profiles"] += len(uids)
            result["landing"] += len(forms)
            result["changes"].append(
                {"email": _mask(email), "reason": reason, "source": block["source"], "at": at, "detail": block["detail"]}
            )
        if dry_run:
            continue
        for uid in uids:
            # Same flags as /api/unsubscribe, so every reader of the preference agrees.
            update = {
                "dailyNewsletterEnabled": False,
                "newsletterOptIn": False,
                "newsletterSuppressedAt": now,
                "newsletterSuppressedReason": reason,
            }
            if reason in OPT_OUTS:
                update["newsletterUnsubscribedAt"] = at
            db.collection("user_profiles").document(uid).set(update, merge=True)
        for doc_id in forms:
            db.collection("free_newsletter_subscribers").document(doc_id).set(
                {"active": False, "unsubscribedAt": at, "unsubscribeReason": f"brevo:{reason}"},
                merge=True,
            )
        # Recorded even when there was nothing left to turn off: a reader who
        # turns the daily back on must not be switched off again by this block.
        db.collection(SUPPRESSIONS_COLLECTION).document(_suppression_id(email)).set(
            {
                "email": email,
                "reason": reason,
                "blocked_at": at,
                "source": block["source"],
                "detail": block["detail"],
                "applied_at": now,
                "profiles": len(uids),
                "landing": len(forms),
            }
        )
    result["reasons"] = dict(reasons)
    return result


def _event_record(event: dict, send: dict) -> tuple[str, dict] | None:
    kind = EVENT_KINDS.get(str(event.get("event") or ""))
    at = _utc_iso(event.get("date"))
    if not kind or not at:
        return None
    message_id = _norm_message_id(event.get("messageId"))
    link = str(event.get("link") or "")
    raw = "|".join((message_id, str(event.get("event")), str(event.get("date")), link))
    doc_id = "brevo-" + hashlib.sha1(raw.encode("utf-8")).hexdigest()[:32]
    return doc_id, {
        "kind": kind,
        "source": "brevo",
        "track_id": str(send.get("track_id") or ""),
        "email": str(send.get("to") or event.get("email") or "").strip().lower(),
        "bucket": str(send.get("bucket") or ""),
        "send_date": str(send.get("date") or ""),
        "message_id": message_id,
        "target": _strip_visit_id(link) if kind == "click" else "",
        # Brevo's bounce reason (the receiving server's reply).
        "detail": str(event.get("reason") or "")[:300] if kind in ("bounce", "blocked") else "",
        "user_agent": "",
        "at": at,
        "date": at[:10],
    }


def our_event_records(db: Any, events: list[dict], since: date) -> tuple[list[tuple[str, dict]], int]:
    """Events on our own sends, as email_events docs; plus how many were not ours."""
    sends: dict[str, dict] = {}
    oldest = (since - timedelta(days=SEND_LOOKBACK_DAYS)).isoformat()
    for doc in db.collection("email_sends").where("date", ">=", oldest).stream():
        data = doc.to_dict() or {}
        message_id = _norm_message_id(data.get("message_id"))
        if message_id:
            sends[message_id] = data

    records: dict[str, dict] = {}
    others = 0
    for event in events:
        if str(event.get("event") or "") not in EVENT_KINDS:
            continue
        send = sends.get(_norm_message_id(event.get("messageId")))
        if send is None:
            others += 1
            continue
        record = _event_record(event, send)
        if record is not None:
            records[record[0]] = record[1]
    return list(records.items()), others


def store_events(db: Any, records: list[tuple[str, dict]], since: date, dry_run: bool) -> dict:
    """Write the records not already stored, in batches. Returns counts by kind."""
    # Stored dates are UTC; Brevo's window is in the account's time zone.
    oldest = (since - timedelta(days=1)).isoformat()
    existing = {doc.id for doc in db.collection(EVENTS_COLLECTION).where("date", ">=", oldest).select(["kind"]).stream()}
    new = [(doc_id, data) for doc_id, data in records if doc_id not in existing]
    if not dry_run:
        for start in range(0, len(new), WRITE_BATCH):
            batch = db.batch()
            for doc_id, data in new[start:start + WRITE_BATCH]:
                batch.set(db.collection(EVENTS_COLLECTION).document(doc_id), data)
            batch.commit()
    return {
        "matched": len(records),
        "stored": len(new),
        "kinds": dict(Counter(data["kind"] for _, data in new)),
    }


def _is_end_date_error(exc: Exception) -> bool:
    response = getattr(exc, "response", None)
    return getattr(response, "status_code", None) == 400 and "date" in str(getattr(response, "text", "")).lower()


def sync_brevo(
    db: Any,
    *,
    dry_run: bool = False,
    full: bool = False,
    get: Getter | None = None,
    today: date | None = None,
) -> dict:
    """Apply opt-outs and bounces, then store events. Raises when Brevo cannot be read."""
    if get is None:
        api_key = (os.getenv("BREVO_API_KEY", "") or "").strip()
        if not api_key:
            return {"skipped": "BREVO_API_KEY is not set"}
        get = _brevo_getter(api_key)
    today = today or datetime.now(timezone.utc).date()
    state_ref = db.collection(STATE_COLLECTION).document(STATE_DOC)
    state = state_ref.get()
    state_data = (state.to_dict() or {}) if state.exists else {}
    last = None if full else state_data.get("synced_through")
    try:
        since = min(date.fromisoformat(str(last)), today) - timedelta(days=OVERLAP_DAYS) if last else None
    except ValueError:
        since = None
    events_since = since or today - timedelta(days=BACKFILL_DAYS)

    def fetch(end: date) -> tuple[list[dict], list[dict]]:
        return fetch_blocked(get, since, end), fetch_events(get, min(events_since, end), end)

    try:
        contacts, events = fetch(today)
    except Exception as exc:
        # Brevo refuses an end date past the account's own today. UTC is
        # behind the account's time zone (IST) today; if that ever flips, a
        # day earlier still works.
        if not _is_end_date_error(exc):
            raise
        today -= timedelta(days=1)
        contacts, events = fetch(today)

    our_senders = {sender.strip().lower() for sender in (brevo_sender()[0], LOCAL_SENDER_EMAIL) if sender}
    records, others = our_event_records(db, events, events_since)
    suppressions = apply_suppressions(db, _candidates(contacts, records, our_senders), dry_run)
    # Logged before the event writes, so a failure there does not hide it.
    _log(_suppression_summary(suppressions, dry_run))
    stored = store_events(db, records, events_since, dry_run)
    stored["not_ours"] = others

    result = {
        "dry_run": dry_run,
        "window": [since.isoformat() if since else "all", today.isoformat()],
        "suppressions": suppressions,
        "events": stored,
    }
    if not dry_run:
        state_ref.set(
            {
                "synced_through": today.isoformat(),
                "last_run_at": datetime.now(timezone.utc).isoformat(),
                "last_result": result,
            }
        )
    return result


def _suppression_summary(s: dict, dry_run: bool) -> str:
    reasons = ", ".join(f"{k} {v}" for k, v in sorted(s["reasons"].items())) or "none new"
    verb = "would turn" if dry_run else "turned"
    return (
        f"{verb} the daily off for {s['new']} address(es) ({reasons}; "
        f"{s['profiles']} profile(s), {s['landing']} form signup(s))"
    )


def summary(result: dict) -> str:
    if result.get("skipped"):
        return f"skipped: {result['skipped']}"
    kinds = ", ".join(f"{k} {v}" for k, v in sorted(result["events"]["kinds"].items())) or "none"
    return (
        f"{_suppression_summary(result['suppressions'], result.get('dry_run', False))}; "
        f"new events on our sends: {kinds}"
    )


def main() -> None:
    from dotenv import load_dotenv

    load_dotenv(BACKEND_ROOT.parent / ".env")
    from v1.storage import FirestoreStore

    parser = argparse.ArgumentParser(description="Sync Brevo unsubscribes, bounces and events into the database.")
    parser.add_argument("--dry-run", action="store_true", help="List what would change without writing")
    parser.add_argument("--full", action="store_true", help="Ignore the last sync and re-read everything")
    args = parser.parse_args()
    result = sync_brevo(FirestoreStore().db, dry_run=args.dry_run, full=args.full)
    _log(summary(result))
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
