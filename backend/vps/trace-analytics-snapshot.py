"""Publish signup counts, where signups came from, masked top referrers (ab•••@domain) and shared
machine gauges to the Trace web user. Run as root, the file is readable by the trace-web group only;
as the unprivileged service user it stays world-readable, as before."""
import base64
import hashlib
import hmac
import json
import os
import sqlite3
import tempfile
from datetime import datetime, timezone
from pathlib import Path

def database(path):
    return sqlite3.connect(f"file:{path}?mode=ro", uri=True, timeout=3)

with database("/var/lib/tikrr/localdb/documents.sqlite3") as db:
    row = db.execute("SELECT data_json FROM documents WHERE path='tm_ops_health/latest'").fetchone()
    snapshot = json.loads(row[0]) if row else {}
    system = snapshot.get("system", {})
    health = {k: system.get(k) for k in ["cpus","load","mem_total","mem_available","disks"]}
    health["generated_at"] = snapshot.get("generated_at")

def referral_secret(path="/home/ubuntu/trace/.env"):
    """The backend's REFERRAL_SECRET (v3/lib/referral.py), to name who a share code belongs to."""
    try:
        for line in Path(path).read_text().splitlines():
            if line.startswith("REFERRAL_SECRET="):
                value = line.split("=", 1)[1].split(" #", 1)[0].strip()
                return value.strip("'\"")
    except OSError:
        pass
    return ""


def code_for(email, secret):
    digest = hmac.new(secret.encode(), email.encode(), hashlib.sha256).digest()
    return base64.b32encode(digest).decode().lower()[:8]


def masked(email):
    """ab•••@gmail.com: enough for the owner to recognise a reader, not the address."""
    name, _, domain = email.partition("@")
    return f"{name[:2] if len(name) > 4 else name[:1]}•••@{domain}" if domain else "a reader"


def ranked(counter, limit=12):
    return [{"label": k, "n": n} for k, n in sorted(counter.items(), key=lambda kv: (-kv[1], kv[0]))[:limit]]


with database("/srv/tikrr-data/trace-data/localdb/documents.sqlite3") as db:
    # Where signups came from (frontend lib/first-touch.ts, recorded since 2026-11-22), which
    # form they used, and whose share link brought them. One person per email; their newsletter
    # record decides, so a reader who later makes an account through a link isn't counted
    # (backend v3/lib/referral.py counts the same way).
    people = {}
    for collection, channel_field in (("free_newsletter_subscribers", "channel"), ("user_profiles", "signupChannel")):
        for email, channel, ref in db.execute(f"""SELECT lower(trim(json_extract(data_json,'$.email'))),
                json_extract(data_json,'$.{channel_field}'), lower(json_extract(data_json,'$.referredBy'))
                FROM documents WHERE collection=?""", (collection,)):
            if email and email not in people:
                people[email] = (channel, ref)
    channels, codes = {}, {}
    for email, (channel, ref) in people.items():
        if channel:
            channels[channel] = channels.get(channel, 0) + 1
        if ref and len(ref) == 8:
            codes.setdefault(ref, set()).add(email)
    forms = dict(db.execute("""SELECT coalesce(json_extract(data_json,'$.source'),'landing_page'),count(*)
        FROM documents WHERE collection='free_newsletter_subscribers' GROUP BY 1"""))
    secret = referral_secret()
    owners = {code_for(email, secret): email for email in people} if secret and codes else {}
    referrers = []
    for code, emails in codes.items():
        emails.discard(owners.get(code, ""))  # their own link
        if emails:
            referrers.append({"label": masked(owners[code]) if code in owners else f"code {code}",
                              "code": code, "n": len(emails)})
    referrers.sort(key=lambda r: (-r["n"], r["label"]))
    total, active = db.execute("""SELECT count(*), COALESCE(sum(json_extract(data_json,'$.active')=1),0)
        FROM documents WHERE collection='free_newsletter_subscribers'""").fetchone()
    daily = db.execute("""SELECT date(json_extract(data_json,'$.subscribedAt')) AS day,count(*)
        FROM documents WHERE collection='free_newsletter_subscribers'
        AND day BETWEEN date('now','-29 days') AND date('now') GROUP BY day ORDER BY day""").fetchall()
out = Path("/var/lib/trace-analytics-snapshot")
with tempfile.NamedTemporaryFile(mode="w",dir=out,delete=False) as f:
    json.dump(dict(health=health,total=total,active=active,daily=dict(daily),
                   channels=ranked(channels),forms=ranked(forms),referrers=referrers[:12],
                   referred=sum(r["n"] for r in referrers),updated=datetime.now(timezone.utc).isoformat()),f)
try:  # readable by the web service's group only: it now carries masked reader labels
    import grp
    os.chown(f.name, 0, grp.getgrnam("trace-web").gr_gid)
    os.chmod(f.name, 0o640)
except (KeyError, PermissionError):
    os.chmod(f.name, 0o644)
os.replace(f.name,out/"latest.json")
