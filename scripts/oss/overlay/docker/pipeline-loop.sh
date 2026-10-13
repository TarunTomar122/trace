#!/bin/sh
# Container equivalent of backend/vps/trace-pipeline.timer (every ~20 min:
# trending + assemble + today's public edition) and trace-pulse.timer (every ~3 h: pulse + assemble).
# Intervals are configurable (seconds).
set -u
TRENDING_EVERY="${TRENDING_INTERVAL_SECONDS:-1200}"
PULSE_EVERY="${PULSE_INTERVAL_SECONDS:-10800}"
last_pulse=0

while true; do
  echo "[loop] trending + assemble"
  python -u -m v3.scheduler --jobs trending assemble --audience all --force-pools \
    --enrich-top 10 --enrich-max-per-topic 4 --skip-notifications \
    ${ENRICH_COVERAGE:+--enrich-coverage} || echo "[loop] trending run failed (continuing)"

  # Refresh today's public edition (/brief, landing sample, builder preview).
  # Publishing only: nothing is emailed. Sending is a separate, opt-in job.
  python -u -m v3.flows.send_audience_newsletter --publish-only \
    || echo "[loop] edition publish failed (continuing)"

  now=$(date +%s)
  if [ $((now - last_pulse)) -ge "$PULSE_EVERY" ]; then
    echo "[loop] pulse + assemble"
    python -u -m v3.scheduler --jobs pulse assemble --audience all --force-pools \
      || echo "[loop] pulse run failed (continuing)"
    last_pulse=$(date +%s)
  fi
  sleep "$TRENDING_EVERY"
done
