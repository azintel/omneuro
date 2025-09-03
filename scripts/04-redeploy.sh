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
export GOOGLE_API_KEY=$(aws ssm get-parameter --name "/omneuro/google/api_key" --with-decryption --region us-east-2 --query "Parameter.Value" --output text)
export GOOGLE_CLIENT_ID=$(aws ssm get-parameter --name "/omneuro/google/client_id" --with-decryption --region us-east-2 --query "Parameter.Value" --output text)
export GOOGLE_CLIENT_SECRET=$(aws ssm get-parameter --name "/omneuro/google/client_secret" --with-decryption --region us-east-2 --query "Parameter.Value" --output text)
export OPENAI_API_KEY=$(aws ssm get-parameter --name "/omneuro/openai/api_key" --with-decryption --region us-east-2 --query "Parameter.Value" --output text)
export SHEETS_SPREADSHEET_ID=$(aws ssm get-parameter --name "/omneuro/google/sheets_spreadsheet_id" --with-decryption --region us-east-2 --query "Parameter.Value" --output text)

# --- Build apps (use local tsc via npm scripts) ---
echo "=== [REDEPLOY] Building apps (npm ci + npm run build) ==="
mkdir -p /home/ubuntu/build-logs

set -x
time npm --prefix apps/brain-api ci
time npm --prefix apps/brain-api run build | tee /home/ubuntu/build-logs/brain-api-tsc.log

time npm --prefix apps/tech-gateway ci
time npm --prefix apps/tech-gateway run build | tee /home/ubuntu/build-logs/tech-gateway-tsc.log
set +x

# --- Sanity: show key artifacts ---
echo "=== [REDEPLOY] Build artifacts sanity ==="
ls -1 apps/tech-gateway/dist/{db,routes,server}.js 2>/dev/null || true
ls -1 apps/brain-api/dist/server.js 2>/dev/null || true
test -f apps/tech-gateway/tsconfig.json && echo "[tsconfig] apps/tech-gateway/tsconfig.json"
test -f apps/brain-api/tsconfig.json && echo "[tsconfig] apps/brain-api/tsconfig.json"

# --- Restart PM2 ---
echo "=== [REDEPLOY] Restarting PM2 apps ==="
pm2 restart ecosystem.config.cjs --update-env
pm2 save

# --- Verify ---
echo "=== [REDEPLOY] Verifying processes ==="
pm2 list

# --- Local health checks ---
echo "=== [REDEPLOY] Local health ==="
if curl -fs http://127.0.0.1:8081/healthz >/dev/null; then
  echo "[OK] brain-api /healthz"
else
  echo "[ERR] brain-api /healthz"
fi

if curl -fs http://127.0.0.1:8092/healthz >/dev/null; then
  echo "[OK] tech-gateway /healthz"
else
  echo "[ERR] tech-gateway /healthz"
fi

if curl -fs http://127.0.0.1:8092/api/health >/dev/null; then
  echo "[OK] tech-gateway /api/health"
else
  echo "[ERR] tech-gateway /api/health"
fi

echo -n "[garage] "
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8092/api/garage/health || true

# --- Public health checks (best-effort) ---
echo "=== [REDEPLOY] Public health (best-effort) ==="
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

# --- Tail last logs for quick glance ---
echo "=== [REDEPLOY] Tail last 80 lines of PM2 logs (tech-gateway) ==="
pm2 logs tech-gateway --lines 80 || true
echo "=== [DONE] ==="