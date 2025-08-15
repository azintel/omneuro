#!/usr/bin/env bash
set -euo pipefail
SRC="${1:-app}"
LINES="${2:-120}"
BASE_URL="${BASE_URL:-http://3.16.53.108}"
ADMIN_TOKEN_FILE="${ADMIN_TOKEN_FILE:-$HOME/admin_token.txt}"
TOKEN="$(tr -d '\n\r' < "$ADMIN_TOKEN_FILE")"
curl --retry 3 --retry-all-errors --retry-delay 1 --max-time 20 \
  -fsS -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/api/v1/admin/logs?src=${SRC}&lines=${LINES}" | jq .
