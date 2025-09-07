#!/usr/bin/env bash
set -euo pipefail

# Where the snapshot files will go (override by: OUTDIR=foo ./99-snapshot.sh)
OUTDIR="${OUTDIR:-snapshot}"
STAMP="$(date +%Y%m%d-%H%M%S)"
FILELIST="$OUTDIR/filelist-$STAMP.txt"
OUTFILE="$OUTDIR/code-snapshot-$STAMP.txt"

# Create output dir
mkdir -p "$OUTDIR"

# -------- Select only handwritten code under apps/ --------
# extensions: ts, js, cjs, mjs, json, html, css, sql, md, xml, yml, yaml
# paths to exclude: build outputs, dependencies, vcs, cache, etc.
find apps \
  -type f \( \
      -name '*.ts'  -o -name '*.js'  -o -name '*.cjs' -o -name '*.mjs' \
   -o -name '*.json' -o -name '*.html' -o -name '*.css' \
   -o -name '*.sql'  -o -name '*.md'  -o -name '*.xml' \
   -o -name '*.yml'  -o -name '*.yaml' \
  \) \
  -not -path '*/node_modules/*' \
  -not -path '*/dist/*' \
  -not -path '*/build/*' \
  -not -path '*/.git/*' \
  -not -path '*/.venv/*' \
  -not -path '*/.cache/*' \
  -not -path '*/build-logs/*' \
  -not -path '*/coverage/*' \
  -not -path '*/_snapshots/*' \
  -not -name '._*' \
  | sort > "$FILELIST"

# -------- Aggregate file contents into a single text file --------
: > "$OUTFILE"
COUNT=0

# Use null-delimited loop to be safe with spaces in filenames
# (BSD/macOS find supports -print0)
while IFS= read -r f; do
  COUNT=$((COUNT + 1))
  {
    printf "\n\n===== BEGIN: %s =====\n\n" "$f"
    cat "$f" || true
    printf "\n\n===== END: %s =====\n" "$f"
  } >> "$OUTFILE"
done < "$FILELIST"

printf "\nSnapshot complete: %d files\nOutput: %s\nList:   %s\n" "$COUNT" "$OUTFILE" "$FILELIST"