# scripts/10-scan-app-files.sh
#!/usr/bin/env bash
set -euo pipefail

# repo root guard (optional)
[ -f "package.json" ] || { echo "Run from repo root"; exit 1; }

OUT_DIR="scan"
OUT_APPS="${OUT_DIR}/APPS.md"
OUT_MANIFEST="${OUT_DIR}/MANIFEST.files.txt"

mkdir -p "${OUT_DIR}"

# List only the app code we care about right now (expand as needed)
INCLUDE_DIRS=(
  "apps/homepage/public"
  "apps/tech-gateway/src"
  "apps/tech-gateway/public"
  "apps/brain-api"
)

# Build file manifest (text)
: > "${OUT_MANIFEST}"
for d in "${INCLUDE_DIRS[@]}"; do
  if [ -d "$d" ]; then
    find "$d" -type f \( -name "*.ts" -o -name "*.js" -o -name "*.html" -o -name "*.json" -o -name "*.cjs" -o -name "*.md" \) | sort >> "${OUT_MANIFEST}"
  fi
done

# Write APPS.md with raw links for each file on current branch (default main)
BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)"
REPO_SLUG="$(git remote get-url origin | sed -E 's#(git@|https://)(github.com[:/])?##; s/\.git$//')"

{
  echo "# Omneuro — App Files (branch: ${BRANCH})"
  echo
  echo "Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo
  while IFS= read -r f; do
    # Normalize path without leading ./ if present
    f="${f#./}"
    RAW="https://raw.githubusercontent.com/${REPO_SLUG}/${BRANCH}/${f}"
    echo "### ${f}"
    echo ""
    echo "\`\`\`txt"
    echo "${RAW}"
    echo "\`\`\`"
    echo ""
  done < "${OUT_MANIFEST}"
} > "${OUT_APPS}"

echo "[ok] wrote ${OUT_APPS} and ${OUT_MANIFEST}"
