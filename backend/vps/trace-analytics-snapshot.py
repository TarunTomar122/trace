"""The data behind Trace's /admin/analytics Signups and System tabs, every 5 minutes.

Runs as root (trace-analytics-snapshot.service) and writes /var/lib/trace-analytics-snapshot/latest.json,
owned root:trace-web 0640 so only the web service can read it: the Signups list carries full emails, like
StocksBrew's own admin page. Read only everywhere else. Each part fails soft: a broken check, an unreachable
Firebase or a locked database leaves its own part out (or reuses the last good value) and the rest is written.

  health, total, active, daily, channels, forms, referrers, referred, updated
                the original aggregate keys, kept for the current page
  signups       every person who signed up (newsletter, account or both), newest first, capped at MAX_ROWS,
                plus the counts and every signup time for the tiles
  ops           {latest, history}: the shape of StocksBrew's tm_ops_health docs (frontend
                lib/analytics/ops-health.ts parses it), about Trace: its web app, LocalDB, jobs and backups,
                with the box numbers copied from StocksBrew's own health run so both tabs agree

The rolling 24 h check history lives in ops-history.json next to it (root only).

StocksBrew's checker (backend/ops/health.py in the StocksBrew repo) is used for the HTTP probes, the Caddy log
parsing and the journal summaries. This runs as root, so it loads only a root-owned copy installed next to it
(/usr/local/lib/trace-analytics/sb_health.py), never /opt/tikrr, which the ubuntu user can write; reinstalling
refreshes the copy (docs/trace-admin-analytics.md). Without it, those parts report "unknown" and the rest runs.

The whole run keeps to a time budget (BUDGET_S, under the unit's TimeoutStartSec): once it is spent, the slow
parts left are skipped and latest.json is still written.
"""
from __future__ import annotations

import base64
import contextlib
import glob
import hashlib
import hmac
import importlib.util
import json
import os
import re
import sqlite3
import stat
import subprocess
import sys
import tempfile
import time
import traceback
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable, Iterable

UTC = timezone.utc
OUT_DIR = Path(os.environ.get("TRACE_SNAPSHOT_DIR", "/var/lib/trace-analytics-snapshot"))
SB_DB = "/var/lib/tikrr/localdb/documents.sqlite3"
TRACE_DB = "/srv/tikrr-data/trace-data/localdb/documents.sqlite3"
SB_HEALTH = "/usr/local/lib/trace-analytics/sb_health.py"
FIREBASE_KEY = "/etc/trace/web-firebase.json"
REFERRAL_ENV = "/home/ubuntu/trace/.env"
BACKUP_DIR = "/srv/tikrr-data/trace-data/backups"
BACKUP_ENV = "/etc/trace/backup.env"
# Trace has no access log yet (db.yourtrace.online has no `log` block): traffic shows "unknown" until it does.
CADDY_LOG = os.environ.get("TRACE_CADDY_LOG", "/var/log/caddy/trace.log")
# Seconds the whole run may take before the slow parts left are skipped (TimeoutStartSec is 120).
BUDGET_S = 90
_STARTED = time.monotonic()


def left() -> float:
    """Seconds of the run's budget still left (never below 0)."""
    return max(0.0, BUDGET_S - (time.monotonic() - _STARTED))
WEB = "http://127.0.0.1:3817"
LOCALDB = "http://127.0.0.1:8502"
PUBLIC = "https://www.yourtrace.online"
USER_AGENT = "trace-ops-health/1"
LOCAL_HEADERS = {"Host": "www.yourtrace.online", "X-Forwarded-Proto": "https"}
TRACE_USER = "ubuntu"
TRACE_UID = 1000
CGROUP_ROOT = "/sys/fs/cgroup"

MAX_ROWS = 500
DAY_MS = 24 * 3600 * 1000
HISTORY_HOURS = 24
HISTORY_MAX = 320
STATUS_LETTER = {"ok": "g", "warn": "a", "fail": "r", "unknown": "u"}
STATUS_RANK = {"ok": 0, "unknown": 1, "warn": 2, "fail": 3}
# Long-running services and this job itself: their resource lines come at restarts, not runs.
NOT_JOBS = {"trace-web.service", "trace-localdb.service", "trace-analytics-snapshot.service"}
# Box checks copied from StocksBrew's run, so the two System tabs show the same numbers.
SB_BOX_CHECKS = ("memory", "swap", "load")
LEGACY_KEYS = ("total", "active", "daily", "channels", "forms", "referrers", "referred")


def root_only(path: str) -> bool:
    """True when the file and its folder belong to root and nobody else can write them: what root may execute."""
    for item in (path, os.path.dirname(path) or "."):
        info = os.stat(item)
        if info.st_uid != 0 or info.st_mode & (stat.S_IWGRP | stat.S_IWOTH):
            return False
    return True


def load_sb_health(path: str = SB_HEALTH, *, require_root: bool = True) -> Any:
    """StocksBrew's health module, loaded by file path (no package import), or None. As root, only a root-owned copy
    that no one else can write is loaded: code from a folder another user can change must never run as root."""
    try:
        if require_root and os.geteuid() == 0 and not root_only(path):
            print("[snapshot] refusing health module: not root-owned or writable by others", file=sys.stderr)
            return None
        spec = importlib.util.spec_from_file_location("sb_ops_health", path)
        if spec is None or spec.loader is None:
            return None
        module = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = module  # its dataclasses look themselves up there
        spec.loader.exec_module(module)
        # Our probes say who they are, and parse_access then leaves them out of the traffic numbers.
        module.USER_AGENT = USER_AGENT
        return module
    except Exception as error:  # noqa: BLE001
        print(f"[snapshot] StocksBrew health.py not loaded: {type(error).__name__}", file=sys.stderr)
        return None


