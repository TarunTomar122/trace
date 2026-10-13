#!/usr/bin/env bash
# One-time server update for the repo layout change (v1/v2/v3 moved into
# backend/). Run on the VPS, in the pipeline checkout, as the user that owns
# the trace-* units:
#
#   bash scripts/server/move-pipeline-to-backend.sh --check   # show what changes
#   bash scripts/server/move-pipeline-to-backend.sh           # apply
#
# It pulls, reinstalls requirements from backend/, and points every
# pipeline unit (ExecStart runs v1/v2/v3 code) at WorkingDirectory=.../backend.
# The LocalDB service is not touched: backend/localdb did not move.
set -euo pipefail

CHECK=0
[ "${1:-}" = "--check" ] && CHECK=1
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO"

say() { printf '%s\n' "$*"; }

if [ "$CHECK" = 0 ]; then
  say "== git pull"
  git pull --ff-only
  [ -f backend/requirements.txt ] || { say "backend/requirements.txt missing: pull did not bring the new layout"; exit 1; }
  if [ -x .venv/bin/pip ]; then
    say "== reinstall requirements"
    .venv/bin/pip install -q -r backend/requirements.txt
  fi
fi

# Pipeline units: user units and system units, whichever exist.
changed_user=0; changed_system=0
for file in "$HOME"/.config/systemd/user/trace-*.service /etc/systemd/system/trace-*.service; do
  [ -f "$file" ] || continue
  # Only units that run the pipeline (python -m v3..., v2..., v1/...).
  grep -qE -- '-m v[123]\.|v1/flows/' "$file" || continue
  if grep -qE '^WorkingDirectory=.*/trace/backend$' "$file"; then
    say "ok      $file (already backend/)"; continue
  fi
  line="$(grep -E '^WorkingDirectory=' "$file" || true)"
  [ -n "$line" ] || { say "SKIP    $file (no WorkingDirectory line; check by hand)"; continue; }
  say "update  $file: ${line} -> ${line}/backend"
  [ "$CHECK" = 1 ] && continue
  if [[ "$file" == /etc/* ]]; then
    sudo sed -i -E 's#^(WorkingDirectory=.*/trace)/?$#\1/backend#' "$file"; changed_system=1
  else
    sed -i -E 's#^(WorkingDirectory=.*/trace)/?$#\1/backend#' "$file"; changed_user=1
  fi
done

if [ "$CHECK" = 0 ]; then
  [ "$changed_user" = 1 ] && systemctl --user daemon-reload
  [ "$changed_system" = 1 ] && sudo systemctl daemon-reload
  say "== smoke test"
  (cd backend && ../.venv/bin/python -m v3.scheduler --help >/dev/null && say "v3.scheduler imports OK")
fi

# Anything else that might still call the old paths.
if crontab -l 2>/dev/null | grep -qE 'v[123]\.|v1/'; then
  say "NOTE: crontab still mentions v1/v2/v3 paths; run those from backend/:"
  crontab -l | grep -E 'v[123]\.|v1/'
fi
say "done"
