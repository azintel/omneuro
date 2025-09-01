#!/usr/bin/env bash
# scripts/intake/scan.sh
set -euo pipefail

SCAN_DIR="scan"
rm -rf "$SCAN_DIR"
mkdir -p "$SCAN_DIR"

TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
HEAD_SHA="$(git rev-parse HEAD)"

# Manifest
git ls-tree -r --name-only HEAD | sort > "$SCAN_DIR/MANIFEST.files.txt"

# Stitch docs
DOCS_OUT="$SCAN_DIR/DOCS.md"
{
  echo "# Omneuro — Stitched Docs"
  echo "Generated: $TS"
  echo "HEAD: $HEAD_SHA"
} > "$DOCS_OUT"
find docs -type f -name "*.md" | sort | while read -r f; do
  echo -e "\n---\n### $f\n\`\`\`md" >> "$DOCS_OUT"
  cat "$f" >> "$DOCS_OUT"
  echo -e "\n\`\`\`" >> "$DOCS_OUT"
done

# Stitch app entrypoints (server + routes)
APPS_OUT="$SCAN_DIR/APPS.md"
echo "# Omneuro — App Entrypoints" > "$APPS_OUT"
find apps -type f \( -name "server.js" -o -name "routes.js" \) | sort | while read -r f; do
  echo -e "\n---\n### $f\n\`\`\`js" >> "$APPS_OUT"
  cat "$f" >> "$APPS_OUT"
  echo -e "\n\`\`\`" >> "$APPS_OUT"
done