# ---------------------------------------------------------------------------------------------------------------
# Small pure helpers (backend/tests/test_trace_analytics_snapshot.py).


def iso(value: datetime | None) -> str | None:
    return value.astimezone(UTC).isoformat(timespec="seconds") if value else None


def ms_of(value: Any) -> int | None:
    """Epoch ms from an ISO string, epoch seconds or ms, or a LocalDB/Firestore timestamp object."""
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, dict):
        if value.get("__localdb_type__") == "timestamp":
            return ms_of(value.get("value"))
        for key in ("_seconds", "seconds"):
            if isinstance(value.get(key), (int, float)):
                return int(value[key] * 1000)
        return None
    if isinstance(value, (int, float)):
        return int(value if value > 1e11 else value * 1000) if value > 0 else None
    if isinstance(value, str) and value.strip():
        text = value.strip()
        if text.isdigit():
            return ms_of(int(text))
        try:
            parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        except ValueError:
            return None
        return int((parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)).timestamp() * 1000)
    return None


def clean(value: Any, limit: int = 40) -> str | None:
    return value.strip().lower()[:limit] if isinstance(value, str) and value.strip() else None


def method_of(providers: Iterable[str] | None) -> str | None:
    ids = list(providers or [])
    if not ids:
        return None
    if "google.com" in ids:
        return "google"
    if "apple.com" in ids:
        return "apple"
    if "password" in ids or "emailLink" in ids:
        return "email"
    if "phone" in ids:
        return "phone"
    return "other"


def safe_photo(value: Any) -> str | None:
    """Google's photo host only: an arbitrary photo URL would tell its owner when the admin page was opened."""
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        url = urllib.parse.urlsplit(value.strip())
    except ValueError:
        return None
    host = (url.hostname or "").lower()
    return value.strip() if url.scheme == "https" and (host == "googleusercontent.com" or host.endswith(".googleusercontent.com")) else None


ACTIVE = ("trial", "active")
LAPSED = ("cancelled", "on_hold", "failed", "payment_failed", "expired")


def plan_of(data: dict[str, Any], now_ms: int) -> dict[str, Any]:
    """paid / trial / free, the way frontend lib/subscription-access.ts hasPaidSubscription decides it."""
    web = str(data.get("subscriptionStatus") or "none").strip().lower()
    app = str(data.get("appSubscriptionStatus") or "none").strip().lower()
    if app in ACTIVE:
        return {"plan": "paid" if app == "active" else "trial", "note": "in the app", "paying": app == "active", "lapsed": False}
    if web in ACTIVE:
        ends = ms_of(data.get("willCancelAt")) or ms_of(data.get("nextBillingDate"))
        if data.get("cancelledAt") and ends is not None and now_ms >= ends:
            return {"plan": "free", "note": "cancelled", "paying": False, "lapsed": True}
        note = "cancels at period end" if data.get("cancelledAt") or data.get("willCancelAt") else None
        paying = web == "active" and bool(data.get("subscriptionId"))
        if web == "active" and not data.get("subscriptionId"):
            note = note or "no subscription on file"
        return {"plan": "paid" if web == "active" else "trial", "note": note, "paying": paying, "lapsed": False}
    if web in LAPSED or app in LAPSED:
        return {"plan": "free", "note": (web if web in LAPSED else app).replace("_", " "), "paying": False, "lapsed": True}
    return {"plan": "free", "note": "comped" if data.get("manualCompedAt") else None, "paying": False, "lapsed": False}


def from_of(data: dict[str, Any]) -> dict[str, Any] | None:
    """Where a signup came from: the first-touch channel (since Nov 22), a reader's link, a utm tag, an affiliate
    link, or else the person's own answer to "How did you hear about us?" (heard=True)."""
    channel = clean(data.get("channel")) or clean(data.get("signupChannel"))
    if channel:
        return {"id": channel, "heard": False}
    if clean(data.get("referredBy")):
        return {"id": "referral", "heard": False}
    utm = clean(data.get("utmSource"))
    if utm:
        return {"id": utm, "heard": False}
    if clean(data.get("affiliateCode")):
        return {"id": "affiliate", "heard": False}
    heard = clean(data.get("referralSource"))
    return {"id": heard, "heard": True} if heard else None


def came_back(created_ms: int | None, last_ms: int | None, now_ms: int) -> bool | None:
    """Seen a day or more after signing up; None while under a day old."""
    if created_ms is None or now_ms - created_ms < DAY_MS:
        return None
    return last_ms is not None and last_ms - created_ms >= DAY_MS


def _max(*values: int | None) -> int | None:
    known = [v for v in values if isinstance(v, int)]
    return max(known) if known else None


def _id(prefix: str, value: str) -> str:
    return prefix + hashlib.sha256(value.encode()).hexdigest()[:12]


