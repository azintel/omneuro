#!/usr/bin/env sh
set -eu

# Where to write the snapshot (override: OUTDIR=snapshot ./scripts/99-snapshot.sh)
OUTDIR="${OUTDIR:-snapshot}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUTFILE="${OUTDIR}/code-snapshot-${STAMP}.txt"
LISTFILE="${OUTDIR}/filelist-${STAMP}.txt"

# Repo root (this script assumes you run from the repo root)
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Ensure outdir
mkdir -p "$OUTDIR"

# Extensions we care about (hand-authored files)
# ts/tsx/js/jsx/mjs/cjs/json/md/sql/db/html/css/yaml/yml/sh/zsh/py/xml/cfg/conf/csv/txt
INCLUDE_EXPR='
  -name "*.ts"  -o -name "*.tsx"  -o
  -name "*.js"  -o -name "*.jsx"  -o
  -name "*.mjs" -o -name "*.cjs"  -o
  -name "*.json" -o -name "*.md"  -o
  -name "*.sql" -o -name "*.db"   -o
  -name "*.html" -o -name "*.css" -o
  -name "*.yaml" -o -name "*.yml" -o
  -name "*.sh" -o -name "*.zsh"   -o
  -name "*.py" -o -name "*.xml"   -o
  -name "*.cfg" -o -name "*.conf" -o
  -name "*.csv" -o -name "*.txt"
'

# Directories to ignore
PRUNE_DIRS='
  -path "*/node_modules/*" -o
  -path "*/dist/*"         -o
  -path "*/build/*"        -o
  -path "*/.git/*"         -o
  -path "*/.venv/*"        -o
  -path "*/.pytest_cache/*" -o
  -path "*/.next/*"        -o
  -path "*/out/*"          -o
  -path "*/coverage/*"     -o
  -path "*/tmp/*"          -o
  -path "*/.cache/*"       -o
  -path "*/_snapshot/*"    -o
  -path "*/snapshot/*"     -o
  -path "*/build-logs/*"
'

# Build the file list
# shellcheck disable=SC2086
find "$ROOT_DIR" -type d \( $PRUNE_DIRS \) -prune -o \
  -type f \( $INCLUDE_EXPR \) -print | sed "s|^$ROOT_DIR/||" | sort > "$LISTFILE"

# Aggregate into one text file
: > "$OUTFILE"
COUNT=0
while IFS= read -r f; do
  COUNT=$((COUNT+1))
  printf '\n===== BEGIN: %s =====\n' "$f" >> "$OUTFILE"
  # Use cat; if a file is binary (e.g., a .db), we still include bytes; that’s fine for reference.
  # If you’d rather skip .db, remove it from INCLUDE_EXPR above.
  cat "$ROOT_DIR/$f" >> "$OUTFILE" 2>/dev/null || true
  printf '\n===== END: %s =====\n' "$f" >> "$OUTFILE"
done < "$LISTFILE"

printf '\nSnapshot complete: %d files\nOutput: %s\n' "$COUNT" "$OUTFILE"