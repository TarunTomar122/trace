#!/usr/bin/env python3
"""List everyone still on a paid plan, for the free-launch wind-down.

Read-only: prints a CSV (email, name, web status, app status, Dodo
subscription id, next billing date) so the subscriptions can be cancelled in
the Dodo / RevenueCat dashboards and the thank-you email sent. It never
writes or cancels anything.

  TRACE_DB=local python3 scripts/free-launch/list_paying_users.py > paying.csv
"""

from __future__ import annotations

import csv
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(REPO_ROOT / ".env")

from v1.storage import FirestoreStore  # noqa: E402

PAID = {"active", "trial", "on_hold"}


def main() -> None:
    store = FirestoreStore()
    writer = csv.writer(sys.stdout)
    writer.writerow(["email", "name", "web_status", "app_status", "subscription_id", "next_billing_date"])
    rows = 0
    for doc in store.db.collection("user_profiles").stream():
        p = doc.to_dict() or {}
        web = str(p.get("subscriptionStatus") or "none")
        app = str(p.get("appSubscriptionStatus") or "none")
        if web not in PAID and app not in PAID:
            continue
        writer.writerow([
            p.get("email", ""),
            p.get("name") or p.get("displayName") or "",
            web,
            app,
            p.get("subscriptionId", ""),
            p.get("nextBillingDate", ""),
        ])
        rows += 1
    print(f"{rows} paying or on-hold accounts", file=sys.stderr)


if __name__ == "__main__":
    main()