def build_signups(auth: list[dict[str, Any]] | None, profiles: dict[str, dict[str, Any]], subscribers: list[tuple[str, dict[str, Any]]], referred: dict[str, int], now_ms: int) -> dict[str, Any]:
    """Accounts (Firebase Auth, else profiles) joined with their profile, and newsletter readers joined by email."""
    auth_by_id = {a["uid"]: a for a in (auth or [])}
    if auth is not None:
        uids = [uid for uid in auth_by_id if not (profiles.get(uid) or {}).get("deleted")]
    else:
        uids = [uid for uid, p in profiles.items() if not p.get("deleted") and (clean(p.get("email"), 320) or ms_of(p.get("createdAt")) is not None)]

    rows: dict[str, dict[str, Any]] = {}
    by_email: dict[str, str] = {}
    for uid in uids:
        a, p = auth_by_id.get(uid) or {}, profiles.get(uid) or {}
        email = clean(a.get("email"), 320) or clean(p.get("email"), 320)
        created = a.get("createdMs") or ms_of(p.get("createdAt"))
        last = _max(a.get("lastRefreshMs"), a.get("lastSignInMs"), ms_of(p.get("lastActiveAt")))
        plan = plan_of(p, now_ms) if p else None
        platform = clean(p.get("signupPlatform"))
        rows[uid] = {
            "id": uid,
            "email": email,
            "name": (str(a.get("displayName") or p.get("displayName") or p.get("name") or "").strip() or None),
            "photo": safe_photo(a.get("photoURL")) or safe_photo(p.get("photoURL")),
            "createdMs": created,
            "kind": "account",
            "method": method_of(a.get("providers")) if a else None,
            "plan": plan["plan"] if plan else None,
            "planNote": plan["note"] if plan else None,
            "paying": bool(plan and plan["paying"]),
            "lapsed": bool(plan and plan["lapsed"]),
            "newsletter": None,
            "lastSeenMs": last,
            "cameBack": came_back(created, last, now_ms),
            "from": from_of(p) if p else None,
            "form": f"app_{platform}" if platform in ("web", "mobile") else ("app" if p or a else None),
        }
        if email and email not in by_email:
            by_email[email] = uid

    seen_readers: set[str] = set()
    for doc_id, s in sorted(subscribers, key=lambda item: ms_of(item[1].get("subscribedAt")) or 0):
        email = clean(s.get("email"), 320)
        if not email or email in seen_readers:
            continue
        seen_readers.add(email)
        at = ms_of(s.get("subscribedAt"))
        status = "on" if s.get("active") is True else "off"
        source = clean(s.get("source")) or "landing_page"
        uid = by_email.get(email)
        if uid:
            row = rows[uid]
            row["kind"], row["newsletter"] = "both", status
            if at is not None and (row["createdMs"] is None or at < row["createdMs"]):
                row["createdMs"], row["form"] = at, source
                row["cameBack"] = came_back(at, row["lastSeenMs"], now_ms)
            row["from"] = row["from"] or from_of(s)
            continue
        rows[_id("n", doc_id)] = {
            "id": _id("n", doc_id),
            "email": email,
            "name": None,
            "photo": None,
            "createdMs": at,
            "kind": "newsletter",
            "method": None,
            "plan": None,
            "planNote": None,
            "paying": False,
            "lapsed": False,
            "newsletter": status,
            "lastSeenMs": None,
            "cameBack": None,
            "from": from_of(s),
            "form": source,
        }

    ordered = sorted(rows.values(), key=lambda r: (-(r["createdMs"] or -1), r["id"]))
    accounts = [r for r in ordered if r["kind"] != "newsletter"]
    readers = [r for r in ordered if r["newsletter"] is not None]
    eligible = [r for r in accounts if r["cameBack"] is not None]
    paid = [r for r in accounts if r["plan"] in ("paid", "trial")]
    return {
        "total": len(ordered),
        "created": sorted(r["createdMs"] for r in ordered if isinstance(r["createdMs"], int)),
        "newsletter": {"active": sum(r["newsletter"] == "on" for r in readers), "total": len(readers)},
        "accounts": {"total": len(accounts), "cameBack": sum(bool(r["cameBack"]) for r in eligible), "eligible": len(eligible)},
        "referred": {"count": int(referred.get("count", 0)), "readers": int(referred.get("readers", 0))},
        "paid": {"count": len(paid), "paying": sum(r["paying"] for r in paid), "trial": sum(r["plan"] == "trial" for r in paid), "lapsed": sum(r["lapsed"] for r in accounts)},
        "authMissing": auth is None,
        "rowsTotal": len(ordered),
        "rows": [{k: v for k, v in r.items() if k != "lapsed"} for r in ordered[:MAX_ROWS]],
    }


# ---------------------------------------------------------------------------------------------------------------
# System tab helpers, pure.


def check(id: str, group: str, label: str, status: str, detail: str, **extra: Any) -> dict[str, Any]:
    row = {"id": id, "group": group, "label": label, "status": status, "detail": detail}
    row.update({k: v for k, v in extra.items() if v is not None})
    return row


def worst(statuses: Iterable[str]) -> str:
    """Like health.py: a check that could not run (unknown) never turns the whole thing red."""
    known = [s for s in statuses if s != "unknown"]
    return max(known, key=lambda s: STATUS_RANK[s]) if known else "unknown"


def ago_words(seconds: float) -> str:
    seconds = max(0, int(seconds))
    if seconds < 90:
        return f"{seconds}s ago"
    if seconds < 5400:
        return f"{round(seconds / 60)} min ago"
    if seconds < 48 * 3600:
        return f"{seconds / 3600:.1f} h ago"
    return f"{seconds / 86400:.1f} days ago"


_RUN_SUFFIX = re.compile(r"-\d{4}-\d{2}-\d{2}-[^.]*(\.service)$")


def job_unit(entry: dict[str, Any]) -> str | None:
    """The Trace job a journal entry belongs to (system or user unit), one row per job: transient runs like
    trace-reel-2026-11-23-0600-slug.service fold into trace-reel.service."""
    unit = str(entry.get("UNIT") or entry.get("USER_UNIT") or "")
    unit = _RUN_SUFFIX.sub(r"\1", unit)
    if not unit.startswith("trace-") or not unit.endswith(".service") or unit in NOT_JOBS:
        return None
    return unit


