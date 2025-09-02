#!/bin/bash
set -euo pipefail

echo "=== [REDEPLOY] Full cycle ==="
cd /home/ubuntu/omneuro

# --- Sync repo ---
echo "=== [REDEPLOY] Git sync ==="
git fetch --all
git reset --hard origin/main

# Ensure scripts are executable
chmod +x /home/ubuntu/omneuro/scripts/*.sh || true

# --- Fetch secrets live ---
echo "=== [REDEPLOY] Fetching secrets from AWS SSM ==="
export OPENAI_API_KEY=$(aws ssm get-parameter --name "/omneuro/openai/api_key" --with-decryption --region us-east-2 --query "Parameter.Value" --output text || echo "")
export GOOGLE_API_KEY=$(aws ssm get-parameter --name "/omneuro/google/api_key" --with-decryption --region us-east-2 --query "Parameter.Value" --output text || echo "")
export GOOGLE_CLIENT_ID=$(aws ssm get-parameter --name "/omneuro/google/client_id" --with-decryption --region us-east-2 --query "Parameter.Value" --output text || echo "")
export GOOGLE_CLIENT_SECRET=$(aws ssm get-parameter --name "/omneuro/google/client_secret" --with-decryption --region us-east-2 --query "Parameter.Value" --output text || echo "")

# New: spreadsheet id (store as plain String in SSM)
export SHEETS_SPREADSHEET_ID=$(aws ssm get-parameter --name "/omneuro/google/sheets_spreadsheet_id" --region us-east-2 --query "Parameter.Value" --output text || echo "")

if [ -z "${SHEETS_SPREADSHEET_ID:-}" ]; then
  echo "[WARN] SHEETS_SPREADSHEET_ID is empty (SSM /omneuro/google/sheets_spreadsheet_id missing?). Sheets writes will be skipped."
fi

# --- Build apps ---
echo "=== [REDEPLOY] Building apps ==="
cd apps/brain-api && npm ci && npm run build && cd -
cd apps/tech-gateway && npm ci && npm run build && cd -

# --- Restart PM2 with current env ---
echo "=== [REDEPLOY] Restarting PM2 apps ==="
pm2 restart ecosystem.config.cjs --update-env
pm2 save

# --- Verify ---
echo "=== [REDEPLOY] Verifying processes ==="
pm2 list

echo "[DEBUG] Running redeploy script from $(realpath "$0")"
echo "=== [REDEPLOY] Health check ==="

# helper function for retries
check_with_retries() {
  local url=$1
  local name=$2
  local retries=15
  local delay=2
  local count=0

  until curl -fsS "$url" >/dev/null 2>&1; do
    count=$((count+1))
    if [ $count -ge $retries ]; then
      echo "Checking $name $url ... FAILED after $retries attempts"
      return 1
    fi
    echo "Checking $name $url ... not up yet, retrying in $delay sec"
    sleep $delay
  done
  echo "Checking $name $url ... OK"
  return 0
}

# Local health (loopback)
check_with_retries "http://127.0.0.1:8081/healthz" "brain-api" || true
check_with_retries "http://127.0.0.1:8092/healthz" "tech-gateway" || true
check_with_retries "http://127.0.0.1:8092/api/health" "tech-gateway" || true
check_with_retries "http://127.0.0.1:8092/api/garage/health" "garage" || true

### --- Public health (nginx/TLS) ---
echo "=== [REDEPLOY] Health check (public) ==="
wait200() {
  local url="$1"
  local tries="${2:-20}"
  local delay="${3:-2}"
  for i in $(seq 1 "$tries"); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "[OK] $url"
      return 0
    fi
    echo "[..] waiting for $url ($i/$tries)"
    sleep "$delay"
  done
  echo "[ERR] $url did not become healthy" >&2
  return 1
}

# 1) Nginx + homepage
wait200 "https://juicejunkiez.com/nginx-health" || true
wait200 "https://juicejunkiez.com/" || true

# 2) Tech portal
wait200 "https://tech.juicejunkiez.com/healthz" || true
wait200 "https://tech.juicejunkiez.com/api/health" || true
wait200 "https://tech.juicejunkiez.com/api/garage/health" || true

# 3) Optional Garage smoke (GET) - non-fatal
echo "=== [REDEPLOY] Garage API smoke (GET vehicles) ==="
curl -sS "https://tech.juicejunkiez.com/api/garage/vehicles?owner_email=$(python3 - <<'PY'
print("test@example.com")
PY
)" | head -c 400; echo

# 4) Optional Chat smoke - non-fatal
echo "=== [REDEPLOY] Chat API smoke ==="
CHAT_JSON='{"messages":[{"role":"user","content":"Say hello, Repairbot."}]}'
CHAT_OUT="$(curl -sS -w " HTTP:%{http_code}" -H "content-type: application/json" -d "$CHAT_JSON" "https://tech.juicejunkiez.com/api/chat" || true)"
HTTP_CODE="${CHAT_OUT##* HTTP:}"
BODY="${CHAT_OUT% HTTP:*}"
if [ "$HTTP_CODE" = "200" ]; then
  echo "[OK] chat API HTTP 200"
else
  echo "[WARN] chat API not healthy (HTTP $HTTP_CODE). Body (trimmed):"
  echo "$BODY" | sed -E 's/[A-Za-z0-9_\-]{24,}/[REDACTED]/g' | head -c 400; echo
fi