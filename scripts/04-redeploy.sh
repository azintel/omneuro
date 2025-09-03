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

# --- Fetch secrets live (best-effort; non-fatal) ---
echo "=== [REDEPLOY] Fetching secrets from AWS SSM (best-effort) ==="
export GOOGLE_API_KEY=$(aws ssm get-parameter --name "/omneuro/google/api_key" --with-decryption --region us-east-2 --query "Parameter.Value" --output text 2>/dev/null || echo "")
export GOOGLE_CLIENT_ID=$(aws ssm get-parameter --name "/omneuro/google/client_id" --with-decryption --region us-east-2 --query "Parameter.Value" --output text 2>/dev/null || echo "")
export GOOGLE_CLIENT_SECRET=$(aws ssm get-parameter --name "/omneuro/google/client_secret" --with-decryption --region us-east-2 --query "Parameter.Value" --output text 2>/dev/null || echo "")
export OPENAI_API_KEY=$(aws ssm get-parameter --name "/omneuro/openai/api_key" --with-decryption --region us-east-2 --query "Parameter.Value" --output text 2>/dev/null || echo "")

mkdir -p /home/ubuntu/build-logs

# --- Build apps (loud + timeouts, but non-fatal so PM2 can still restart) ---
echo "=== [REDEPLOY] Building apps ==="

echo "== brain-api npm ci =="
time npm --prefix apps/brain-api ci

echo "== brain-api tsc =="
timeout 240s npx -y -p typescript@5.5.4 tsc -p apps/brain-api/tsconfig.json --pretty false \
  | tee /home/ubuntu/build-logs/brain-api-tsc.log || true

echo "== tech-gateway npm ci =="
time npm --prefix apps/tech-gateway ci

echo "== tech-gateway tsc (with extended diagnostics) =="
timeout 300s npx -y -p typescript@5.5.4 tsc -p apps/tech-gateway/tsconfig.json --pretty false --extendedDiagnostics --traceResolution \
  | tee /home/ubuntu/build-logs/tech-gateway-tsc.log || true

# Quick sanity: ensure dist entrypoints exist so PM2 doesn’t crash
echo "== dist sanity =="
ls -l apps/brain-api/dist/server.js || true
ls -l apps/tech-gateway/dist/server.js || true

# --- Restart PM2 ---
echo "=== [REDEPLOY] Restarting PM2 apps ==="
pm2 restart ecosystem.config.cjs --update-env || true
sleep 1
pm2 save || true

# --- Verify processes ---
echo "=== [REDEPLOY] Verifying processes ==="
pm2 list

# --- Health checks (local) ---
echo "=== [REDEPLOY] Local health checks ==="
check_with_retries() {
  local url=$1
  local name=$2
  local retries=15
  local delay=2
  local count=0

  until curl -fsS "$url" >/dev/null 2>&1; do
    count=$((count+1))
    if [ $count -ge $retries ]; then
      echo "[ERR] $name $url FAILED after $retries attempts"
      return 1
    fi
    echo "[..] waiting for $name $url ($count/$retries)"
    sleep $delay
  done
  echo "[OK] $name $url"
  return 0
}

check_with_retries http://127.0.0.1:8081/healthz "brain-api" || true
check_with_retries http://127.0.0.1:8092/healthz "tech-gateway" || true
check_with_retries http://127.0.0.1:8092/api/health "tech-gateway" || true
# garage API health endpoint (must be mounted at /api/garage/health)
check_with_retries http://127.0.0.1:8092/api/garage/health "garage" || true

# --- Log tails for visibility ---
echo "=== [REDEPLOY] Recent logs ==="
tail -n 120 ~/.pm2/logs/tech-gateway-out.log 2>/dev/null || true
tail -n 120 ~/.pm2/logs/tech-gateway-error.log 2>/dev/null || true
tail -n 120 ~/.pm2/logs/brain-api-out.log 2>/dev/null || true
tail -n 120 ~/.pm2/logs/brain-api-error.log 2>/dev/null || true

echo "=== [REDEPLOY] Done ==="