def summarize_jobs(entries: Iterable[dict[str, Any]], summarize_units: Callable[[Iterable[dict[str, Any]]], list[dict[str, Any]]]) -> list[dict[str, Any]]:
    """StocksBrew's summarize_units only counts tikrr-* units: hand it each Trace job under a tikrr- alias and take
    the alias off again, so the runs, failures, wall times, CPU and memory peak are worked out the same way."""
    aliased = []
    for entry in entries:
        unit = job_unit(entry)
        if unit:
            aliased.append({**entry, "UNIT": "tikrr-" + unit})
    rows = summarize_units(aliased)
    for row in rows:
        row["unit"] = row["unit"].removeprefix("tikrr-")
    return rows


def daily_brief_check(newest_path: str | None, now: datetime) -> dict[str, Any]:
    """daily_editions/<YYYY-MM-DD>: today's is due by 10:00 UTC (it is written around 08:40)."""
    label = "Daily brief"
    match = re.search(r"(\d{4}-\d{2}-\d{2})$", newest_path or "")
    if not match:
        return check("daily_brief", "data", label, "fail", "no edition found")
    day = datetime.fromisoformat(match.group(1)).replace(tzinfo=UTC)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    if day >= today:
        return check("daily_brief", "data", label, "ok", "today's is out")
    if day >= today - timedelta(days=1):
        return check("daily_brief", "data", label, "ok" if now.hour < 10 else "warn", "yesterday's, today's due by 10:00 UTC" if now.hour < 10 else "today's is late")
    return check("daily_brief", "data", label, "fail", f"last one {match.group(1)}")


def pipeline_check(newest_ms: int | None, now: datetime) -> dict[str, Any]:
    """v3_pipeline_runs: the pipeline timer runs about every 20 minutes."""
    if newest_ms is None:
        return check("pipeline", "data", "Pipeline", "unknown", "no runs recorded")
    age = now.timestamp() - newest_ms / 1000
    status = "ok" if age < 3600 else "warn" if age < 3 * 3600 else "fail"
    return check("pipeline", "data", "Pipeline", status, f"last run {ago_words(age)}")


def backup_summary(files: list[tuple[str, float, int]], now: datetime, offsite: bool) -> tuple[dict[str, Any], dict[str, Any] | None]:
    """(check, summary) from the local backup files: (name, mtime, bytes), any order."""
    label = "LocalDB backup"
    if not files:
        return check("backup", "box", label, "warn", "no backup yet"), None
    files = sorted(files, key=lambda f: f[1])
    _name, mtime, size = files[-1]
    age = now.timestamp() - mtime
    status = "ok" if age < 26 * 3600 else "warn" if age < 50 * 3600 else "fail"
    at = iso(datetime.fromtimestamp(mtime, UTC))
    detail = f"last good one {ago_words(age)}" + ("" if offsite else ", this box only")
    summary = {
        "ok": True,
        "at": at,
        "error": None,
        "last_ok_at": at,
        "compressed_bytes": size,
        "backup_bytes": None,
        "documents": None,
        "timings": None,
        "dailies": len(files),
        "weeklies": 0,
        "offsite": offsite,
        "files": [{"at": iso(datetime.fromtimestamp(m, UTC)), "bytes": b} for _n, m, b in reversed(files[-8:])],
    }
    return check("backup", "box", label, status, detail), summary


def timer_rows(rows: list[dict[str, Any]], user: bool) -> list[dict[str, Any]]:
    """`systemctl list-timers -o json` rows for trace-* timers: what each activates and its next and last run."""
    def at(us: Any) -> str | None:
        return iso(datetime.fromtimestamp(us / 1e6, UTC)) if isinstance(us, (int, float)) and us > 0 else None

    out = []
    for row in rows:
        unit = str(row.get("unit") or "")
        activates = str(row.get("activates") or unit.replace(".timer", ".service"))
        if not unit.startswith("trace-") or activates in NOT_JOBS:
            continue
        out.append({"unit": activates, "next_at": at(row.get("next")), "last_at": at(row.get("last")), "user": user})
    return out


def merge_history(previous: dict[str, Any] | None, entry: dict[str, Any], now: datetime) -> list[dict[str, Any]]:
    cutoff = (now - timedelta(hours=HISTORY_HOURS)).isoformat(timespec="seconds")
    rows = [r for r in ((previous or {}).get("entries") or []) if isinstance(r, dict) and str(r.get("t") or "") > cutoff and r.get("t") != entry["t"]]
    rows.append(entry)
    rows.sort(key=lambda r: r["t"])
    return rows[-HISTORY_MAX:]


def history_entry(result: dict[str, Any]) -> dict[str, Any]:
    traffic = (result.get("traffic") or {}).get("last_5m") or {}
    return {
        "t": result["generated_at"],
        "o": STATUS_LETTER[result["overall"]],
        "c": {row["id"]: STATUS_LETTER.get(row["status"], "u") for row in result["checks"]},
        "r": traffic.get("requests"),
        "e": traffic.get("errors_5xx"),
        "p": traffic.get("p95_ms"),
    }


def with_cpu_share(rows: list[dict[str, Any]], previous: dict[str, Any] | None, now: datetime) -> list[dict[str, Any]]:
    """CPU % of one core since the previous run, from cumulative usage (None on the first run or after a restart)."""
    before = {r.get("name"): r for r in ((previous or {}).get("services") or []) if isinstance(r, dict)}
    then = ms_of((previous or {}).get("generated_at"))
    seconds = now.timestamp() - then / 1000 if then else 0
    for row in rows:
        old = before.get(row["name"])
        row["cpu_pct"] = None
        if old and seconds > 0 and isinstance(old.get("cpu_usec"), int) and isinstance(row.get("cpu_usec"), int) and row["cpu_usec"] >= old["cpu_usec"]:
            row["cpu_pct"] = round((row["cpu_usec"] - old["cpu_usec"]) / 1e6 / seconds * 100, 1)
    return rows


# ---------------------------------------------------------------------------------------------------------------
# Reading.


