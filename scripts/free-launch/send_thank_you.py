#!/usr/bin/env python3
"""Thank the people who paid for Trace, now that it is free for everyone.

Dry run by default: lists recipients and writes a preview, sends nothing.

  cd backend
  ../.venv/bin/python ../scripts/free-launch/send_thank_you.py --snapshot ../paying.json   # save the list now
  ../.venv/bin/python ../scripts/free-launch/send_thank_you.py --from ../paying.json        # dry run + preview
  ../.venv/bin/python ../scripts/free-launch/send_thank_you.py --from ../paying.json --test-to you@example.com
  ../.venv/bin/python ../scripts/free-launch/send_thank_you.py --from ../paying.json --send

Take the snapshot before cancelling subscriptions in Dodo: cancelling flips
their status, so a live lookup afterwards would miss them. Sends go through
Brevo (bucket "supporter_thanks") and are logged in email_sends; anyone who
already has a sent "supporter_thanks" email is skipped, so re-running is safe.
"""

from __future__ import annotations

import argparse
import html
import json
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
for path in (REPO_ROOT / "backend", REPO_ROOT):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(REPO_ROOT / ".env")

from v1.storage import FirestoreStore  # noqa: E402

BUCKET = "supporter_thanks"
PAID = {"active", "trial", "on_hold"}
APP_URL = (os.getenv("TRACE_APP_URL") or "https://www.yourtrace.online").rstrip("/")
SUBJECT = "Thank you. Trace is free for everyone now"


def first_name(name: str) -> str:
    name = (name or "").strip()
    if not name:
        return "there"
    first = name.split()[0]
    # "farouk" and "MICHELLE" read as Farouk and Michelle; leave "McKay" alone.
    return first.capitalize() if first.islower() or first.isupper() else first


def paying_supporters(store: FirestoreStore) -> list[dict]:
    people = []
    for doc in store.db.collection("user_profiles").stream():
        p = doc.to_dict() or {}
        web = str(p.get("subscriptionStatus") or "none")
        app = str(p.get("appSubscriptionStatus") or "none")
        email = str(p.get("email") or "").strip().lower()
        if email and (web in PAID or app in PAID) and p.get("deleted") is not True:
            people.append({"uid": doc.id, "email": email, "name": p.get("name") or p.get("displayName") or ""})
    return sorted(people, key=lambda person: person["email"])


def already_thanked(store: FirestoreStore) -> set[str]:
    docs = store.db.collection("email_sends").where("bucket", "==", BUCKET).stream()
    return {
        str((d.to_dict() or {}).get("to", "")).strip().lower()
        for d in docs
        if (d.to_dict() or {}).get("status") == "sent"
    }


def render(name: str) -> tuple[str, str]:
    hi = f"Hi {first_name(name)},"
    paragraphs = [
        "You were one of the first people to pay for Trace, and I wanted you to hear this from me "
        "first: starting today, Trace is free for everyone.",
        "Your support is what got Trace this far. It paid for the servers, the AI summaries and the "
        "late nights that turned a side project into something people open every morning.",
        "Trace is now part of Anthropic's Claude startup programme, which gives us the resources to "
        "run all of it, the feed, the daily brief and the apps, for free.",
        "I've cancelled your subscription, so you won't be charged again. Your account stays Pro; "
        "the only thing that changes is the bill.",
        f"New since you joined: you can customize your daily email, with your topics, 5, 10 or 15 "
        f"stories, and images if you like, at {APP_URL}/brief/customize",
        "Thank you for believing in Trace early. You made this possible.",
    ]
    text = "\n\n".join([hi, *paragraphs, "Tarat"])
    font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    body = "".join(
        f'<p style="margin: 0 0 16px 0; font-size: 16px; line-height: 25px; color: #0f1419; '
        f'font-family: {font};">{html.escape(p)}</p>'
        for p in [hi, *paragraphs]
    ).replace(
        html.escape(f"{APP_URL}/brief/customize"),
        f'<a href="{APP_URL}/brief/customize?from=thanks" style="color: #1d9bf0; font-weight: 700;">'
        f"{html.escape(APP_URL.replace('https://', ''))}/brief/customize</a>",
    )
    page = (
        '<!doctype html><html><body style="margin: 0; padding: 0; background: #ffffff;">'
        '<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" '
        'style="padding: 32px 16px;"><table width="100%" cellpadding="0" cellspacing="0" border="0" '
        'style="max-width: 560px;"><tr><td>'
        f'<p style="margin: 0 0 24px 0; font-size: 12px; font-weight: 800; letter-spacing: 0.14em; '
        f'color: #1d9bf0; font-family: {font};">TRACE</p>'
        f"{body}"
        f'<p style="margin: 8px 0 0 0; font-size: 16px; font-weight: 700; color: #0f1419; '
        f'font-family: {font};">Tarat</p>'
        "</td></tr></table></td></tr></table></body></html>"
    )
    return page, text


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--snapshot", help="save the current paying supporters to this JSON file and exit")
    parser.add_argument("--from", dest="source", help="read recipients from a --snapshot file")
    parser.add_argument("--test-to", help="send one copy to this address only")
    parser.add_argument("--send", action="store_true", help="actually email every recipient")
    parser.add_argument("--preview", default="thank-you-preview.html", help="where to write the HTML preview")
    args = parser.parse_args()

    store = FirestoreStore()
    if args.snapshot:
        people = paying_supporters(store)
        Path(args.snapshot).write_text(json.dumps(people, indent=1))
        print(f"saved {len(people)} paying supporters to {args.snapshot}")
        return

    people = json.loads(Path(args.source).read_text()) if args.source else paying_supporters(store)
    page, _ = render("Tarat Tomar")
    Path(args.preview).write_text(page)
    print(f"preview: {args.preview}")

    # Route this one-off through Brevo, like the members' daily.
    buckets = os.getenv("EMAIL_BREVO_BUCKETS", "")
    if BUCKET not in buckets.split(","):
        os.environ["EMAIL_BREVO_BUCKETS"] = ",".join(filter(None, [buckets, BUCKET]))
    from v1.tools.email_sender import send_email

    if args.test_to:
        page, text = render(people[0]["name"] if people else "")
        result = send_email(args.test_to, None, f"[test] {SUBJECT}", page, text, bucket="test")
        print(f"test sent to {args.test_to} via {result.get('transport')}")
        return

    done = already_thanked(store)
    todo = [p for p in people if p["email"] not in done]
    print(f"{len(people)} supporters, {len(done & {p['email'] for p in people})} already thanked, {len(todo)} to send")
    failed: list[str] = []
    for person in todo:
        if not args.send:
            print(f"  [dry-run] {person['email']}  ({first_name(person['name'])})")
            continue
        page, text = render(person["name"])
        result = send_email(person["email"], person["name"] or None, SUBJECT, page, text, bucket=BUCKET)
        if result.get("success") is False:
            failed.append(person["email"])
            print(f"  FAILED {person['email']} via {result.get('transport')}: {result.get('error')}")
        else:
            print(f"  sent {person['email']} via {result.get('transport')}")
    if not args.send:
        print("dry run: nothing sent (add --send)")
    elif failed:
        print(f"{len(failed)} failed; re-run to retry them (sent ones are skipped)")
        sys.exit(1)


if __name__ == "__main__":
    main()
