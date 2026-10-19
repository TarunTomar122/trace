# VPS pipeline (trace jobs on the VPS)

The VPS owns feed-building **and the daily newsletter send** (GitHub cron
fires hours late, so it can't be trusted for a fixed send time). GitHub
Actions keeps push notifications plus manual/replay workflows.

## Box

- Host: `vps` (`144.217.6.112`, user `ubuntu`), repo at `~/trace`
- Python: `~/trace/.venv` (3.14), secrets: `~/trace/.env` (chmod 600, gitignored)
- Service account: `~/.config/trace/service-account.json` (chmod 600)
- Firecrawl (self-hosted): `http://localhost:3002` (`FIRECRAWL_URL` in `.env`)
- Logs: `~/trace/logs/`

## Units (`~/.config/systemd/user/`)

| Unit | Cadence | Command |
|---|---|---|
| `trace-pipeline.service/.timer` | every 20 min (`:00/:20/:40`) | `scheduler --jobs trending assemble --audience all --force-pools --enrich-coverage --enrich-top 10 --skip-notifications` |
| `trace-pulse.service/.timer` | every 3 h | `scheduler --jobs pulse assemble --audience all --force-pools` |
| `trace-foryou.service/.timer` | daily 03:30 UTC | `scheduler --jobs for_you --audience all` |
| `trace-newsletter.service/.timer` | daily 10:30 Europe/Berlin | `v3.flows.send_audience_newsletter` |
| `trace-instagram.service/.timer` | 09:00 and 20:00 Europe/London | `v3.flows.post_instagram` |
| `trace-welcome.service/.timer` | every 5 min | `v3.flows.send_welcome` |
| `trace-postkit.service/.timer` | daily 07:30 Europe/London | `v3.flows.build_post_kit` |

Checked-in copies: `backend/vps/trace-pipeline.{service,timer}`, `trace-pulse.{service,timer}`, `trace-instagram.{service,timer}`, `trace-welcome.{service,timer}` and `trace-postkit.{service,timer}`. Install with `cp` into `~/.config/systemd/user/` then `systemctl --user daemon-reload`.

- Push notifications are sent **only** by the daily Actions job (`v2.flows.send_push_notification`, 09:00 IST). Every high-frequency `trending` run (VPS 20-min + Actions morning/3-hourly) must pass `--skip-notifications` or users get spammed.

- `flock ~/trace/.pipeline.lock` prevents overlap. `RandomizedDelaySec` spreads load.
- Pipeline and pulse timers are **calendar-only** (`OnCalendar` + `Persistent=true`), same as foryou/newsletter. Do not use `OnUnitActiveSec` / `OnBootSec`: a user-systemd restart drops that baseline and the timer sits at `NEXT="-"` until someone kicks it. Calendar + Persistent catch up immediately after the manager comes back.
- `trace-newsletter.timer` uses `OnCalendar=*-*-* 10:30:00 Europe/Berlin`, so
  DST is handled by systemd; `Persistent=true` catches up a missed run.
- The newsletter is sent by `backend/v3/flows/send_audience_newsletter.py`, which
  resolves three mutually exclusive buckets and sends **one email per person**:
  **pro** (10 stories) > **free** (5 stories) > **landing** (5 stories for
  email-only homepage signups). Pro/free stories come from the recipient's
  interests; landing gets the global picks. Email is on by default for every
  bucket, and an explicit opt-out wins for all three: the footer link and the
  one-click `List-Unsubscribe` header both write
  `free_newsletter_subscribers/{email}.active = false` and
  `dailyNewsletterEnabled`/`newsletterOptIn = false` on matching profiles.
  Before resolving the audience it runs `v3.flows.sync_brevo`, which writes the
  same flags for unsubscribes, complaints and hard bounces that only Brevo saw,
  and copies Brevo's opens and clicks into `email_events`. To see what it would
  change: `cd ~/trace/backend && ../.venv/bin/python -m v3.flows.sync_brevo --dry-run`.
- Selection priority is AI → markets → tech → design → startups, with up to
  3/2/2/1/1/1 slots on Pro and 2/1/1 on the 5-story emails. Model releases
  take up to two Pro slots or one free/landing slot first, but only while
  their newest coverage is under 36 hours old (`RELEASE_FRESH_HOURS`; the
  pool spans about three days); older launches compete in their lane. Unused
  slots are filled from the remaining lanes. Pro displays the selected sections as model
  releases → AI → markets → startups → tech → design, then any other selected
  lanes in their existing relative order. Markets prefers macro stories.
- Delivery goes through our own Postfix on the VPS with Brevo as the per-message
  fallback (`EMAIL_TRANSPORT=auto`), and every attempt lands in `email_sends`.
  Opens, clicks and visits from the email (`kind: 'visit'`, which make a
  win-back reader a member) land in `email_events`. `/dev/analytics` renders
  sends and opens/clicks: volume
  per day, transport split, failures, DKIM status, openers and clickers per
  bucket, top clicked targets, and the last 25 sends. See
  `docs/self-hosted-email.md`.
- Story links point at the app, never the publisher. Retired flows:
  `send_three_feed_newsletter.py` (shared blast) and the former `send_free_newsletter.py` (removed)
  (never scheduled).
- Story quality is a Jev (Typesafe) judgement call: `send_worthy` in
  `RANKING_QUESTIONS` (`backend/v3/build_trending.py`) scores 0 for appointments,
  opinion, lawsuits without outcome, PR, shopping/how-to content, crowdfunding,
  personality colour, and single-company stock notes. The newsletter requests
  fresh verdicts for any story that has none yet and caches them for 7 days in
  `v3_synthesis_cache` (`jev-send-worthy-v1`). Edit the rubric there — never
  add keyword lists.
- Preview without sending:
  `python -m v3.flows.send_audience_newsletter --preview --preview-bucket pro`.
  Demo one address: `--demo-email you@example.com --demo-bucket free`.
  Pull on the VPS after changing the flow, the template
  (`backend/v1/templates/audience_newsletter.html`), or the ranking rubric.

## Welcome email

`trace-welcome.timer` runs `backend/v3/flows/send_welcome.py` every 5 minutes
and sends one welcome to each new reader:

- an email-only subscriber (`free_newsletter_subscribers.subscribedAt`) gets
  "your first brief lands <weekday> around 9:30am UK time", links to the latest
  brief and `/brief/customize`, and an unsubscribe link;
- a new web account (`user_profiles.createdAt`, from Google sign-in) gets "your
  feed is ready" plus either "your daily brief lands every morning" or "set up
  your daily email", by the daily's own opt-in rules. It waits until onboarding
  is done (or 30 minutes) so that line is right. Someone who did both gets the
  account version once. Mobile-app accounts live in Firebase, not LocalDB, so
  they get no welcome yet.
- Once per address, ever: `welcome_sends/{sha256(email)}` is written before
  each send (`sending`, then `sent`/`failed`/`skipped`). If the marker can't be
  written the run stops; a marker left at `sending` is never retried. A failed
  send is retried twice more, at least 30 minutes apart. Undeliverable
  addresses are marked `skipped`.
- Only signups since 2026-10-13 and within the last 3 days count, at most 25 a
  run and 30 an hour. Over the hourly cap the log says PAUSED: look at the
  signup form for bot traffic.
- `welcome` must be in `EMAIL_BREVO_BUCKETS` so first emails go through Brevo.

Setup (once):

```bash
cp ~/trace/backend/vps/trace-welcome.{service,timer} ~/.config/systemd/user/
systemctl --user daemon-reload && systemctl --user enable --now trace-welcome.timer
```

Day to day (the job takes `~/trace/.welcome.lock`, so a manual run can't race the timer):

```bash
cd ~/trace/backend && ../.venv/bin/python -m v3.flows.send_welcome --dry-run    # who's next, HTML previews
../.venv/bin/python -m v3.flows.send_welcome --test-to you@example.com          # every version to you
tail -50 ~/trace/logs/welcome.log
```

## Instagram carousels

`trace-instagram.timer` posts to the Trace Instagram account through Buffer at
09:00 and 20:00 UK time (`Europe/London`, so it follows BST and GMT).

- Each run picks 3-5 stories from today's feed in this order: two AI, then
  one each from Markets, Startups and Design (`INSTAGRAM_LANES`). A lane with
  nothing new is skipped and the best remaining story from any lane fills the
  gap. The "Top in X" kicker shows once per lane, as in the brief; gap fillers
  have none. Stories posted in the last 14 days are skipped (by topic id,
  article URL and similar title), as are promos and stories the slide can't
  show well (characters Inter lacks, or a first paragraph too long to fit).
- Two slides per story, 1080x1350 JPEG, rendered with Pillow
  (`backend/v3/lib/instagram_slides.py`, fonts in `backend/v3/assets/instagram`):
  the photo with a short rewritten headline and the kicker, then the story's
  first paragraphs exactly as the feed splits them (whole paragraphs only).
  The story slide's palette (paper, ink, navy) changes from post to post.
- Slides are written to `/var/www/trace-social/{date}-{slot}-{id}/` and served
  by Caddy at `https://db.yourtrace.online/social/...` (see
  `backend/vps/Caddyfile.trace`); Buffer fetches them when it publishes.
  Folders older than 14 days are deleted.
- The job shares the post now and waits for Buffer to report it sent. Every
  post is logged in `instagram_posts/{date}-{am|pm}` with the stories,
  headlines, caption, Buffer id and Instagram link.
- A slot is posted again only when nothing can have gone out: Buffer refused
  the post (`failed`) or reported a publishing error (`error`); the service
  then retries after 15 minutes, at most 3 times. Anything that may have
  created a post (a timeout, Buffer's `UNEXPECTED`) is logged as `unknown` and
  never retried, so check Buffer by hand. Drafts, approvals and posts still
  sending count as posted, and the next run re-reads their status.
- Env: `BUFFER_API_KEY`, optional `BUFFER_INSTAGRAM_CHANNEL_ID` (see `.env.example`).

One-time setup on the VPS:

```bash
sudo mkdir -p /var/www/trace-social && sudo chown ubuntu:ubuntu /var/www/trace-social
# add the /social block from backend/vps/Caddyfile.trace to /etc/caddy/Caddyfile, then:
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile && sudo systemctl reload caddy
~/trace/.venv/bin/pip install -r ~/trace/backend/requirements.txt   # Pillow
# add BUFFER_API_KEY (and BUFFER_INSTAGRAM_CHANNEL_ID) to ~/trace/.env
cp ~/trace/backend/vps/trace-instagram.{service,timer} ~/.config/systemd/user/
systemctl --user daemon-reload && systemctl --user enable --now trace-instagram.timer
```

Day to day:

```bash
# preview without posting or writing anything
cd ~/trace/backend && ../.venv/bin/python -m v3.flows.post_instagram --dry-run --out /tmp/ig
tail -50 ~/trace/logs/instagram.log
# a live run by hand: go through the service so it takes the lock. It uses the
# current slot (before 14:00 London is "am"), so a run after 14:00 is tonight's post.
systemctl --user start trace-instagram.service
```

## Daily X post

`trace-postkit.timer` runs `backend/v3/flows/build_post_kit.py` at 07:30 UK
time. It writes one X post for the founder and sends nothing: the founder's
laptop picks it up the first time it wakes and posts it by hand
(`backend/laptop/README.md`).

- The post opens "Biggest updates in tech in the last 24 hours:", has 3-6
  short, plain lines and ends "Did I miss anything??". The model
  (`TRACE_KIT_MODEL`, default gpt-6.1-sol) picks them from the feed's last 24
  hours: today's and yesterday's topics, plus recent trending-pool articles no
  topic covers yet. It picks by how interesting a story is, not by coverage.
- A line with a number its story never mentions, hype ("insane", "!"), a
  link or a bare domain ("x.ai") is dropped. If the model fails, the lines
  are the widest-covered stories' titles.
- `TRACE_KIT_X_MAX` sets the length: 360 by default, for X Premium but still
  short.
- One post per feed day, kept in `post_kits/{date}` (`post_json`), so the
  07:30 run and the laptop get the same one. A template post is replaced on
  the next run, up to 3 tries a day, and `--fresh` writes a new one.
- With `--json` (the laptop's call) the run also fetches the best image of
  the first story and searches YouTube for this week's videos of it, then
  prints one `POSTKIT_JSON {...}` line. Image fetches only go to public
  hosts on ports 80/443, with every redirect checked. YouTube blocks
  downloads from the VPS, so the laptop cuts the clip.
- Every run copies the day's Tools and Top articles to the feed doc
  (`featured_items`), so share pages keep working after the pulse replaces
  the lists.

Setup (once):

```bash
cp ~/trace/backend/vps/trace-postkit.{service,timer} ~/.config/systemd/user/
systemctl --user daemon-reload && systemctl --user enable --now trace-postkit.timer
```

Day to day (the job takes `~/trace/.postkit.lock`; the laptop's run waits for a 07:30 run still writing):

```bash
cd ~/trace/backend && ../.venv/bin/python -m v3.flows.build_post_kit --dry-run   # post, image and kit.json in /tmp/trace-postkit; writes nothing
../.venv/bin/python -m v3.flows.build_post_kit --fresh                           # replace today's post
tail -50 ~/trace/logs/postkit.log
```

## Story grouping

- After summaries are available, `backend/v3/build_trending.py` embeds each article's
  title and short summary, retrieves the top candidate neighbors, and sends
  those pairs to TypeSafe Jev in small batches.
- Jev returns a strict `same_card` probability plus a four-way relationship:
  `same_concrete_event`, `same_ongoing_event_update`,
  `related_different_event`, or `unrelated`. A merge requires
  `same_card >= 0.70` and `same_concrete_event`; ongoing updates remain
  separate cards and receive a shared `thread_id` for timeline linkage.
- Exact URL duplicates, freshness, source caps, lane floors, entity caps, and
  deterministic ranking stay in code. Semantic title dedupe is not used for
  trending; if embeddings or Jev fail, articles remain singleton topics.
- Decisions are cached in `v3_synthesis_cache` using a content fingerprint,
  model names, thresholds, and `jev-story-grouping-v1`. `OPENAI_API_KEY` (structured decisions, `backend/v3/lib/decisions.py`; Jev/Typesafe was replaced on 2026-10-13) is
  read from the process environment only. `TRENDING_GROUP_TOP_K`,
  `TRENDING_GROUP_MAX_PAIRS`, `TRENDING_GROUP_JEV_BATCH`,
  `TRENDING_GROUP_EMBED_MIN`, and `TRENDING_GROUP_SAME_CARD_MIN` provide
  conservative operational tuning knobs.

## Story ranking

- Jev scores each canonical topic for importance, novelty, usefulness, general
  interest, and evidence quality. The final order is source count, article
  count, weighted Jev score, then the existing popularity and recency signals.
- Confidence is stored for diagnostics, not used as a default rank gate. If a
  complete batch cannot be validated, the run keeps the existing deterministic
  order. Successful results use the same seven-day synthesis cache.
- Local runs load the gitignored `.environment`; the VPS should expose
  `OPENAI_API_KEY` through its existing chmod-600 `.env` or systemd
  environment before enabling this code there.

## Interest depth (markets, tech, startups, design)

- The feed reserves topic slots per lane so single-interest clusters are not
  crowded out by multi-source AI clusters: `TRENDING_MARKETS_FLOOR` (12),
  `TRENDING_TECH_FLOOR` (8), `TRENDING_STARTUPS_FLOOR` (8),
  `TRENDING_DESIGN_FLOOR` (6 topic slots; `ux-design`), plus flat/mobile-list
  floors (`TRENDING_MARKETS_FLAT_FLOOR` 8, `TRENDING_TECH_FLAT_FLOOR` 4,
  `TRENDING_STARTUPS_FLAT_FLOOR` 4, `TRENDING_DESIGN_FLAT_FLOOR` 3). Remaining
  slots go to the globally best clusters; both lists keep score order (a floor
  reserves a place, not the lead) and the per-entity topic cap still applies.
  `max_topics` is 48. Invalid env values fall back to defaults instead of
  failing the build.
- Lanes are enforced on the model's classified interest, so a story's lane
  follows its subject, not its source.
- Startup/design sources: Sifted, Tech.eu, EU-Startups, AlleyWatch, BetaKit,
  TechCrunch Venture, The Next Web, SaaStr, Startup Daily, e27, TechNode,
  The Recursive, UKTN, Crunchbase, TechCrunch Startups; Smashing Magazine,
  Nielsen Norman Group, Design Milk, Core77, Creative Bloq, Webdesigner Depot.
  Tech adds Engadget, Gizmodo, Tom's Hardware, MacRumors, CNET News.
- Cross-source quality filters drop entertainment/culture items, investment
  advice/listicles ("Buy These 8 Stocks"), and finance-brand blogs from any
  lane. Named entities are discovered per run: tokens appearing in only a few
  of the day's titles (`_rare_tokens`, <=3 or 3% of titles) behave like brands
  for clustering and merge candidates, so new names never need a whitelist
  update. Video/podcast player pages are skipped at ingest, and only items with
  a usable summary enter topic clustering, so a failed summary can no longer
  leak a story into its source's lane (a Bloomberg video in Markets).
- 22 markets sources (CNBC Markets/Investing/US Markets/Business, Bloomberg
  Technology, CNBC Top News/Technology, WIRED Business, Semafor, Business
  Insider, Fortune, Quartz, Benzinga, LA Times Business, Time Business,
  TechCrunch Fintech, BLS/BEA releases, Yahoo Finance Markets, The Register
  Business, The Conversation Business, Vox Economy). Yahoo's general and
  top-stories feeds were removed: they syndicate investment-advice blogs that
  are not market news.
- Cross-source blog/listicle filter (`MARKET_BLOG_KEYWORDS` in
  `backend/v3/build_trending.py`) drops advice titles from any finance brand:
  "Could Upstart 10x From Here?", "Rivian vs. Lucid: This Stock Is Clearly
  the Better Buy", "If You'd Invested $5,000...", 401(k)/retirement advice,
  crypto price predictions. Classification also follows the story's primary
  subject, not a secondary mention: an AI company's compute deal stays `ai`
  even when the headline mentions an upcoming IPO.
- Freshness window is 36h (`max_age_hours`), widened to 72h on Saturday/Sunday
  UTC (`_effective_max_age_hours`) so Friday's startup/design stories survive
  the quiet weekend; the pool deactivation window follows the same value.
  Keyword filters are whole-word and apostrophe-normalized (so "nfl" does not
  match "Inflation").

## Coverage enrichment

- Module: `backend/v3/enrich_coverage.py`. Post-clustering hook in `build_trending`
  (`--enrich-coverage`, default **off** so Actions behavior is unchanged).
- Flow: top-N thin topics → Firecrawl `/v2/search` → blocklist + title-overlap
  filter → up to 4 new outlets appended to cluster items → overviews generate
  once with full membership (cache key includes URLs, so no repeat waste).
- Enriched articles carry no summaries (not needed for coverage links) → zero
  extra OpenAI cost from enrichment itself.
- Upstream search is flaky (connection resets): 3 tries with backoff. Zero-hit
  topics keep their original articles; nothing breaks.

## Measured steady-state cost (VPS, 2026-09-03)

Full trending + enrich run: **~77s wall**. Summaries **1 generated / 68
cached**, overviews **3 generated / 14 cached**, enrichment **+12 outlets in
~24s**. A 20-min cadence ≈ ~4 light OpenAI calls per run.

## Ops

```bash
ssh vps
systemctl --user status trace-pipeline.timer
journalctl --user -u trace-pipeline.service -n 50 --no-pager
tail -50 ~/trace/logs/pipeline.log
# manual run (writes live doc, skips pushes):
cd ~/trace/backend && ../.venv/bin/python -m v3.scheduler --jobs trending assemble --audience all --force-pools --enrich-coverage --skip-notifications
```

Enable timers (cutover = this writes the live feed every 20 min):

```bash
ssh vps "systemctl --user enable --now trace-pipeline.timer trace-pulse.timer"
```

Full cutover later: disable the `daily-pipeline.yml` schedules in Actions
after a week of green VPS runs. Newsletter send stays on Actions until then.