def database(path: str) -> sqlite3.Connection:
    return sqlite3.connect(f"file:{path}?mode=ro", uri=True, timeout=5)


def soft(name: str, fn: Callable[[], Any], default: Any = None) -> Any:
    """Run one part; on failure say which part and where, never the message (it could carry an email)."""
    try:
        return fn()
    except Exception as error:  # noqa: BLE001
        frame = traceback.extract_tb(error.__traceback__)[-1] if error.__traceback__ else None
        print(f"[snapshot] {name} failed: {type(error).__name__} at line {frame.lineno if frame else '?'}", file=sys.stderr)
        return default


def read_json(path: Path | str) -> dict[str, Any] | None:
    try:
        value = json.loads(Path(path).read_text())
        return value if isinstance(value, dict) else None
    except (OSError, ValueError):
        return None


def read_sb_ops() -> dict[str, Any]:
    with contextlib.closing(database(SB_DB)) as db:
        row = db.execute("SELECT data_json FROM documents WHERE path='tm_ops_health/latest'").fetchone()
    return json.loads(row[0]) if row else {}


def legacy_health(sb_latest: dict[str, Any]) -> dict[str, Any]:
    system = sb_latest.get("system") or {}
    health = {k: system.get(k) for k in ["cpus", "load", "mem_total", "mem_available", "disks"]}
    health["generated_at"] = sb_latest.get("generated_at")
    return health


def referral_secret(path: str = REFERRAL_ENV) -> str:
    """The backend's REFERRAL_SECRET (v3/lib/referral.py), to name who a share code belongs to."""
    try:
        for line in Path(path).read_text().splitlines():
            if line.startswith("REFERRAL_SECRET="):
                return line.split("=", 1)[1].split(" #", 1)[0].strip().strip("'\"")
    except OSError:
        pass
    return ""


def code_for(email: str, secret: str) -> str:
    digest = hmac.new(secret.encode(), email.encode(), hashlib.sha256).digest()
    return base64.b32encode(digest).decode().lower()[:8]


def masked(email: str) -> str:
    """ab•••@gmail.com: enough for the owner to recognise a reader, not the address."""
    name, _, domain = email.partition("@")
    return f"{name[:2] if len(name) > 4 else name[:1]}•••@{domain}" if domain else "a reader"


def ranked(counter: dict[str, int], limit: int = 12) -> list[dict[str, Any]]:
    return [{"label": k, "n": n} for k, n in sorted(counter.items(), key=lambda kv: (-kv[1], kv[0]))[:limit]]


def newsletter_counts(profiles: dict[str, dict[str, Any]], subscribers: list[tuple[str, dict[str, Any]]], secret: str, now: datetime) -> dict[str, Any]:
    """The original aggregate keys, from the rows already read for the Signups list. One person per email; their
    newsletter record decides, so a reader who later makes an account through a link isn't counted twice (backend
    v3/lib/referral.py counts the same way)."""
    def lower(value: Any) -> str | None:
        return value.strip().lower() if isinstance(value, str) and value.strip() else None

    people: dict[str, tuple[Any, Any]] = {}
    for rows, channel_field in ((((d, s) for d, s in subscribers), "channel"), (profiles.items(), "signupChannel")):
        for _doc, data in rows:
            email = lower(data.get("email"))
            if email and email not in people:
                ref = data.get("referredBy")
                people[email] = (data.get(channel_field), ref.lower() if isinstance(ref, str) else None)
    channels: dict[str, int] = {}
    codes: dict[str, set[str]] = {}
    for email, (channel, ref) in people.items():
        if channel:
            channels[str(channel)] = channels.get(str(channel), 0) + 1
        if ref and len(ref) == 8:
            codes.setdefault(ref, set()).add(email)
    forms: dict[str, int] = {}
    daily: dict[str, int] = {}
    first_day = (now - timedelta(days=29)).date().isoformat()
    today = now.date().isoformat()
    for _doc, data in subscribers:
        form = str(data.get("source") or "landing_page")
        forms[form] = forms.get(form, 0) + 1
        at = ms_of(data.get("subscribedAt"))
        day = datetime.fromtimestamp(at / 1000, UTC).date().isoformat() if at else None
        if day and first_day <= day <= today:
            daily[day] = daily.get(day, 0) + 1
    owners = {code_for(email, secret): email for email in people} if secret and codes else {}
    referrers = []
    for code, emails in codes.items():
        emails.discard(owners.get(code, ""))  # their own link
        if emails:
            referrers.append({"label": masked(owners[code]) if code in owners else f"code {code}", "code": code, "n": len(emails)})
    referrers.sort(key=lambda r: (-r["n"], r["label"]))
    return {
        "total": len(subscribers),
        "active": sum(data.get("active") is True for _doc, data in subscribers),
        "daily": dict(sorted(daily.items())),
        "channels": ranked(channels),
        "forms": ranked(forms),
        "referrers": referrers[:12],
        "referred": sum(r["n"] for r in referrers),
        "_readers": len(referrers),
    }


PROFILE_FIELDS = (
    "email", "displayName", "name", "photoURL", "createdAt", "lastActiveAt", "deleted", "signupPlatform",
    "subscriptionStatus", "appSubscriptionStatus", "subscriptionId", "cancelledAt", "willCancelAt", "nextBillingDate",
    "manualCompedAt", "referralSource", "utmSource", "affiliateCode", "signupChannel", "channel", "referredBy",
)
SUBSCRIBER_FIELDS = ("email", "active", "source", "subscribedAt", "channel", "referredBy", "utmSource")


