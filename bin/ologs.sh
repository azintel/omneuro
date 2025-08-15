#!/usr/bin/env bash
set -euo pipefail
SRC="${1:-app}"
LINES="${2:-80}"
TOKEN=$(tr -d '\n\r' < ~/admin_token.txt)
curl -fsS -H "Authorization: Bearer $TOKEN" "http://3.16.53.108/api/v1/admin/logs?src=${SRC}&lines=${LINES}" | jq .
