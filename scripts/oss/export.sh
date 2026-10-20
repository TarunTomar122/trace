#!/usr/bin/env bash
# Export the open-source subset of the Trace monorepo.
#
#   scripts/oss/export.sh <target_dir>
#
# Idempotent: the target is rebuilt from scratch on every run (only if it is
# empty/nonexistent or carries the .trace-oss-export marker from a previous run).
# Never commits, pushes or touches the network.
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "usage: $0 <target_dir>" >&2
  exit 2
fi

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
mkdir -p "$1"
TARGET="$(cd "$1" && pwd)"
MARKER=".trace-oss-export"

case "$TARGET" in
  "/"|"$HOME"|"$REPO"|"$REPO"/*) echo "refusing to export into $TARGET" >&2; exit 2 ;;
esac

# --- fresh target (guarded) --------------------------------------------------
if [ -n "$(ls -A "$TARGET")" ] && [ ! -f "$TARGET/$MARKER" ]; then
  echo "target $TARGET is not empty and has no $MARKER marker; refusing to wipe it" >&2
  exit 2
fi
find "$TARGET" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
touch "$TARGET/$MARKER"

# --- allowlist ---------------------------------------------------------------
# Paths are relative to the repo root. Keep this list explicit: anything not
# listed here is NOT exported.
ALLOW=(
  README.md
  LICENSE
  CONTRIBUTING.md
  SECURITY.md
  .env.example
  .dockerignore
  docker-compose.yml
  docker
  docs/screenshot-homepage.png
  docs/screenshot-brief.png
  docs/screenshot-feed.png
  docs/screenshot-email.png
  .github/FUNDING.yml
  .github/ISSUE_TEMPLATE
  .github/pull_request_template.md
  .github/workflows/ci.yml
  frontend
  backend
  trace-extension
)

EXCLUDES=(
  # dependencies / build output
  --exclude=node_modules/
  --exclude=.next/
  --exclude=/frontend/out/
  --exclude=/frontend/output/
  --exclude=/frontend/remotion-out/
  --exclude=.vercel/
  --exclude='*.tsbuildinfo'
  --exclude=next-env.d.ts
  --exclude=__pycache__/
  --exclude='*.pyc'
  --exclude='.venv*/'
  --exclude=venv/
  --exclude=.pytest_cache/
  --exclude=.mypy_cache/
  --exclude=.ruff_cache/
  --exclude=coverage/
  --exclude=.playwright-cli/
  --exclude=test-results/
  --exclude=playwright-report/
  # data
  --exclude='*.sqlite3'
  --exclude='*.sqlite3-*'
  --exclude='*.sqlite'
  --exclude='*.db'
  --exclude='*.log'
  # secrets (".env.example" is the only env file allowed through)
  --include=.env.example
  --exclude='.env*'
  --exclude=.environment
  --exclude='*adminsdk*'
  --exclude='*service-account*'
  --exclude='*serviceAccount*'
  --exclude='*.pem'
  --exclude='*.key'
  --exclude='*.p12'
  --exclude='*.p8'
  --exclude=google-services.json
  --exclude=GoogleService-Info.plist
  # tooling / editor / agent junk
  --exclude=.DS_Store
  --exclude=.commandcode/
  --exclude=.claude/
  --exclude=.cursor/
  --exclude=.opencode/
  --exclude=.agents/
  --exclude=skills-lock.json
  # personal/dev scripts that hardcode the owner's service-account path
  --exclude=/frontend/scripts/brief-*.mjs
  --exclude=/frontend/scripts/dump-items.mjs
  --exclude=/frontend/scripts/audit-user-profiles.js
  --exclude=/frontend/scripts/voice-lab*.mjs
  --exclude=/frontend/scripts/seed-clone.mjs
  --exclude=/frontend/scripts/profiles/
  # maintainer-only tools: analytics dashboards, social/Instagram studio
  --exclude=/frontend/app/dev/
  --exclude=/frontend/app/api/dev/
  --exclude='/frontend/app/(auth)/dev/'
  --exclude=/frontend/app/instagram-studio/
  --exclude=/frontend/app/api/carousel/
  --exclude=.idea/
  # internal: migration selector lists for the hosted instance
  --exclude=/backend/config/
  --exclude=.vscode/
)

cd "$REPO"
for p in "${ALLOW[@]}"; do
  [ -e "$p" ] || echo "WARN: allowlisted path missing: $p" >&2
done
# Only files git tracks: local caches, logs and scratch output never leak into
# the export. Commit first, then export.
# Paths never published even though their parent is allowlisted: maintainer
# tools, personal scripts, hosted-instance config. (rsync's anchored excludes do
# not apply to an explicit file list, so they are git pathspecs here.)
SKIP=(
  ':(exclude)frontend/app/dev'
  ':(exclude)frontend/app/api/dev'
  ':(exclude)frontend/app/(auth)/dev'
  ':(exclude)frontend/app/instagram-studio'
  ':(exclude)frontend/app/api/carousel'
  ':(exclude)frontend/scripts/brief-*.mjs'
  ':(exclude)frontend/scripts/dump-items.mjs'
  ':(exclude)frontend/scripts/audit-user-profiles.js'
  ':(exclude)frontend/scripts/voice-lab*.mjs'
  ':(exclude)frontend/scripts/seed-clone.mjs'
  ':(exclude)frontend/scripts/profiles'
  ':(exclude)backend/config'
)
git ls-files -z -- "${ALLOW[@]}" "${SKIP[@]}" | rsync -a --from0 --files-from=- "${EXCLUDES[@]}" ./ "$TARGET/"
echo "copied $(find "$TARGET" -type f | wc -l | tr -d ' ') files"

# --- overlay -----------------------------------------------------------------
# overlay/.gitignore etc. land in the target root. frontend/.gitignore (if any)
# is kept as is.
rsync -a "$HERE/overlay/" "$TARGET/"
rm -f "$TARGET/$MARKER.tmp"

# --- secret scan -------------------------------------------------------------
echo "running secret scan..."
if command -v gitleaks >/dev/null 2>&1; then
  gitleaks detect --no-git --source "$TARGET" --redact -v
  echo "gitleaks: clean"
fi
# The grep scan always runs too (it also checks owner-specific identifiers that
# gitleaks cannot know about).
bash "$HERE/scan.sh" "$TARGET"
echo "export complete: $TARGET"
