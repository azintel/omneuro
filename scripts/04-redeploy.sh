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
export AWS_REGION="us-east-2"

getp () {
  local name="$1"
  aws ssm get-parameter --name "$name" --with-decryption --region "$AWS_REGION" --query "Parameter.Value" --output text
}

export GOOGLE_API_KEY="$(getp "/omneuro/google/api_key" || true)"
export GOOGLE_CLIENT_ID="$(getp "/omneuro/google/client_id" || true)"
export GOOGLE_CLIENT_SECRET="$(getp "/omneuro/google/client_secret" || true)"
export OPENAI_API_KEY="$(getp "/omneuro/openai/api_key" || true)"
export SHEETS_SPREADSHEET_ID="$(getp "/omneuro/google/sheets_spreadsheet_id" || true)"

if [ -z "${SHEETS_SPREADSHEET_ID:-}" ] || [ "${SHEETS_SPREADSHEET_ID}" = "None" ]; then
  echo "[FATAL] /omneuro/google/sheets_spreadsheet_id is missing/empty in SSM." >&2
  exit 2
fi
echo "[SSM] SHEETS_SPREADSHEET_ID=$(printf '%s' "$SHEETS_SPREADSHEET_ID" | sed -E 's/(.{4}).+(.{4})/\1…\2/')"

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

# --- Restart PM2 with updated env (re-read ecosystem) ---
echo "=== [REDEPLOY] Restarting PM2 apps ==="
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save

# --- Verify PM2 env received SHEETS_SPREADSHEET_ID ---
echo "=== [REDEPLOY] Check PM2 env ==="
# try by name, fall back to id 2 (tech-gateway)
if pm2 env tech-gateway >/tmp/pm2env.txt 2>/dev/null; then
  :
else
  pm2 env 2 >/tmp/pm2env.txt 2>/dev/null || true
fi
grep -E 'SHEETS_SPREADSHEET_ID=' /tmp/pm2env.txt | sed -E 's/(SHEETS_SPREADSHEET_ID=).+/\1[REDACTED]/' || echo "[WARN] SHEETS_SPREADSHEET_ID not found in PM2 env"

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

# --- Tail last logs once (no hang) ---
echo "=== [REDEPLOY] Tail last 80 lines of PM2 logs (tech-gateway) ==="
pm2 logs tech-gateway --lines 80 --nostream || true

echo "=== [DONE] ==="