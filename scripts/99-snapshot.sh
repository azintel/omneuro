#!/usr/bin/env bash
set -euo pipefail

# Local source snapshot (excludes node_modules, dist, etc.)
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="_snapshot"
OUT_FILE="$OUT_DIR/code-snapshot-$STAMP.txt"

mkdir -p "$OUT_DIR"

# If this is a git repo, prefer tracked files (cleaner than find)
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  FILES="$(git ls-files \
    ':!:**/node_modules/**' \
    ':!:**/dist/**' \
    ':!:**/.git/**' \
    ':!:**/.next/**' \
    ':!:**/build/**' \
    ':!:**/.DS_Store' \
  )"
else
  FILES="$(find . \
    -type f \
    ! -path '*/node_modules/*' \
    ! -path '*/dist/*' \
    ! -path '*/.git/*' \
    ! -path '*/.next/*' \
    ! -path '*/build/*' \
    ! -name '.DS_Store' \
  )"
fi

# Limit to code/docs/config extensions
FILTERED="$(
  echo "$FILES" | grep -E '\.(ts|tsx|js|cjs|mjs|json|html|css|md|sql|sh|ya?ml|env|env\.example)$' || true
)"

# Header
{
  echo "==== OMNEURO CODE SNAPSHOT ===="
  echo "Generated: $(date -Iseconds)"
  echo "Repo root: $(pwd)"
  echo
} > "$OUT_FILE"

# Dump each file with a clear delimiter and line numbers
while IFS= read -r f; do
  [ -z "${f:-}" ] && continue
  [ -f "$f" ] || continue
  SIZE="$(wc -c < "$f" | tr -d ' ')"
  echo "===== FILE: $f ($SIZE bytes) =====" >> "$OUT_FILE"
  nl -ba "$f" >> "$OUT_FILE"
  echo >> "$OUT_FILE"
done <<< "$FILTERED"

echo "[snapshot] Wrote $(wc -l < "$OUT_FILE" | tr -d ' ') lines to $OUT_FILE"