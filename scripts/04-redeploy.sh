#!/bin/bash
set -euo pipefail

echo "=== [REDEPLOY] Full cycle ==="
cd /home/ubuntu/omneuro

# --- Git sync ---
echo "=== [REDEPLOY] Git sync ==="
git fetch --all
git reset --hard origin/main

# Ensure scripts are executable
chmod +x /home/ubuntu/omneuro/scripts/*.sh || true

# --- Secrets / env from SSM (best-effort; continue if missing) ---
echo "=== [REDEPLOY] Fetching secrets from AWS SSM ==="
REGION="${AWS_REGION:-us-east-2}"

export GOOGLE_API_KEY="$(aws ssm get-parameter --name "/omneuro/google/api_key" --with-decryption --region "$REGION" --query "Parameter.Value" --output text 2>/dev/null || echo "")"
export GOOGLE_CLIENT_ID="$(aws ssm get-parameter --name "/omneuro/google/client_id" --with-decryption --region "$REGION" --query "Parameter.Value" --output text 2>/dev/null || echo "")"
export GOOGLE_CLIENT_SECRET="$(aws ssm get-parameter --name "/omneuro/google/client_secret" --with-decryption --region "$REGION" --query "Parameter.Value" --output text 2>/dev/null || echo "")"
export OPENAI_API_KEY="$(aws ssm get-parameter --name "/omneuro/openai/api_key" --with-decryption --region "$REGION" --query "Parameter.Value" --output text 2>/dev/null || echo "")"

# Garage/Sheets wiring
export OMNEURO_GOOGLE_SA_PARAM="${OMNEURO_GOOGLE_SA_PARAM:-/omneuro/google/sa_json}"
export SHEETS_SPREADSHEET_ID="$(aws ssm get-parameter --name "/omneuro/google/sheets/garage_id" --with-decryption --region "$REGION" --query "Parameter.Value" --output text 2>/dev/null || echo "")"

if [[ -z "${SHEETS_SPREADSHEET_ID:-}" ]]; then
  echo "[WARN] SHEETS_SPREADSHEET_ID not found in SSM (/omneuro/google/sheets/garage_id). Sheets writes will be skipped."
fi

# --- Build apps (bounded + logged) ---
echo "=== [REDEPLOY] Building apps ==="
mkdir -p /home/ubuntu/build-logs

# tech-gateway
echo "== tech-gateway: npm ci (lockfiles tracked) =="
npm --prefix apps/tech-gateway ci

echo "== tech-gateway: tsc build (timeout + logs) =="
set +e
timeout 300s npm --prefix apps/tech-gateway run build \
  | tee /home/ubuntu/build-logs/tech-gateway-build.log
TG_RC=${PIPESTATUS[0]}
set -e
if [[ $TG_RC -ne 0 ]]; then
  echo "[ERROR] tech-gateway build failed (rc=$TG_RC). See /home/ubuntu/build-logs/tech-gateway-build.log"
  exit $TG_RC
fi

# brain-api
echo "== brain-api: npm ci =="
npm --prefix apps/brain-api ci

echo "== brain-api: tsc build (timeout + logs) =="
set +e
timeout 180s npm --prefix apps/brain-api run build \
  | tee /home/ubuntu/build-logs/brain-api-build.log
BA_RC=${PIPESTATUS[0]}
set -e
if [[ $BA_RC -ne 0 ]]; then
  echo "[ERROR] brain-api build failed (rc=$BA_RC). See /home/ubuntu/build-logs/brain-api-build.log"
  exit $BA_RC
fi

# --- Restart PM2 with env ---
echo "=== [REDEPLOY] Restarting PM2 apps ==="
pm2 restart ecosystem.config.cjs --update-env
pm2 save

# --- Local health checks ---
echo "=== [REDEPLOY] Local health checks ==="

check_with_retries() {
  local url="$1"
  local name="$2"
  local tries="${3:-15}"
  local delay="${4:-2}"
  for i in $(seq 1 "$tries"); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "[OK] $name $url"
      return 0
    fi
    echo "[..] $name not ready ($i/$tries): $url"
    sleep "$delay"
  done
  echo "[ERR] $name failed: $url"
  return 1
}

LC_RC=0
check_with_retries "http://127.0.0.1:8092/healthz" "tech-gateway-local" || LC_RC=1
check_with_retries "http://127.0.0.1:8092/api/health" "tech-gateway-local-api" || LC_RC=1
check_with_retries "http://127.0.0.1:8081/healthz" "brain-api-local" || LC_RC=1

# Garage health (optional; shouldn’t fail deploy if missing)
curl -i -s "http://127.0.0.1:8092/api/garage/health" | head -n 1 || true

# --- Public health checks ---
echo "=== [REDEPLOY] Public health checks ==="
PH_RC=0
check_with_retries "https://tech.juicejunkiez.com/healthz" "tech-gateway-public" || PH_RC=1
check_with_retries "https://tech.juicejunkiez.com/api/health" "tech-gateway-public-api" || PH_RC=1
# non-fatal garage public check (may be behind auth/routes)
curl -i -s "https://tech.juicejunkiez.com/api/garage/health" | head -n 1 || true

# --- Summaries ---
echo "=== [REDEPLOY] pm2 list ==="
pm2 list || true

echo "=== [REDEPLOY] tail logs (last 120 lines) ==="
tail -n 120 ~/.pm2/logs/tech-gateway-out.log ~/.pm2/logs/tech-gateway-error.log ~/.pm2/logs/brain-api-out.log ~/.pm2/logs/brain-api-error.log 2>/dev/null || true

# Exit non-zero only if core health failed
if [[ $LC_RC -ne 0 || $PH_RC -ne 0 ]]; then
  echo "[WARN] Some mandatory health checks failed."
  exit 1
fi

echo "=== [REDEPLOY] Done ==="