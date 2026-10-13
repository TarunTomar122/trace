# OSS export notes

Run: `scripts/oss/export.sh <target_dir>` (rebuilds the target; refuses to wipe a
non-empty dir that lacks the `.trace-oss-export` marker). Nothing is committed,
pushed or sent over the network.

Files: `export.sh` (allowlist copy + overlay + scan), `scan.sh` (grep secret/owner
scan, also runs alongside gitleaks if installed), `scan-allow.txt` (reviewed
findings the scan ignores; `OSS_SCAN_STRICT=1` ignores it), `overlay/` (README,
LICENSE placeholder, CONTRIBUTING, .gitignore, .env.example, requirements.txt,
docker-compose.yml, docker/*).

## Verification (Phase 3 run, export to /tmp/trace-oss-test)
- Export completes (~460 files). `gitleaks` and `docker` are NOT installed:
  grep fallback scan used; `docker compose config`/`build` NOT run (compose YAML only
  parsed with Ruby). Please run both once.
- Scan: **clean**. A planted owner email in `v3/zz.py` was correctly rejected.
- `py_compile` over all exported .py: OK. `npx tsc --noEmit -p .` in frontend: clean.
- New app files (`app/brief/**`, `lib/newsletter-*.ts`, `lib/daily-editions.ts`,
  `components/feed-v2/LandingBuilderDemo.tsx`, `v3/test_newsletter_parity.py`) are
  covered by the `frontend` / `v3` allowlist entries (confirmed present in the export).
- LICENSE is now the canonical AGPL-3.0 text (downloaded from gnu.org).

## Phase 3 changes
- Owner email now lives only in `frontend/lib/site-links.ts` as
  `CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || '<owner email>'`; contact,
  delete-account, privacy-policy, terms and FeedApp use it. `scan-allow.txt` allows
  exactly that definition line (`path|substring` format); any other occurrence fails.
  The default is still the owner's gmail: set `NEXT_PUBLIC_CONTACT_EMAIL` or change
  the fallback before publishing if you do not want it in the public repo.
- `daily_editions,email_sends,email_events` added to `backend/vps/trace-localdb.env.example`
  (repo file) and to the compose default `LOCALDB_ALLOWED_COLLECTIONS`.
- `.env.example`: added NEXT_PUBLIC_CONTACT_EMAIL, NEWSLETTER_WINBACK(_DAILY_CAP); removed
  unused DODO_PRODUCT_ID(_INDIA), NEXT_PUBLIC_PRO_TRIAL_DAYS, SUBSCRIPTION_*. DODO_API_KEY/
  WEBHOOK_SECRET/MODE remain (still used by sponsored-tool routes).
- README: archive (/brief), builder (/brief/customize), buckets, win-back env; paywall text removed.

## Decisions
- Python scope computed by an AST import closure from `v3/*`, `v3/scheduler.py`
  and `backend/localdb/server.py`. The v3 scheduler shells out to
  `v2.flows.build_unified_newsletter` (imports `v2/utils/fetch_article_links.py`),
  so those two v2 files ARE exported even though v2 is otherwise excluded.
- v1: only `storage.py`, `newsletter_preferences.py`, `tools/{__init__,brevo_client,
  email_sender,youtube_transcript}.py` and the two email templates v3 loads.
- backend: `localdb`, `patches`, `scripts` (migration tools), `tests`, `vps`
  (examples). `backend/config` (migration selector lists) excluded as internal.
- frontend: everything except build output (`.next`, `out`, `output`),
  `node_modules`, env files, `.vercel`, agent/editor dirs, and personal dev scripts
  in `frontend/scripts` that hardcode the owner's service-account file
  (`brief-*.mjs`, `dump-items.mjs`, `audit-user-profiles.js`, `voice-lab*.mjs`,
  `seed-clone.mjs`, `profiles/`). SEO scripts referenced by package.json are kept.
- `requirements.txt` trimmed from 17 to 10 packages (dropped openai-agents, arxiv,
  flask, flask-cors, pydantic, schedule, exa_py, tavily, google-genai - not imported
  by exported code; `exa_py` is not imported either: `EXA_API_KEY` is used via HTTP).
- `trace/` is the Expo/React Native mobile app (iOS/Android; contains
  GoogleService-Info.plist, google-services.json and an adminsdk key) -> excluded.
- `trace-extension/` (browser new-tab extension, has PRIVACY.md/store assets) ->
  default excluded; it is self-contained so you could add it to `ALLOW` later.
- Pipeline <-> LocalDB in Docker: both containers mount the same named volume and
  the pipeline uses in-process `TRACE_DB=local` against the SQLite file (WAL,
  busy_timeout 30 s) rather than HTTP. Works on Linux named volumes; do not use a
  macOS bind mount for `/data`.

## Private / hardcoded items still in exported code (owner decides)
Owner email `tomartarun2001@gmail.com`: now only the fallback default at
frontend/lib/site-links.ts:7 (allowlisted). Previously at:
- frontend/app/contact/page.tsx:39,47
- frontend/app/delete-account/page.tsx:5
- frontend/app/privacy-policy/page.tsx:125,174
- frontend/app/terms/page.tsx:212
- frontend/components/SubscriptionManager.tsx:471,637
- frontend/components/feed-v2/FeedApp.tsx:2023,2117
`s2930369@ed.ac.uk`: not found in exported code.

Other owner identity / branding (not blockers):
- Author "Tarun Tomar", @tarat_211, github TarunTomar122, tarat.space, avatar:
  frontend/lib/seo.ts:67,68,194,207; frontend/app/layout.tsx:125;
  frontend/app/contact/page.tsx:52,69; 12 blog pages in frontend/app/blog/*
  (authors/authorName/authorUrl); frontend/components/feed-v2/LandingScreen.tsx:211,229;
  frontend/public/tarat-avatar.jpg; "Built by Tarat" footer in
  v1/templates/audience_newsletter.html:90 and three_feed_newsletter.html:54.
- /Users/ttomar path in a comment: frontend/next.config.ts:5.

Firebase project `anybrew-7c6c1`:
- frontend/lib/firebase.ts:6-9 (web config incl. public apiKey, authDomain,
  projectId, storageBucket) - self-hosters must replace; Firebase Auth is still
  required by the app (see Blockers).
- frontend/lib/firebase-admin.ts:31,39 (default storage bucket)
- backend/scripts/build_trace_selectors.py:95 (default --project-id)

Internal URLs / infra:
- db.yourtrace.online + VPS IP 144.217.6.112: backend/vps/Caddyfile.trace:4-6;
  frontend/app/api/dev/localdb-analytics/route.ts:5 (comment)
- /srv/tikrr-data/trace-data paths + `User=ubuntu`: backend/vps/trace-localdb.service:12,32,
  backend/vps/backup-trace-localdb.sh:8-9
- Email defaults pointing at the hosted instance: v1/tools/email_sender.py:54,59,61,
  69,71,88,91,142,152 (mail.yourtrace.online, DKIM key path, support@yourtrace.online);
  v1/tools/brevo_client.py:23 (`yourtrace.online@gmail.com` sender - a personal-looking gmail
  address!); v3/flows/send_audience_newsletter.py:56,827 (APP_URL https://yourtrace.online);
  v2/flows/build_unified_newsletter.py:79,482 (www.yourtrace.online/articles).
- v1/tools/email_sender.py:66-71 keeps legacy module-level SMTP/DKIM constants
  hardcoded to the hosted values (live values come from env per call).
- v3/lib/send_worthy.py:24 calls `https://api.typesafe.ai/v1/systemone` (third-party
  "Jev" judge); optional, skipped without `TYPESAFE_API_KEY`.
- v3/config/trending_sources.json:12 `alignednews.com/api/news-feed` (third-party feed).

Hardcoded admin emails/UIDs: none found. Sponsors: no sponsor names hardcoded;
sponsored placements are data-driven from the Firestore `promoted_tools` collection
(frontend/lib/feed-view.ts:64, app/api/tools/promote/route.ts:53) but UI copy sells
sponsorship: frontend/components/feed-v2/FeedApp.tsx:2021 ("sponsored spot ... for 30 days")
and the surrounding promo block at ~2017-2023 / 2117.

Maintainer-only/commercial code shipped inside frontend/ (inactive without env vars, but
you may want to prune): `app/control-plane`, `app/instagram-studio`, `app/api/dev/*`,
Dodo payments + subscription routes (`app/api/subscription/*`, SubscriptionManager.tsx;
paywall removal in progress by another agent), `remotion/` (video renders),
`app/api/tools/promote`, carousel/Postiz/Instagram routes, `public/trace-video-opening.mp4`,
`public/2c58d696...txt` (IndexNow key for yourtrace.online - harmless but domain-specific).

## Blockers / caveats
1. (resolved) owner email centralised and allowlisted; LICENSE filled in.
3. The app requires Firebase Authentication even with LocalDB storage
   (`frontend/lib/firebase-admin.ts` throws without Firebase credentials). Self-hosters
   need their own Firebase project; documented in README "Known limitations".
4. Docker artifacts are unbuilt/untested here (no docker). Frontend Dockerfile runs
   `npm run build`, whose `prebuild` runs `test:app-icons`; build may need Firebase env
   at build time if any page imports firebase-admin at module load (the module throws at
   import when creds are missing) - if `docker compose build` fails there, pass dummy
   `FIREBASE_SERVICE_ACCOUNT_KEY` as a build arg or make the admin init lazy.
5. Optional vars are commented out in `.env.example` on purpose: blank values override
   defaults (e.g. `LOCALDB_PORT=` or `EMAIL_SMTP_PORT=` would crash `int("")`).
6. README references `docs/screenshot.png` (placeholder, file not provided).
7. gitleaks not installed here; run it (`gitleaks detect --no-git`) on the target before
   publishing - export.sh does this automatically when it is on PATH.
8. Stale leftovers (not edited): `frontend/README.md` still lists NEXT_PUBLIC_FIREBASE_PROJECT_ID (unused by code); the job
   descriptions in `v3/scheduler.py` and `frontend/app/(auth)/...` copy may still say
   "free / pro buckets". `.commandcode` dirs are excluded from export (one contains the
   owner email in notes).

## Oct 12 pass (pre-publish cleanup)
- Excluded maintainer-only tools: `frontend/app/{dev,api/dev,(auth)/dev,instagram-studio,api/carousel}`
  (nothing else links to them).
- Firebase web config lives in `frontend/lib/firebase-config.ts` (env with the
  hosted values as fallback); the overlay ships an env-only copy with
  placeholders so `next build` works with no env. Admin storage bucket reads it.
- `backend/vps/Caddyfile.trace` replaced in the export by a generic example (no IP).
- Pipeline email links honour `TRACE_APP_URL` (templates too); default unchanged.
- Added: `.github/workflows/ci.yml` (tsc, ranking tests, next build, v3 + backend
  unittest incl. TS parity), `.github/FUNDING.yml`, issue/PR templates,
  SECURITY.md, README screenshots (`docs/`, no publisher images), Support section.
- Stale tests fixed: `test_jev_ranking` (fixture lacked `send_worthy`; partial
  batches keep their verdicts by design), `test_newsletter_preferences`
  (scheduler now uses the audience sender; legacy three-feed mix test skipped).
- Verified on the export: scan clean, `npm ci` + `tsc` + `next build` with no env
  OK, 84 v3 tests OK (1 skipped), 8 backend tests OK.
- Still the owner's call: CONTACT_EMAIL fallback (Gmail), author/brand
  references in blog posts and SEO metadata (intentional: it is the hosted site).

## Oct 13: repo layout
- v1/v2/v3 live in `backend/` (dead legacy files deleted: 9 of 107 v1/v2 files
  were still imported, plus the push-notification flow a workflow runs). The
  pipeline runs from `backend/`; `v1/storage.py` puts the repo root on
  sys.path so `backend.localdb` still imports. LocalDB is unchanged.
- README, CONTRIBUTING, SECURITY, LICENSE, .env.example, docker/, CI and the
  GitHub templates now live in the repo itself; the overlay only keeps what must
  differ publicly (env-only Firebase config, generic Caddyfile, .gitignore).
- export.sh copies git-tracked files only (stage or commit before exporting).
