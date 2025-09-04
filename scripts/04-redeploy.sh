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
export SCHED_SPREADSHEET_ID="$(aws ssm get-parameter --region us-east-2 --name /omneuro/google/scheduler_spreadsheet_id --query Parameter.Value --output text 2>/dev/null || true)"
export GOOGLE_CALENDAR_ID="$(aws ssm get-parameter --region us-east-2 --name /omneuro/google/calendar_id --query Parameter.Value --output text 2>/dev/null || true)"
echo "[SSM] SCHED_SPREADSHEET_ID=${SCHED_SPREADSHEET_ID:0:6}…"
echo "[SSM] GOOGLE_CALENDAR_ID=${GOOGLE_CALENDAR_ID:0:6}…"
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

echo "=== [REDEPLOY] Restarting PM2 apps ==="
# Always inject the sheet id inline so PM2 captures it
if [[ -n "${SHEETS_SPREADSHEET_ID:-}" ]]; then
  SHEETS_SPREADSHEET_ID="$SHEETS_SPREADSHEET_ID" pm2 startOrReload ecosystem.config.cjs --only tech-gateway --update-env
else
  echo "[WARN] SHEETS_SPREADSHEET_ID not set in shell; starting tech-gateway without it"
  pm2 startOrReload ecosystem.config.cjs --only tech-gateway --update-env
fi

pm2 startOrReload ecosystem.config.cjs --only brain-api --update-env
pm2 save

echo "=== [REDEPLOY] Check PM2 env ==="
pm2 jlist | node -e 'const a=JSON.parse(require("fs").readFileSync(0,"utf8")); const p=a.find(x=>x.name==="tech-gateway"); console.log("SHEETS_SPREADSHEET_ID in PM2:", p?.pm2_env?.env?.SHEETS_SPREADSHEET_ID ?? "<unset>");'

echo "=== [REDEPLOY] Sync homepage to web root ==="
sudo mkdir -p /var/www/juicejunkiez.com
sudo rsync -av --delete apps/homepage/public/ /var/www/juicejunkiez.com/

echo "=== [REDEPLOY] Local health (with retries) ==="
# Wait for tech-gateway to bind; avoid false negatives
tries=20
until curl -fsS http://127.0.0.1:8092/healthz >/dev/null 2>&1; do
  ((tries--)) || { echo "[ERR] tech-gateway /healthz (local) never came up"; break; }
  echo "[..] waiting on tech-gateway /healthz ($((20-tries))/20)"
  sleep 1
done

if curl -fsS http://127.0.0.1:8092/healthz >/dev/null 2>&1; then
  echo "[OK] tech-gateway /healthz (local)"
else
  echo "[ERR] tech-gateway /healthz (local)"
fi

if curl -fsS http://127.0.0.1:8092/api/health >/dev/null 2>&1; then
  echo "[OK] tech-gateway /api/health (local)"
else
  echo "[ERR] tech-gateway /api/health (local)"
fi

echo "[garage] $(curl -i -s http://127.0.0.1:8092/api/garage/health | head -n 1 || true)"

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