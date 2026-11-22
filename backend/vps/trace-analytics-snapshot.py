"""Publish only aggregate signup counts and shared machine gauges to the Trace web user."""
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

with database("/srv/tikrr-data/trace-data/localdb/documents.sqlite3") as db:
    total, active = db.execute("""SELECT count(*), COALESCE(sum(json_extract(data_json,'$.active')=1),0)
        FROM documents WHERE collection='free_newsletter_subscribers'""").fetchone()
    daily = db.execute("""SELECT date(json_extract(data_json,'$.subscribedAt')) AS day,count(*)
        FROM documents WHERE collection='free_newsletter_subscribers'
        AND day BETWEEN date('now','-29 days') AND date('now') GROUP BY day ORDER BY day""").fetchall()
out = Path("/var/lib/trace-analytics-snapshot")
with tempfile.NamedTemporaryFile(mode="w",dir=out,delete=False) as f:
    json.dump(dict(health=health,total=total,active=active,daily=dict(daily),updated=datetime.now(timezone.utc).isoformat()),f)
os.chmod(f.name,0o644)
os.replace(f.name,out/"latest.json")