def read_fields(db: sqlite3.Connection, collection: str, fields: tuple[str, ...]) -> list[tuple[str, dict[str, Any]]]:
    """Top-level docs of a collection, only the named fields (each as JSON via ->, so timestamps stay objects)."""
    columns = ", ".join(f"data_json -> '$.{f}'" for f in fields)
    out = []
    for doc_id, *values in db.execute(
        f"SELECT document_id, {columns} FROM documents WHERE collection=? AND path = collection || '/' || document_id", (collection,)
    ):
        data = {}
        for field, raw in zip(fields, values):
            if raw is not None:
                try:
                    data[field] = json.loads(raw)
                except ValueError:
                    pass
        out.append((doc_id, data))
    return out


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def firebase_accounts(key_path: str = FIREBASE_KEY, page_size: int = 1000, max_pages: int = 50) -> list[dict[str, Any]]:
    """Every Firebase Auth account over the REST API (no SDK on this box): a service-account JWT for an access
    token, then accounts:batchGet page by page. Raises on any failure; the caller falls back to profiles."""
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding

    # At most 30 s of the run's budget, so a slow Google never costs the System tab its turn.
    end = time.monotonic() + min(30.0, left())

    def timeout() -> float:
        remaining = end - time.monotonic()
        if remaining < 1:
            raise TimeoutError("Firebase listing ran out of time")
        return min(20.0, remaining)

    key = json.loads(Path(key_path).read_text())
    now = int(time.time())
    token_url = "https://oauth2.googleapis.com/token"
    header = _b64(json.dumps({"alg": "RS256", "typ": "JWT"}).encode())
    claims = _b64(json.dumps({"iss": key["client_email"], "scope": "https://www.googleapis.com/auth/identitytoolkit", "aud": token_url, "iat": now, "exp": now + 600}).encode())
    private = serialization.load_pem_private_key(key["private_key"].encode(), password=None)
    signature = _b64(private.sign(f"{header}.{claims}".encode(), padding.PKCS1v15(), hashes.SHA256()))  # type: ignore[call-arg,union-attr]
    body = urllib.parse.urlencode({"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": f"{header}.{claims}.{signature}"}).encode()
    request = urllib.request.Request(token_url, data=body, headers={"Content-Type": "application/x-www-form-urlencoded"})
    with urllib.request.urlopen(request, timeout=timeout()) as response:
        access = json.loads(response.read())["access_token"]
    base = f"https://identitytoolkit.googleapis.com/v1/projects/{urllib.parse.quote(key['project_id'])}/accounts:batchGet"
    users: list[dict[str, Any]] = []
    page_token, seen = "", set()
    for _ in range(max_pages):
        query = {"maxResults": page_size, **({"nextPageToken": page_token} if page_token else {})}
        request = urllib.request.Request(f"{base}?{urllib.parse.urlencode(query)}", headers={"Authorization": f"Bearer {access}"})
        with urllib.request.urlopen(request, timeout=timeout()) as response:
            page = json.loads(response.read())
        users.extend(page.get("users") or [])
        page_token = page.get("nextPageToken") or ""
        if not page_token or page_token in seen:
            break
        seen.add(page_token)
    return [auth_account(u) for u in users if u.get("localId")]


def auth_account(user: dict[str, Any]) -> dict[str, Any]:
    return {
        "uid": user["localId"],
        "email": user.get("email"),
        "displayName": user.get("displayName"),
        "photoURL": user.get("photoUrl"),
        "providers": [p.get("providerId") for p in user.get("providerUserInfo") or [] if p.get("providerId")],
        "createdMs": ms_of(user.get("createdAt")),
        "lastSignInMs": ms_of(user.get("lastLoginAt")),
        "lastRefreshMs": ms_of(user.get("lastRefreshAt")),
    }


# ---------------------------------------------------------------------------------------------------------------
# System checks.


def run_command(argv: list[str]) -> str:
    """A command's output, within what is left of the run's budget (each caller turns a raise into "unknown")."""
    remaining = left()
    if remaining < 2:
        raise TimeoutError("out of time")
    return subprocess.run(argv, capture_output=True, text=True, timeout=min(30.0, remaining), check=False).stdout


def user_systemctl(*args: str) -> list[str]:
    return ["systemctl", "--user", "-M", f"{TRACE_USER}@", *args]


def failed_units(run: Callable[[list[str]], str]) -> dict[str, Any]:
    names: set[str] = set()
    try:
        for argv in (["systemctl", *FAILED_ARGS], user_systemctl(*FAILED_ARGS)):
            names.update(line.split()[0] for line in run(argv).splitlines() if line.strip())
    except Exception as error:  # noqa: BLE001
        return check("failed_units", "box", "Failed units", "unknown", f"systemctl failed: {type(error).__name__}")
    if names:
        listed = sorted(names)
        return check("failed_units", "box", "Failed units", "fail", ", ".join(listed[:6]) + (f" and {len(listed) - 6} more" if len(listed) > 6 else ""))
    return check("failed_units", "box", "Failed units", "ok", "none")


FAILED_ARGS = ("list-units", "--failed", "--plain", "--no-legend", "--no-pager", "trace-*")


def localdb_check(fetch: Callable[..., tuple[int, float, bytes]]) -> dict[str, Any]:
    status_code, ms, body = fetch(f"{LOCALDB}/health")
    try:
        ok = status_code == 200 and json.loads(body or b"{}").get("ok") is True
    except ValueError:
        ok = False
    if ok:
        return check("localdb", "services", "Trace LocalDB", "warn" if ms > 1000 else "ok", f"healthy in {round(ms)} ms", ms=round(ms))
    return check("localdb", "services", "Trace LocalDB", "fail", f"/health answered {status_code or 'nothing'}", ms=round(ms))


