#!/bin/bash
set -euo pipefail

echo "=== [REDEPLOY] Full cycle ==="
cd /home/ubuntu/omneuro

# --- Prep logs ---
LOG_DIR="/home/ubuntu/deploy-logs"
mkdir -p "$LOG_DIR"

# --- Sync repo ---
echo "=== [REDEPLOY] Git sync ==="
git fetch --all
git reset --hard origin/main

# Ensure scripts are executable
chmod +x /home/ubuntu/omneuro/scripts/*.sh || true

# --- Secrets (best-effort; skip if not present) ---
echo "=== [REDEPLOY] Fetching secrets from AWS SSM (best-effort) ==="
set +e
REGION="${AWS_REGION:-us-east-2}"
OPENAI_API_KEY="$(aws ssm get-parameter --name "/omneuro/openai/api_key" --with-decryption --region "$REGION" --query "Parameter.Value" --output text 2>/dev/null)"
GOOGLE_API_KEY="$(aws ssm get-parameter --name "/omneuro/google/api_key" --with-decryption --region "$REGION" --query "Parameter.Value" --output text 2>/dev/null)"
GOOGLE_CLIENT_ID="$(aws ssm get-parameter --name "/omneuro/google/client_id" --with-decryption --region "$REGION" --query "Parameter.Value" --output text 2>/dev/null)"
GOOGLE_CLIENT_SECRET="$(aws ssm get-parameter --name "/omneuro/google/client_secret" --with-decryption --region "$REGION" --query "Parameter.Value" --output text 2>/dev/null)"
SHEETS_SPREADSHEET_ID="$(aws ssm get-parameter --name "/omneuro/google/sheets_spreadsheet_id" --with-decryption --region "$REGION" --query "Parameter.Value" --output text 2>/dev/null)"
export OPENAI_API_KEY GOOGLE_API_KEY GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET SHEETS_SPREADSHEET_ID
set -e

# --- Build brain-api (verbose tsc) ---
echo "=== [REDEPLOY] Building brain-api ==="
cd apps/brain-api
npm ci --no-audit --no-fund
timeout 180s npx tsc --pretty false --extendedDiagnostics 2>&1 | tee "$LOG_DIR/build-brain-api-$(date +%Y%m%d-%H%M%S).log"
cd - >/dev/null

# --- Build tech-gateway (diagnostics script) ---
echo "=== [REDEPLOY] Building tech-gateway ==="
bash /home/ubuntu/omneuro/scripts/05-build-tech-gateway.sh

# --- Restart PM2 ---
echo "=== [REDEPLOY] Restarting PM2 apps ==="
pm2 restart ecosystem.config.cjs --update-env
pm2 save

# --- Verify PM2 ---
echo "=== [REDEPLOY] Verifying processes ==="
pm2 list

echo "[DEBUG] Running redeploy script from $(realpath "$0")"
echo "=== [REDEPLOY] Health check (local) ==="

# helper function for retries
check_with_retries() {
  local url=$1
  local name=$2
  local retries=10
  local delay=3
  local count=0

  until curl -fsS "$url" >/dev/null; do
    count=$((count+1))
    if [ $count -ge $retries ]; then
      echo "[ERR] $name $url ... FAILED after $retries attempts"
      return 1
    fi
    echo "[..] $name $url ... retrying in ${delay}s ($count/$retries)"
    sleep $delay
  done
  echo "[OK] $name $url"
  return 0
}

# local healths
check_with_retries http://localhost:8081/healthz "brain-api"
check_with_retries http://localhost:8092/healthz "tech-gateway"
check_with_retries http://localhost:8092/api/health "tech-gateway"
check_with_retries http://localhost:8092/api/garage/health "garage"

### --- Public health checks ---
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

wait200 "https://juicejunkiez.com/nginx-health"
wait200 "https://juicejunkiez.com/"
wait200 "https://tech.juicejunkiez.com/healthz"
wait200 "https://tech.juicejunkiez.com/api/health"
wait200 "https://tech.juicejunkiez.com/api/garage/health"

# Optional smoke: minimal garage GET (owner has no vehicles yet OK)
echo "=== [REDEPLOY] Garage smoke test ==="
curl -sS -w " HTTP:%{http_code}\n" "https://tech.juicejunkiez.com/api/garage/vehicles?owner_email=test@example.com" | head -c 400 | sed -E 's/[A-Za-z0-9_\-]{24,}/[REDACTED]/g' || true

echo "=== [REDEPLOY] Done ==="