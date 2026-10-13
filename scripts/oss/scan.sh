#!/usr/bin/env bash
# Grep-based secret / owner-identifier scan. Usage: scan.sh <dir>
# Exit 1 if anything is found that is not in scan-allow.txt.
# Set OSS_SCAN_STRICT=1 to ignore the allowlist.
set -uo pipefail
DIR="${1:?dir}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ALLOW="$HERE/scan-allow.txt"

PATTERNS=(
  'sk-[A-Za-z0-9_-]{20,}'
  'sk_(live|test)_[A-Za-z0-9]{10,}'
  'AIza[0-9A-Za-z_-]{35}'
  'xkeysib-[A-Za-z0-9-]{10,}'
  'xapp-[0-9A-Za-z-]{10,}|xox[abprs]-[0-9A-Za-z-]{10,}'
  'BEGIN ([A-Z]+ )?PRIVATE KEY'
  '"private_key"[[:space:]]*:[[:space:]]*"[^"]{20,}'
  '"private_key_id"[[:space:]]*:[[:space:]]*"[0-9a-f]{20,}'
  'ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}'
  '(^|[^A-Za-z0-9_])re_[A-Za-z0-9]{20,}'
  'phc_[A-Za-z0-9]{30,}'
  'whsec_[A-Za-z0-9]{10,}'
  'AKIA[0-9A-Z]{16}'
  'Bearer [A-Za-z0-9._-]{30,}'
  'tomartarun2001@gmail\.com'
  's2930369@ed\.ac\.uk'
)
REGEX="$(IFS='|'; echo "${PATTERNS[*]}")"

HITS="$(grep -rIEn --exclude-dir=node_modules --exclude-dir=.git --exclude=.trace-oss-export \
  -e "$REGEX" "$DIR" 2>/dev/null \
  | sed "s#^$DIR/##")"

if [ -n "$HITS" ] && [ -z "${OSS_SCAN_STRICT:-}" ] && [ -f "$ALLOW" ]; then
  # allowlist lines: "<path-prefix>" (reviewed public identifiers). '#' comments.
  while IFS= read -r a; do
    case "$a" in ''|'#'*) continue ;; esac
    case "$a" in
      *"|"*) p="${a%%|*}"; sub="${a#*|}"
             HITS="$(printf '%s\n' "$HITS" | grep -v -F -e "$p:" | cat; printf '%s\n' "$HITS" | grep -F -e "$p:" | grep -v -F -e "$sub" || true)" ;;
      *) HITS="$(printf '%s\n' "$HITS" | grep -v -F "$a" || true)" ;;
    esac
  done < "$ALLOW"
fi

# secret-looking files that slipped through
FILES="$(find "$DIR" \( -name '.env' -o -name '.env.*' ! -name '.env.example' -o -name '*adminsdk*' -o -name '*.pem' -o -name '*.sqlite3' -o -name 'google-services.json' -o -name 'GoogleService-Info.plist' \) -not -path '*/node_modules/*' 2>/dev/null)"

# advisory (non-fatal): private-ish identifiers the owner should decide on
WARN="$(grep -rIEn --exclude-dir=node_modules --exclude=NOTES.md -e 'anybrew-7c6c1|db\.yourtrace\.online|144\.217\.6\.112' "$DIR" 2>/dev/null | sed "s#^$DIR/##" | head -40)"
[ -n "$WARN" ] && { echo "scan: advisory (not fatal) -- private-looking identifiers:"; echo "$WARN" | sed 's/^/  /'; }

if [ -n "$HITS$FILES" ]; then
  echo "################ SECRET SCAN FAILED ################" >&2
  [ -n "$HITS" ] && echo "$HITS" | cut -c1-200 >&2
  [ -n "$FILES" ] && echo "$FILES" >&2
  exit 1
fi
echo "scan: clean (no secrets / owner emails found)"
