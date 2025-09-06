#!/usr/bin/env bash
# 99-snapshot.sh — emit a single plain-text snapshot of the repo’s source state.
# Produces: code-snapshot-YYYYMMDD-HHMMSS.txt in the repo root.

set -euo pipefail

STAMP="$(date +'%Y%m%d-%H%M%S')"
OUT="code-snapshot-${STAMP}.txt"

# Paths to include (source + config); exclude heavy/derived dirs.
INCLUDE=(
  .
)
EXCLUDE_DIRS=(
  "./.git"
  "./node_modules"
  "./apps/**/node_modules"
  "./**/dist"
  "./**/.next"
  "./**/build"
  "./**/.venv"
  "./**/.DS_Store"
)

# Header
{
  echo "==== OMNEURO CODE SNAPSHOT ===="
  echo "timestamp: ${STAMP}"
  echo "pwd: $(pwd)"
  echo
  echo "---- git status ----"
  git status -sb || true
  echo
  echo "---- git rev ----"
  git rev-parse HEAD 2>/dev/null || true
  echo
  echo "---- git remotes ----"
  git remote -v || true
  echo
  echo "---- tree (top level) ----"
  ls -la || true
  echo
} > "$OUT"

# Build a find expression for exclusions
# (GNU find compatible; macOS BSD find also OK with -E)
FIND_ARGS=()
for p in "${INCLUDE[@]}"; do FIND_ARGS+=("$p"); done
FIND_ARGS+=(
  -type d \( $(printf ' -path %q -o' "${EXCLUDE_DIRS[@]}" | sed 's/ -o$//') \) -prune -false -o
  -type f
)

# Dump file list + contents
{
  echo "==== FILE LIST (filtered) ===="
  # shellcheck disable=SC2068
  find ${FIND_ARGS[@]} | sort

  echo
  echo "==== FILE CONTENTS (concatenated) ===="
  # shellcheck disable=SC2068
  find ${FIND_ARGS[@]} | sort | while read -r f; do
    # Skip likely binary or very large files (>500k)
    if [ "$(wc -c < "$f" 2>/dev/null || echo 0)" -gt 512000 ]; then
      echo "----- SKIP (large) $f -----"
      continue
    fi
    if file "$f" | grep -qiE 'binary|image|archive|audio|video'; then
      echo "----- SKIP (binary) $f -----"
      continue
    fi
    echo "----- BEGIN $f -----"
    sed -n '1,99999p' "$f"
    echo "----- END $f -----"
    echo
  done
} >> "$OUT"

echo "Wrote ${OUT}"