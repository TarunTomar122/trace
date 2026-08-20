#!/bin/sh
set -eu

extension_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
version=$(node -p "JSON.parse(require('fs').readFileSync('$extension_root/manifest.json', 'utf8')).version")
archive="$extension_root/dist/trace-new-tab-$version.zip"

mkdir -p "$extension_root/dist"
if [ -f "$archive" ]; then
  rm "$archive"
fi

cd "$extension_root"
zip -q -r "$archive" \
  manifest.json \
  newtab.html \
  newtab.js \
  background.js \
  styles.css \
  lib/analytics.js \
  lib/brief.js \
  assets/icon16.png \
  assets/icon32.png \
  assets/icon48.png \
  assets/icon128.png \
  assets/icon512.png

printf '%s\n' "$archive"
