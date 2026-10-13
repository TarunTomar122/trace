# Free + open source launch

Everything built locally for the launch, and what has to happen to ship it.
Nothing here has been deployed, pushed, sent, or cancelled.

## 1. Deploy, in this order

1. **LocalDB allowlist (VPS)**: add `daily_editions` to
   `LOCALDB_ALLOWED_COLLECTIONS` in `/etc/trace/localdb.env`, restart
   `trace-localdb`. Without it the web app cannot read editions and the
   pipeline cannot write them.
2. **Web app (Vercel)**: deploy `frontend/`. Set
   `NEXT_PUBLIC_GITHUB_REPO_URL` once the repo is public (the "Open source"
   links stay hidden until then). Optional: `NEXT_PUBLIC_CONTACT_EMAIL`.
3. **Pipeline (VPS)**: pull, restart the timers. Then publish today once so
   `/brief` is not empty:
   `python -m v3.flows.send_audience_newsletter --publish-only`
4. **Check before the next send**:
   `python -m v3.flows.send_audience_newsletter --dry-run` and confirm the
   audience counts (member / winback / landing) look right.

### Email env (VPS `~/trace/.env`)

| Variable | Set to | Why |
|---|---|---|
| `EMAIL_BREVO_BUCKETS` | `winback` (was probably `pro`) | The `pro` bucket no longer exists. Members now go through our MTA (their opens warm it); cold win-back mail rides Brevo. |
| `NEWSLETTER_WINBACK` | `1` when ready | Off by default. The run refuses unless `winback` is in `EMAIL_BREVO_BUCKETS`. |
| `NEWSLETTER_WINBACK_DAILY_CAP` | `250` | Stays inside Brevo's free 300/day. |

Members: anyone active in the last 7 days, still on a paid plan, or who got
the daily in the last 7 days (so nobody on today's list is dropped).
Win-back: dormant accounts, at most 3 emails, 4 days apart, most recently
active first. Opening the feed makes them a member the next morning.

### Publishing the open-source repo (when you are ready)

Nothing has been created or pushed. The private monorepo is never published;
the public repo is generated from it.

1. `scripts/oss/export.sh /tmp/trace-oss` builds a clean copy (allowlist +
   overlay docs) and fails on any secret or owner-identifier the scan finds.
   Decide on `CONTACT_EMAIL`'s fallback in `frontend/lib/site-links.ts` first:
   it is your Gmail today (set `NEXT_PUBLIC_CONTACT_EMAIL` and change the
   fallback if you do not want it public).
2. Check it: `cd /tmp/trace-oss/frontend && npm ci && npm run build`, and
   `python -m unittest discover -s v3 -p "test_*.py" -t .` from the root
   (both pass with no env vars; this is what CI runs).
3. `cd /tmp/trace-oss && git init && git add -A && git commit -m "Trace: initial open-source release"`,
   create the GitHub repo, push.
4. On GitHub: Settings -> General -> Features -> **Sponsorships** on (the
   button reads `.github/FUNDING.yml`, Buy Me a Coffee `taratdev`); Security
   -> enable **Private vulnerability reporting** (SECURITY.md points there);
   add topics (`news`, `newsletter`, `rss`, `ai`, `nextjs`, `self-hosted`).
5. Vercel: set `NEXT_PUBLIC_GITHUB_REPO_URL` to the repo URL and redeploy, so
   the footer and landing "Open source" links appear.
6. Later exports: re-run `export.sh` into the same folder (it keeps `.git`
   only if you move it back; simplest is to export, then `rsync --delete
   --exclude .git` into your clone).

## 2. What changed

- **Measurement**: open/click tracking and `lastActiveAt` were silently
  dropped on Vercel (fire-and-forget writes); both now use `after()`.
- **Free for everyone**: paywall, Pro, checkout and `/subscribe` removed
  (redirects to `/feed`). Sponsored tool purchases still work.
- **Email**: 10 stories for everyone; readers pick topics, 5/10/15 stories,
  summaries / headlines / images. Footer: "Share today's brief" and
  "Customize your brief".
- **Public archive**: `/brief` and `/brief/YYYY-MM-DD` with share buttons,
  per-day share images, sitemap entries.
- **Newsletter builder**: `/brief/customize` with a live preview that runs the
  sender's own selection (parity-tested), linked from profile, email, landing.
- **Landing**: rebuilt in the feed's visual language with today's real brief
  and a live builder demo.

## 3. Existing paying users

44 accounts are active or on hold (41 web, 3 app).

1. List them: `python3 scripts/free-launch/list_paying_users.py > paying.csv`
2. Cancel each subscription in the Dodo dashboard (and RevenueCat for app
   users). Refund the last charge if you want to; it is small.
3. Send them the note below **before** the public launch.

> **Subject: Trace is free now, and you made that possible**
>
> Hi {name},
>
> You were one of the first people to pay for Trace. Thank you. That support
> kept it going long enough to get good.
>
> Starting today, everything in Trace is free for everyone, and the code is
> open source. I've cancelled your subscription, so you won't be charged
> again. {Optional: I've also refunded your last payment.}
>
> Nothing changes in your feed or your morning email. If anything, it gets
> better: you can now build your own brief (topics, length, images) at
> yourtrace.online/brief/customize.
>
> Thank you for believing in it early.
> Tarat

## 4. Launch posts (drafts)

**X thread**

1. Trace made $18 a month. So I made it free, and open sourced it.
2. It reads 100+ tech sources every morning, groups the stories everyone is
   covering, and sends you the ones that matter. Five minutes, every source
   attached.
3. Build your own brief: pick topics, 5/10/15 stories, summaries or images.
   The preview is today's real email. → yourtrace.online/brief/customize
4. Every edition is public: yourtrace.online/brief
5. Code: {GitHub link}. AI summaries are cached per article, so it costs the
   same for 10 readers or 10,000.

**Show HN**: "Show HN: Trace – a free, open-source daily tech brief". Lead
with how it works (clustering, ranking, per-article cached summaries,
self-hostable with your own keys), not with the price.

**r/selfhosted**: the docker compose setup and "bring your own OpenAI key".

**Two weeks later**: "What happened after I made my app free", with the real
numbers.

## 5. Watch

- Daily email recipients (73 on Oct 12), opens/clicks (tracking now works).
- `/brief` share traffic: PostHog `daily_edition_shared`, `?from=share`.
- Builder: `newsletter_preferences_saved`.
- Win-back: replies and spam complaints in Brevo; pause with
  `NEWSLETTER_WINBACK=0` if complaints show up.
