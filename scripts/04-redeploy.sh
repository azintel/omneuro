#!/bin/bash
set -euo pipefail

echo "=== [REDEPLOY] Full cycle ==="
cd /home/ubuntu/omneuro

echo "=== [REDEPLOY] Git sync ==="
git fetch --all
git reset --hard origin/main

# Ensure scripts are executable
chmod +x /home/ubuntu/omneuro/scripts/*.sh || true

echo "=== [REDEPLOY] Fetching secrets from AWS SSM ==="
export GOOGLE_API_KEY=$(aws ssm get-parameter --name "/omneuro/google/api_key" --with-decryption --region us-east-2 --query "Parameter.Value" --output text || echo "")
export GOOGLE_CLIENT_ID=$(aws ssm get-parameter --name "/omneuro/google/client_id" --with-decryption --region us-east-2 --query "Parameter.Value" --output text || echo "")
export GOOGLE_CLIENT_SECRET=$(aws ssm get-parameter --name "/omneuro/google/client_secret" --with-decryption --region us-east-2 --query "Parameter.Value" --output text || echo "")
export OPENAI_API_KEY=$(aws ssm get-parameter --name "/omneuro/openai/api_key" --with-decryption --region us-east-2 --query "Parameter.Value" --output text || echo "")

echo "=== [REDEPLOY] Building apps (npm ci + npm run build) ==="
set -x

time npm --prefix apps/brain-api    ci
time npm --prefix apps/brain-api    run build | tee /home/ubuntu/build-logs/brain-api-tsc.log

time npm --prefix apps/tech-gateway ci
time npm --prefix apps/tech-gateway run build | tee /home/ubuntu/build-logs/tech-gateway-tsc.log

set +x

echo "=== [REDEPLOY] Build artifacts sanity ==="
/usr/bin/find apps/ -maxdepth 3 -type f -path "*/dist/*.js" -printf "%p\n" | sed 's/^/[dist] /' || true
/usr/bin/find apps/ -maxdepth 2 -name tsconfig.json -printf "%p\n" | sed 's/^/[tsconfig] /' || true

echo "=== [REDEPLOY] Restarting PM2 apps ==="
pm2 restart ecosystem.config.cjs --update-env
pm2 save

echo "=== [REDEPLOY] Verifying processes ==="
pm2 list

echo "=== [REDEPLOY] Local health ==="

wait_local_200() {
  local url="$1"
  local tries="${2:-20}"
  local delay="${3:-1}"
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

wait_local_200 "http://127.0.0.1:8081/healthz"
wait_local_200 "http://127.0.0.1:8092/healthz"
wait_local_200 "http://127.0.0.1:8092/api/health"

# Optional: Garage health (best-effort)
if curl -fsSI "http://127.0.0.1:8092/api/garage/health" >/dev/null 2>&1; then
  echo "[OK] garage /api/garage/health"
else
  echo "[WARN] garage /api/garage/health not ready or not mounted"
fi
echo "=== [REDEPLOY] Public health (best-effort) ==="
wait200() {
  local url="$1"; local tries="${2:-20}"; local delay="${3:-2}"
  for i in $(seq 1 "$tries"); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "[OK] $url"; return 0
    fi
    echo "[..] waiting for $url ($i/$tries)"; sleep "$delay"
  done
  echo "[WARN] $url not healthy yet"
  return 1
}
wait200 "https://juicejunkiez.com/nginx-health"
wait200 "https://juicejunkiez.com/"
wait200 "https://tech.juicejunkiez.com/healthz"
wait200 "https://tech.juicejunkiez.com/api/health"

echo "=== [REDEPLOY] Tail last 80 lines of PM2 logs (tech-gateway) ==="
pm2 logs tech-gateway --lines 80 --nostream || true

echo "=== [DONE] ==="