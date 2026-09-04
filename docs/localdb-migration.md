# Trace Firestore → LocalDB migration

Vendored from tikrr (`backend/localdb`): SQLite document store with a
Firestore-shaped HTTP API. Firebase Auth stays; Firestore becomes the
fallback/rollback copy. Mobile (`trace/`) keeps reading Firestore directly —
the pipeline runs in `dual` mode indefinitely, so both stores stay current.

## Architecture

```
Vercel (Next.js) ──HTTPS──▶ Caddy (db.yourtrace.online) ─▶ 127.0.0.1:8502 (trace-localdb.service)
VPS pipeline ──SQLite/loopback──▶ /srv/tikrr-data/trace-data/localdb/documents.sqlite3
```

- `TRACE_DB=firebase|local|dual` (Python pipeline, `v1/storage.py` selector).
  `dual` = reads from Firestore, mirrors every write to LocalDB.
- `FIRESTORE_BACKEND=firebase|local|fallback` (web, `frontend/lib/firebase-admin.ts`).
  `fallback` = LocalDB primary, per-operation Firebase retry with loud logging.
- Rollback anywhere = flip the env var, redeploy/restart. Firebase is never deleted.

## Local development

```bash
# one-time: backfill local SQLite from prod Firestore (read-only on Firebase)
source .env  # FIREBASE_SERVICE_ACCOUNT_PATH
.venv/bin/python backend/scripts/build_trace_selectors.py
.venv/bin/python backend/scripts/migrate_firestore_to_local.py \
  --collections-file backend/config/trace_migration_selectors.generated.txt \
  --project-id anybrew-7c6c1 \
  --db data/localdb/documents.sqlite3 \
  --export data/localdb/firestore-archive.jsonl --apply

# run the server (needs LOCALDB_API_TOKEN)
LOCALDB_API_TOKEN=local-dev-token .venv/bin/python -m backend.localdb.server \
  --db data/localdb/documents.sqlite3 --host 127.0.0.1 --port 8502

# web app (frontend/.env.local)
LOCALDB_URL=http://127.0.0.1:8502
LOCALDB_API_TOKEN=local-dev-token
FIRESTORE_BACKEND=local
npm run dev -- --port 5003   # 5001/5002 are commonly taken
```

Parity check any time:

```bash
.venv/bin/python backend/scripts/verify_local_migration.py \
  --db data/localdb/documents.sqlite3 \
  --collections-file backend/config/trace_migration_selectors.generated.txt \
  --firestore --project-id anybrew-7c6c1
```

Expect `ok: true`. `v3_pipeline_runs` / pool / today's feed docs may drift while
the live pipeline runs — that is normal; re-export to converge.

## Known gotchas (learned the hard way)

1. **Wildcard selectors skip subcollections whose parent docs don't exist.**
   `v3_user_feeds/*/daily` streams the parent collection — feed parents were
   never materialised, so it copied 0 docs. Use
   `backend/scripts/build_trace_selectors.py` (explicit per-uid selectors +
   `v3_user_feeds/_global/daily`) instead of hand-maintaining the list.
2. **Firestore collection-group scans time out** (`daily` group → 503). Don't use them.
3. **google-cloud-firestore stream retry is broken** (any mid-stream error
   crashes with `AttributeError: '_UnaryStreamMultiCallable' has no attribute
   '_retry'`). `backend/patches/firestore_stream.py` disables the broken helper
   so the real error surfaces; migration checkpoints make exports resumable.
4. **Admin `FieldPath.documentId()`** stringifies to `__name__` — the TS facade
   normalises non-string fields. Lowercase `orderBy(..., 'desc')` works.
5. **No `listDocuments()` on LocalDB.** The instagram-studio dev routes enumerate
   feed owners via `lib/feed-user-refs.ts` (`user_profiles` + `_global`
   sentinel) instead of parent-doc listing — works on both backends.

## VPS deploy (trace-localdb)

```bash
# 0. DNS: db.yourtrace.online -> A 144.217.6.112 (proxy OFF)
# 1. data volume (50 GB disk, e.g. mounted at /srv):
sudo mkdir -p /srv/tikrr-data/trace-data/localdb /srv/tikrr-data/trace-data/backups /etc/trace
sudo chown ubuntu:ubuntu /srv/tikrr-data/trace-data /srv/tikrr-data/trace-data/localdb /srv/tikrr-data/trace-data/backups /etc/trace
# 2. env (chmod 600):
sudo cp backend/vps/trace-localdb.env.example /etc/trace/localdb.env
sudo nano /etc/trace/localdb.env   # set LOCALDB_API_TOKEN
sudo chmod 600 /etc/trace/localdb.env
# 3. install unit + Caddy snippet + backup timer:
sudo cp backend/vps/trace-localdb.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now trace-localdb.service
# merge backend/vps/Caddyfile.trace into the VPS Caddyfile, then:
caddy reload   # (or systemctl reload caddy)
sudo cp backend/vps/trace-localdb-backup.service backend/vps/trace-localdb-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now trace-localdb-backup.timer
# 4. seed the DB: copy a parity-verified documents.sqlite3 to
#    /srv/tikrr-data/trace-data/localdb/ (or run the backfill on the VPS), then:
curl http://127.0.0.1:8502/health
# 5. pipeline dual-write: add to ~/trace/.env on the VPS:
TRACE_DB=dual
TRACE_LOCALDB_PATH=/srv/tikrr-data/trace-data/localdb/documents.sqlite3
# 6. GitHub Actions dual-write: repo secrets TRACE_DB=dual + LOCALDB_* vars,
#    then extend daily-pipeline.yml env (TODO).
```

## Vercel cutover (web)

1. Set env: `LOCALDB_URL=https://db.yourtrace.online`,
   `LOCALDB_API_TOKEN=<same token>`, `FIRESTORE_BACKEND=fallback`.
2. Deploy. Watch logs for `[firestore-fallback]` lines — any occurrence means a
   LocalDB op failed over to Firebase (loud by design).
3. After 7 green days: `FIRESTORE_BACKEND=local`. Rollback = set `firebase`.

## What still uses Firebase after cutover (by design)

- Firebase Auth (sign-in, ID tokens, session cookies) — unchanged.
- Mobile app reads/writes (dual-write keeps it working, no app release needed).
- Firebase Storage (Instagram carousel images) — separate future move.
- Firestore itself as the always-current rollback copy.
