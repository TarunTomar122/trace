#!/bin/sh
# Installs (or updates) the morning X post job on this Mac. See README.md.
set -eu

HERE="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/.trace-xpost"
PLIST="$HOME/Library/LaunchAgents/online.yourtrace.xpost.plist"
# Homebrew's Python if there is one: yt-dlp needs 3.10 or later, and a conda base can change under the venv.
PYTHON="${PYTHON:-$( [ -x /opt/homebrew/bin/python3 ] && echo /opt/homebrew/bin/python3 || command -v python3 )}"
"$PYTHON" -c 'import sys; sys.exit(sys.version_info < (3, 10))' || { echo "need Python 3.10+ (set PYTHON=...)" >&2; exit 1; }

mkdir -p "$DEST" "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
[ -x "$DEST/venv/bin/python" ] || "$PYTHON" -m venv "$DEST/venv"
# [default] brings yt-dlp's helpers for YouTube's current player.
"$DEST/venv/bin/pip" install --quiet --upgrade "yt-dlp[default]"
# A copy outside ~/Documents: macOS keeps background jobs out of Documents and Desktop.
cp "$HERE/trace_xpost.py" "$DEST/trace_xpost.py"

command -v ffmpeg >/dev/null 2>&1 || brew install ffmpeg
command -v terminal-notifier >/dev/null 2>&1 || brew install terminal-notifier
# yt-dlp needs a JavaScript runtime for YouTube; without one some formats go missing.
command -v deno >/dev/null 2>&1 || brew install deno

sed "s#__HOME__#$HOME#g" "$HERE/online.yourtrace.xpost.plist" > "$PLIST"
launchctl bootout "gui/$(id -u)" "$PLIST" 2>/dev/null || true
# Right after a bootout, bootstrap can fail with "5: Input/output error" for a moment.
for attempt in 1 2 3 4 5; do
  launchctl bootstrap "gui/$(id -u)" "$PLIST" 2>/dev/null && break
  [ "$attempt" = 5 ] && { echo "couldn't load $PLIST" >&2; exit 1; }
  sleep 2
done

echo "Installed. It runs the first time this Mac wakes after 05:00 each day (and once now)."
echo "Posts: ~/x-posts/latest/index.html   Log: ~/Library/Logs/trace-xpost.log"
