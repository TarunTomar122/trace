#!/usr/bin/env bash
# One-time server update for the repo layout change (v1/v2/v3 moved into
# backend/). Run on the VPS as the user that owns the trace-* units:
#
#   cd ~/trace && git pull --ff-only          # brings this script
#   bash scripts/server/move-pipeline-to-backend.sh --check   # show what changes
#   bash scripts/server/move-pipeline-to-backend.sh           # apply
#
# It waits for any running pipeline job (the units' own flock), pauses the
# pipeline timers, reinstalls requirements from backend/, points every
# pipeline unit (ExecStart runs v1/v2/v3 code) at WorkingDirectory=.../backend,
# and resumes the timers. Safe to run twice. The LocalDB service is not
# touched: backend/localdb did not move.
set -euo pipefail

CHECK=0
[ "${1:-}" = "--check" ] && CHECK=1
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO"

say() { printf '%s\n' "$*"; }

# Pipeline units: user units and system units, whichever exist.
pipeline_units=()
for file in "$HOME"/.config/systemd/user/trace-*.service /etc/systemd/system/trace-*.service; do
  [ -f "$file" ] || continue
  grep -qE -- '-m v[123]\.|v1/flows/' "$file" && pipeline_units+=("$file")
done

for file in ${pipeline_units[@]+"${pipeline_units[@]}"}; do
  line="$(grep -E '^WorkingDirectory=' "$file" || true)"
  if [ -z "$line" ]; then
    say "SKIP    $file (no WorkingDirectory line: add WorkingDirectory=$REPO/backend by hand)"
  elif [[ "$line" =~ /backend/?$ ]]; then
    say "ok      $file (already backend/)"
  else
    say "update  $file: $line -> ${line%/}/backend"
  fi
  [ -d "$file.d" ] && say "NOTE    $file.d/ has drop-ins; check they do not override WorkingDirectory"
done
[ ${#pipeline_units[@]} -eq 0 ] && say "no pipeline units found under ~/.config/systemd/user or /etc/systemd/system"
[ -x .venv/bin/python ] || say "WARN    $REPO/.venv/bin/python missing: the units cannot start until the venv exists"
for old in v1 v2 v3; do
  [ -d "$old" ] && say "NOTE    $REPO/$old still exists (untracked leftovers after the pull); safe to delete"
done
[ "$CHECK" = 1 ] && { say "check only: nothing changed"; exit 0; }

# Timers of the units we change: paused for the switch, resumed after.
timers=()
for file in ${pipeline_units[@]+"${pipeline_units[@]}"}; do
  timer="$(basename "$file" .service).timer"
  if [[ "$file" == /etc/* ]]; then
    systemctl is-active --quiet "$timer" 2>/dev/null && { sudo systemctl stop "$timer"; timers+=("system:$timer"); }
  else
    systemctl --user is-active --quiet "$timer" 2>/dev/null && { systemctl --user stop "$timer"; timers+=("user:$timer"); }
  fi
done
resume() {
  for entry in ${timers[@]+"${timers[@]}"}; do
    if [[ "$entry" == system:* ]]; then sudo systemctl start "${entry#system:}"; else systemctl --user start "${entry#user:}"; fi
  done
}
trap resume EXIT

# Wait for a pipeline run that is already in progress (the units' lock).
exec 9>"$REPO/.pipeline.lock"
say "== waiting for any running pipeline job"
flock -w 3600 9

say "== git pull"
git pull --ff-only
[ -f backend/requirements.txt ] || { say "backend/requirements.txt missing: the pull did not bring the new layout"; exit 1; }
if [ -x .venv/bin/pip ]; then
  say "== reinstall requirements"
  .venv/bin/pip install -q -r backend/requirements.txt
fi

changed_user=0; changed_system=0
for file in ${pipeline_units[@]+"${pipeline_units[@]}"}; do
  line="$(grep -E '^WorkingDirectory=' "$file" || true)"
  [ -n "$line" ] || continue
  [[ "$line" =~ /backend/?$ ]] && continue
  if [[ "$file" == /etc/* ]]; then
    sudo sed -i -E 's#^(WorkingDirectory=.*[^/])/?$#\1/backend#' "$file"; changed_system=1
  else
    sed -i -E 's#^(WorkingDirectory=.*[^/])/?$#\1/backend#' "$file"; changed_user=1
  fi
  grep -qE '^WorkingDirectory=.*/backend$' "$file" || { say "FAILED to update $file"; exit 1; }
  say "updated $file"
done
[ "$changed_user" = 1 ] && systemctl --user daemon-reload
[ "$changed_system" = 1 ] && sudo systemctl daemon-reload

say "== smoke test"
(cd backend && ../.venv/bin/python -m v3.scheduler --help >/dev/null) && say "v3.scheduler imports OK from backend/"

if crontab -l 2>/dev/null | grep -qE 'v[123]\.|v1/'; then
  say "NOTE: crontab still mentions v1/v2/v3 paths; run those from backend/:"
  crontab -l | grep -E 'v[123]\.|v1/'
fi
say "done (timers resume on exit)"