def cgroup_numbers(path: str) -> tuple[int | None, int | None]:
    memory = cpu = None
    try:
        memory = int(Path(path, "memory.current").read_text().strip())
    except (OSError, ValueError):
        pass
    try:
        for line in Path(path, "cpu.stat").read_text().splitlines():
            if line.startswith("usage_usec "):
                cpu = int(line.split()[1])
    except (OSError, ValueError):
        pass
    return memory, cpu


def service_usage() -> list[dict[str, Any]]:
    rows = []
    for label, unit in (("Trace web", "trace-web.service"), ("Trace LocalDB", "trace-localdb.service"), ("Caddy", "caddy.service")):
        memory, cpu = cgroup_numbers(f"{CGROUP_ROOT}/system.slice/{unit}")
        if memory is not None:
            rows.append({"name": label, "memory": memory, "cpu_usec": cpu})
    user = f"{CGROUP_ROOT}/user.slice/user-{TRACE_UID}.slice/user@{TRACE_UID}.service"
    jobs = [cgroup_numbers(p) for p in glob.glob(f"{user}/app.slice/trace-*.service") + glob.glob(f"{user}/trace-*.service")]
    jobs = [(m, c) for m, c in jobs if m is not None]
    # Only while a job is running; their CPU counters vanish with them, so no share is worked out.
    if jobs:
        rows.append({"name": "Trace jobs", "memory": sum(m or 0 for m, _ in jobs), "cpu_usec": None})
    return rows


def trace_timers(run: Callable[[list[str]], str]) -> list[dict[str, Any]]:
    out = []
    for argv, user in ((["systemctl", "list-timers", "--all", "-o", "json", "--no-pager"], False), (user_systemctl("list-timers", "--all", "-o", "json", "--no-pager"), True)):
        try:
            out.extend(timer_rows(json.loads(run(argv) or "[]"), user))
        except Exception:  # noqa: BLE001  unreadable output, a timeout, or no user manager: the other half still counts
            continue
    return sorted(out, key=lambda t: t["next_at"] or "9999")


def data_checks(now: datetime) -> list[dict[str, Any]]:
    with contextlib.closing(database(TRACE_DB)) as db:
        newest = db.execute("SELECT max(path) FROM documents WHERE collection='daily_editions'").fetchone()[0]
        runs = [ms_of(u) for (u,) in db.execute("SELECT updated_at FROM documents WHERE collection='v3_pipeline_runs'")]
    known = [r for r in runs if r is not None]
    return [daily_brief_check(newest, now), pipeline_check(max(known) if known else None, now)]


def backup_files(folder: str = BACKUP_DIR) -> list[tuple[str, float, int]]:
    out = []
    for path in glob.glob(f"{folder}/documents-*.sqlite3.gz"):
        try:
            st = os.stat(path)
        except OSError:
            continue
        out.append((os.path.basename(path), st.st_mtime, st.st_size))
    return out


def backup_offsite(path: str = BACKUP_ENV) -> bool:
    try:
        return any(line.startswith("TRACE_BACKUP_REMOTE=") and line.split("=", 1)[1].strip().strip("'\"") for line in Path(path).read_text().splitlines())
    except OSError:
        return False


def collect_ops(now: datetime, state: dict[str, Any] | None, sb_latest: dict[str, Any], sb: Any, run: Callable[[list[str]], str] = run_command) -> dict[str, Any]:
    """Every Trace check and number, in tm_ops_health/latest's shape. Writes nothing."""
    started = time.monotonic()
    checks: list[dict[str, Any]] = []

    if sb is not None and left() >= 20:
        probes = [
            ("site_public", "site", "Public site", PUBLIC + "/", 3000, 8000, None),
            ("web_home", "services", "Web home", WEB + "/", 1500, 5000, LOCAL_HEADERS),
            ("web_brief", "services", "Web brief", WEB + "/brief", 1500, 5000, LOCAL_HEADERS),
        ]
        with ThreadPoolExecutor(max_workers=4) as pool:
            futures = [pool.submit(sb.http_check, cid, group, label, url, warn_ms=warn, fail_ms=fail, headers=headers) for cid, group, label, url, warn, fail, headers in probes]
            db_future = pool.submit(localdb_check, sb.fetch)
            checks.extend(soft(f"probe {p[0]}", f.result, check(p[0], p[1], p[2], "unknown", "probe crashed")) for p, f in zip(probes, futures))
            checks.append(soft("probe localdb", db_future.result, check("localdb", "services", "Trace LocalDB", "unknown", "probe crashed")))
    else:
        checks.append(check("probes", "site", "Site checks", "unknown", "skipped: out of time" if sb is not None else "StocksBrew health.py not available"))

    checks.extend(soft("data checks", lambda: data_checks(now), [check("data", "data", "Data", "unknown", "could not read the store")]))

    # Traffic: Trace's own Caddy log, the last hour, judged on the last 15 minutes.
    traffic: dict[str, Any] = {}
    if sb is None:
        checks.append(check("http_5xx", "traffic", "Server errors", "unknown", "StocksBrew health.py not available"))
    elif left() < 10:
        checks.append(check("http_5xx", "traffic", "Server errors", "unknown", "skipped: out of time"))
    elif not os.path.exists(CADDY_LOG):
        checks.append(check("http_5xx", "traffic", "Server errors", "unknown", "Trace has no access log yet"))
    else:
        now_ts = now.timestamp()
        records = soft("traffic", lambda: sb.parse_access(sb.read_recent_lines(CADDY_LOG, now_ts - 3600)), [])
        windows = (("last_5m", 300), ("last_15m", 900), ("last_60m", 3600))
        traffic = {name: stats for name, seconds in windows if (stats := soft(f"traffic {name}", lambda s=seconds: sb.traffic_stats(records, now_ts - s)))}
        if records and "last_15m" in traffic:
            checks.extend(soft("traffic checks", lambda: sb.traffic_checks(traffic["last_15m"], 15), []))
        else:
            checks.append(check("http_5xx", "traffic", "Server errors", "unknown", "no requests in the last hour"))

    # The box: StocksBrew's own reading, so both System tabs agree; failed units and backups are Trace's.
    sb_checks = {c.get("id"): c for c in sb_latest.get("checks") or [] if isinstance(c, dict)}
    for cid in [c for c in sb_checks if str(c).startswith("disk:")] + list(SB_BOX_CHECKS):
        if cid in sb_checks:
            checks.append({k: sb_checks[cid][k] for k in ("id", "group", "label", "status", "detail") if k in sb_checks[cid]})
    checks.append(failed_units(run))
    backup_row, backup = soft("backup", lambda: backup_summary(backup_files(), now, backup_offsite()), (check("backup", "box", "LocalDB backup", "unknown", "could not read the backups"), None))
    checks.append(backup_row)

    jobs: list[dict[str, Any]] = []
    if sb is not None and left() >= 5:
        entries = soft("journal", lambda: sb.journal_entries(run, ["--since", "-24h", "--output-fields=UNIT,USER_UNIT,MESSAGE,MESSAGE_ID,CPU_USAGE_NSEC,MEMORY_PEAK", f"MESSAGE_ID={sb.RESOURCES_ID}", f"MESSAGE_ID={sb.FAILED_ID}"]), [])
        jobs = soft("jobs", lambda: summarize_jobs(entries, sb.summarize_units), [])

    system = sb_latest.get("system") or {}
    services = soft("services", service_usage, [])
    result = {
        "version": 1,
        "generated_at": iso(now),
        "overall": worst(c["status"] for c in checks),
        "checks": checks,
        "system": {k: system.get(k) for k in ("mem_total", "mem_available", "swap_total", "swap_used", "load", "cpus", "disks")},
        "system_at": sb_latest.get("generated_at"),
        "services": soft("cpu share", lambda: with_cpu_share(services, state, now), services),
        "localdb": None,
        "traffic": traffic,
        "jobs": jobs,
        "steps": [],
        "timers": soft("timers", lambda: trace_timers(run), []),
        "backup": backup,
        "alert": {"enabled": False},
        "took_ms": None,
    }
    result["took_ms"] = round((time.monotonic() - started) * 1000)
    return result


