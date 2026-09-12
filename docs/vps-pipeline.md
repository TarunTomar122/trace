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
| `trace-pipeline.service/.timer` | every 20 min | `scheduler --jobs trending assemble --audience all --force-pools --enrich-coverage --enrich-top 10 --skip-notifications` |
| `trace-pulse.service/.timer` | every 3 h | `scheduler --jobs pulse assemble --audience all --force-pools` |
| `trace-foryou.service/.timer` | daily 03:30 UTC | `scheduler --jobs for_you --audience all` |
| `trace-newsletter.service/.timer` | daily 10:30 Europe/Berlin | `v3.flows.send_three_feed_newsletter --audience all` |

- Push notifications are sent **only** by the daily Actions job (`v2.flows.send_push_notification`, 09:00 IST). Every high-frequency `trending` run (VPS 20-min + Actions morning/3-hourly) must pass `--skip-notifications` or users get spammed.

- `flock ~/trace/.pipeline.lock` prevents overlap. `RandomizedDelaySec` spreads load.
- `trace-newsletter.timer` uses `OnCalendar=*-*-* 10:30:00 Europe/Berlin`, so
  DST is handled by systemd; `Persistent=true` catches up a missed run.
- The newsletter sends the **top 7 stories** (no builds/conversations sections).
  Pull on the VPS after changing `v3/flows/send_three_feed_newsletter.py`.

## Topic merge pass

- `v3/build_trending.py::_merge_related_topics` runs **one** `gpt-4o-mini` call
  after topic selection to fold same-event clusters that the deterministic
  token clusterer splits by wording ("slow the pace" vs "pump the brakes").
- Guarded: a merge only lands when the topics share a named entity or two
  specific tokens; failures keep the original clusters.
- Cached per topic+article fingerprint in `v3_synthesis_cache`, so repeated
  20-minute refreshes are free. `TRENDING_MERGE_AI=0` disables it,
  `TRENDING_MERGE_MODEL` overrides the model.

## Coverage enrichment

- Module: `v3/enrich_coverage.py`. Post-clustering hook in `build_trending`
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
cd ~/trace && .venv/bin/python -m v3.scheduler --jobs trending assemble --audience all --force-pools --enrich-coverage --skip-notifications
```

Enable timers (cutover = this writes the live feed every 20 min):

```bash
ssh vps "systemctl --user enable --now trace-pipeline.timer trace-pulse.timer"
```

Full cutover later: disable the `daily-pipeline.yml` schedules in Actions
after a week of green VPS runs. Newsletter send stays on Actions until then.
