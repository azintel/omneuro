#!/usr/bin/env bash
set -euo pipefail
BASE_URL="${BASE_URL:-http://3.16.53.108}"
ADMIN_TOKEN_FILE="${ADMIN_TOKEN_FILE:-$HOME/admin_token.txt}"
TOKEN="$(tr -d '\n\r' < "$ADMIN_TOKEN_FILE")"
curl --retry 5 --retry-all-errors --retry-delay 1 --max-time 30 \
  -fsS -X POST "$BASE_URL/api/v1/admin/deploy" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"reason":"odeploy"}' >/dev/null

for i in $(seq 1 40); do
  if curl -fsS "$BASE_URL/api/health" >/dev/null; then
    echo "OK"
    exit 0
  fi
  sleep 1
done

echo "ERROR: health check did not return OK in time" >&2
exit 1