# ---------------------------------------------------------------------------------------------------------------
# Writing.


def write_json(path: Path, value: dict[str, Any], *, group: str | None) -> None:
    """Atomically. With `group`, root:<group> 0640 (only that service reads it); else 0600."""
    with tempfile.NamedTemporaryFile(mode="w", dir=path.parent, delete=False) as handle:
        json.dump(value, handle, separators=(",", ":"))
    try:
        if group:
            import grp

            os.chown(handle.name, 0, grp.getgrnam(group).gr_gid)
            os.chmod(handle.name, 0o640)
        else:
            os.chmod(handle.name, 0o600)
    except (KeyError, PermissionError):
        # Not root (a manual run as the old service user): keep it private rather than world-readable.
        os.chmod(handle.name, 0o600)
    os.replace(handle.name, path)


def main() -> int:
    now = datetime.now(UTC)
    now_ms = int(now.timestamp() * 1000)
    previous = read_json(OUT_DIR / "latest.json") or {}
    state = read_json(OUT_DIR / "ops-history.json") or {}
    sb = load_sb_health()
    sb_latest = soft("StocksBrew ops doc", read_sb_ops, {}) or {}
    out: dict[str, Any] = {"health": legacy_health(sb_latest)}

    legacy: dict[str, Any] | None = None
    signups: dict[str, Any] | None = None
    try:
        db = database(TRACE_DB)
    except sqlite3.Error:
        db = None
    if db is not None:
        # Each collection is read once; the old aggregate keys and the Signups list both come from these rows.
        with contextlib.closing(db):
            profiles = soft("profiles", lambda: dict(read_fields(db, "user_profiles", PROFILE_FIELDS)))
            subscribers = soft("subscribers", lambda: read_fields(db, "free_newsletter_subscribers", SUBSCRIBER_FIELDS))
        if profiles is not None and subscribers is not None:
            legacy = soft("newsletter counts", lambda: newsletter_counts(profiles, subscribers, referral_secret(), now))
            auth = soft("firebase auth", firebase_accounts)
            referred = {"count": (legacy or {}).get("referred", 0), "readers": (legacy or {}).get("_readers", 0)}
            signups = soft("signups", lambda: build_signups(auth, profiles, subscribers, referred, now_ms))

    if legacy:
        legacy.pop("_readers", None)
        out.update(legacy)
    else:  # keep the last good numbers rather than none
        out.update({k: previous[k] for k in LEGACY_KEYS if k in previous})
    if signups is not None:
        out["signups"] = {"generatedAt": iso(now), **signups}
    elif isinstance(previous.get("signups"), dict):
        out["signups"] = previous["signups"]

    latest = soft("ops", lambda: collect_ops(now, state, sb_latest, sb))
    if latest is not None:
        entries = soft("history", lambda: merge_history(state, history_entry(latest), now), (state or {}).get("entries") or [])
        out["ops"] = {"latest": latest, "history": {"entries": entries}}
        state = {"generated_at": latest["generated_at"], "services": latest["services"], "entries": entries}
        soft("write history", lambda: write_json(OUT_DIR / "ops-history.json", state, group=None))
    elif isinstance(previous.get("ops"), dict):
        out["ops"] = previous["ops"]

    out["updated"] = iso(now)
    write_json(OUT_DIR / "latest.json", out, group="trace-web")
    return 0


if __name__ == "__main__":
    sys.exit(main())
