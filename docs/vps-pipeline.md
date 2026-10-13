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

Checked-in copies: `backend/vps/trace-pipeline.{service,timer}` and `trace-pulse.{service,timer}`. Install with `cp` into `~/.config/systemd/user/` then `systemctl --user daemon-reload`.

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
- Selection priority is AI → markets → tech → design → startups, with up to
  3/2/2/1/1/1 slots on Pro and 2/1/1 on the 5-story emails. Model releases
  take up to two Pro slots or one free/landing slot first; unused slots are
  filled from the remaining lanes. Pro displays the selected sections as model
  releases → AI → markets → startups → tech → design, then any other selected
  lanes in their existing relative order. Markets prefers macro stories.
- Delivery goes through our own Postfix on the VPS with Brevo as the per-message
  fallback (`EMAIL_TRANSPORT=auto`), and every attempt lands in `email_sends`.
  Opens and clicks land in `email_events`. `/dev/analytics` renders both: volume
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
  model names, thresholds, and `jev-story-grouping-v1`. `TYPESAFE_API_KEY` is
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
  `TYPESAFE_API_KEY` through its existing chmod-600 `.env` or systemd
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
