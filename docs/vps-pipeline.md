# VPS pipeline (trace jobs on the VPS)

GitHub Actions schedules are **untouched** and still own newsletter sends +
push notifications. The VPS mirrors feed-building so we can run hotter
(20-min trending) without Actions minute limits.

## Box

- Host: `vps` (`144.217.6.112`, user `ubuntu`), repo at `~/trace`
- Python: `~/trace/.venv` (3.14), secrets: `~/trace/.env` (chmod 600, gitignored)
- Service account: `~/.config/trace/service-account.json` (chmod 600)
- Firecrawl (self-hosted): `http://localhost:3002` (`FIRECRAWL_URL` in `.env`)
- Logs: `~/trace/logs/`

## Units (`~/.config/systemd/user/`)

| Unit | Cadence | Command |
|---|---|---|
| `trace-pipeline.service/.timer` | every 20 min | `scheduler --jobs trending assemble --audience all --force-pools --enrich-coverage --enrich-top 10` |
| `trace-pulse.service/.timer` | every 3 h | `scheduler --jobs pulse assemble --audience all --force-pools` |

- `flock ~/trace/.pipeline.lock` prevents overlap. `RandomizedDelaySec` spreads load.
- Newsletter sends and push notifications are **not** on VPS timers (Actions owns them until cutover).
- `daily-newsletter.yml` sends daily at **10:30 Europe/Berlin**, DST-aware:
  two UTC crons (08:30 / 09:30) plus a local-hour guard that skips the
  wrong-season run.

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
