# ////scripts/04-redeploy.sh
#!/bin/bash
set -euo pipefail

echo "=== [REDEPLOY] Full cycle ==="
cd /home/ubuntu/omneuro

echo "=== [REDEPLOY] Git sync ==="
git fetch --all
git reset --hard origin/main

chmod +x /home/ubuntu/omneuro/scripts/*.sh || true

# --- AWS Region ---
export AWS_REGION="us-east-2"

# --- Helper: get SSM param (with decryption) ---
getp() {
  local name="$1"
  aws ssm get-parameter --name "$name" --with-decryption --region "$AWS_REGION" \
    --query "Parameter.Value" --output text 2>/dev/null || true
}

echo "=== [REDEPLOY] Fetching secrets from AWS SSM ==="
export SHEETS_SPREADSHEET_ID="$(getp "/omneuro/google/sheets_spreadsheet_id")"
export GOOGLE_CALENDAR_ID="$(getp "/omneuro/google/calendar_id")"
export SCHED_SPREADSHEET_ID="$(getp "/omneuro/google/scheduler_spreadsheet_id")"

export BASIC_AUTH_USER="$(getp "/omneuro/tech-gateway/BASIC_AUTH_USER")"
export BASIC_AUTH_PASS="$(getp "/omneuro/tech-gateway/BASIC_AUTH_PASS")"
export TECH_GATEWAY_ACCESS_TOKEN="$(getp "/omneuro/tech-gateway/access_token")"

export BLOG_S3_BUCKET="$(getp "/omneuro/blog/s3_bucket")"
export BLOG_BASE_URL="$(getp "/omneuro/blog/base_url")"
export PUBLIC_BLOG_BASE_URL="$(getp "/omneuro/blog/public_base_url")"
export BLOG_PREFIX="$(getp "/omneuro/blog/prefix")"
export BLOG_AWS_REGION="$(getp "/omneuro/blog/aws_region")"
export BLOG_SITEMAP_KEY="$(getp "/omneuro/blog/sitemap_key")"

export PUBLIC_TECH_BASE_URL="$(getp "/omneuro/tech-gateway/public_base_url")"
export GOOGLE_PLACES_API_KEY="$(getp "/omneuro/tech-gateway/GOOGLE_PLACES_API_KEY")"

# Store / Stripe
# IMPORTANT: we are using /omneuro/store/stripe_secret  (not *_key)
export STRIPE_SECRET_KEY="$(getp "/omneuro/store/stripe_secret")"
export STORE_SUCCESS_URL="$(getp "/omneuro/store/success_url")"
export STORE_CANCEL_URL="$(getp "/omneuro/store/cancel_url")"

# Defaults/fallbacks
[[ -z "${BLOG_SITEMAP_KEY:-}"     || "${BLOG_SITEMAP_KEY}"     == "None" ]] && BLOG_SITEMAP_KEY="blog/sitemap.xml"
[[ -z "${BLOG_AWS_REGION:-}"      || "${BLOG_AWS_REGION}"      == "None" ]] && BLOG_AWS_REGION="$AWS_REGION"
[[ -z "${BLOG_PREFIX:-}"          || "${BLOG_PREFIX}"          == "None" ]] && BLOG_PREFIX="blog"
[[ -z "${PUBLIC_BLOG_BASE_URL:-}" || "${PUBLIC_BLOG_BASE_URL}" == "None" ]] && PUBLIC_BLOG_BASE_URL="${BLOG_BASE_URL:-}"
[[ -z "${STORE_SUCCESS_URL:-}"    || "${STORE_SUCCESS_URL}"    == "None" ]] && STORE_SUCCESS_URL="https://juicejunkiez.com/store/?status=success"
[[ -z "${STORE_CANCEL_URL:-}"     || "${STORE_CANCEL_URL}"     == "None" ]] && STORE_CANCEL_URL="https://juicejunkiez.com/store/?status=cancel"

# Redacted prints for quick diag
printf "[SSM] SHEETS_SPREADSHEET_ID=%s\n" "$(printf '%s' "${SHEETS_SPREADSHEET_ID:-<none>}" | sed -E 's/(.{4}).+(.{4})/\1…\2/')"
printf "[SSM] GOOGLE_CALENDAR_ID=%s\n"     "$(printf '%s' "${GOOGLE_CALENDAR_ID:-<none>}"      | sed -E 's/(.{4}).+(.{4})/\1…\2/')"
printf "[SSM] SCHED_SPREADSHEET_ID=%s\n"   "$(printf '%s' "${SCHED_SPREADSHEET_ID:-<none>}"    | sed -E 's/(.{4}).+(.{4})/\1…\2/')"
echo   "[SSM] BASIC_AUTH_USER=${BASIC_AUTH_USER:-<none>}"
printf "[SSM] BASIC_AUTH_PASS=%s\n"        "$(printf '%s' "${BASIC_AUTH_PASS:-<none>}"         | sed -E 's/^(.{3}).+(.{3})$/\1…\2/')"
printf "[SSM] TECH_GATEWAY_ACCESS_TOKEN=%s\n" "$(printf '%s' "${TECH_GATEWAY_ACCESS_TOKEN:-<none>}" | sed -E 's/^(.{3}).+(.{3})$/\1…\2/')"
echo   "[SSM] BLOG_S3_BUCKET=${BLOG_S3_BUCKET:-<none>}"
echo   "[SSM] BLOG_BASE_URL=${BLOG_BASE_URL:-<none>}"
echo   "[SSM] PUBLIC_BLOG_BASE_URL=${PUBLIC_BLOG_BASE_URL:-<none>}"
echo   "[SSM] BLOG_PREFIX=${BLOG_PREFIX:-<none>}"
echo   "[SSM] BLOG_AWS_REGION=${BLOG_AWS_REGION:-<none>}"
echo   "[SSM] BLOG_SITEMAP_KEY=${BLOG_SITEMAP_KEY:-<none>}"
echo   "[SSM] PUBLIC_TECH_BASE_URL=${PUBLIC_TECH_BASE_URL:-<none>}"
printf "[SSM] GOOGLE_PLACES_API_KEY=%s\n"  "$(printf '%s' "${GOOGLE_PLACES_API_KEY:-<none>}"   | sed -E 's/^(.{4}).+(.{4})$/\1…\2/')"
printf "[SSM] STRIPE_SECRET_KEY=%s\n"      "$(printf '%s' "${STRIPE_SECRET_KEY:-<none>}"       | sed -E 's/^(.{4}).+(.{4})$/\1…\2/')"
echo   "[SSM] STORE_SUCCESS_URL=${STORE_SUCCESS_URL:-<none>}"
echo   "[SSM] STORE_CANCEL_URL=${STORE_CANCEL_URL:-<none>}"

echo "=== [REDEPLOY] Building apps (npm ci + build) ==="
set -x
time npm --prefix apps/brain-api ci
time npm --prefix apps/brain-api run build | tee /home/ubuntu/build-logs/brain-api-tsc.log

time npm --prefix apps/tech-gateway ci
time npm --prefix apps/tech-gateway run build | tee /home/ubuntu/build-logs/tech-gateway-tsc.log
set +x

echo "=== [REDEPLOY] Build artifacts ==="
ls -1 apps/tech-gateway/dist/{db,routes,server}.js 2>/dev/null || true
ls -1 apps/brain-api/dist/server.js 2>/dev/null || true

echo "=== [REDEPLOY] Restart PM2 (with env) ==="
SHEETS_SPREADSHEET_ID="$SHEETS_SPREADSHEET_ID" \
GOOGLE_CALENDAR_ID="$GOOGLE_CALENDAR_ID" \
SCHED_SPREADSHEET_ID="$SCHED_SPREADSHEET_ID" \
BASIC_AUTH_USER="${BASIC_AUTH_USER:-}" \
BASIC_AUTH_PASS="${BASIC_AUTH_PASS:-}" \
TECH_GATEWAY_ACCESS_TOKEN="${TECH_GATEWAY_ACCESS_TOKEN:-}" \
BLOG_S3_BUCKET="${BLOG_S3_BUCKET:-}" \
BLOG_BASE_URL="${BLOG_BASE_URL:-}" \
PUBLIC_BLOG_BASE_URL="${PUBLIC_BLOG_BASE_URL:-${BLOG_BASE_URL:-}}" \
BLOG_PREFIX="${BLOG_PREFIX:-blog}" \
BLOG_AWS_REGION="${BLOG_AWS_REGION:-$AWS_REGION}" \
BLOG_SITEMAP_KEY="${BLOG_SITEMAP_KEY:-blog/sitemap.xml}" \
PUBLIC_TECH_BASE_URL="${PUBLIC_TECH_BASE_URL:-}" \
GOOGLE_PLACES_API_KEY="${GOOGLE_PLACES_API_KEY:-}" \
STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY:-}" \
STORE_SUCCESS_URL="${STORE_SUCCESS_URL:-https://juicejunkiez.com/store/?status=success}" \
STORE_CANCEL_URL="${STORE_CANCEL_URL:-https://juicejunkiez.com/store/?status=cancel}" \
pm2 startOrReload ecosystem.config.cjs --only tech-gateway --update-env

pm2 startOrReload ecosystem.config.cjs --only brain-api --update-env
pm2 save

echo "=== [REDEPLOY] PM2 env check (tech-gateway) ==="
pm2 jlist | node -e '
const a=JSON.parse(require("fs").readFileSync(0,"utf8"));
const p=a.find(x=>x.name==="tech-gateway")||{};
const e=p.pm2_env?.env||{};
console.log({
  SHEETS_SPREADSHEET_ID: e.SHEETS_SPREADSHEET_ID||"<unset>",
  GOOGLE_CALENDAR_ID: e.GOOGLE_CALENDAR_ID||"<unset>",
  SCHED_SPREADSHEET_ID: e.SCHED_SPREADSHEET_ID||"<unset>",
  BASIC_AUTH_USER: e.BASIC_AUTH_USER||"<unset>",
  BASIC_AUTH_PASS: (e.BASIC_AUTH_PASS? "****" : "<unset>"),
  TECH_GATEWAY_ACCESS_TOKEN: e.TECH_GATEWAY_ACCESS_TOKEN||"<unset>",
  BLOG_S3_BUCKET: e.BLOG_S3_BUCKET||"<unset>",
  BLOG_BASE_URL: e.BLOG_BASE_URL||"<unset>",
  PUBLIC_BLOG_BASE_URL: e.PUBLIC_BLOG_BASE_URL||"<unset>",
  BLOG_PREFIX: e.BLOG_PREFIX||"<unset>",
  BLOG_AWS_REGION: e.BLOG_AWS_REGION||"<unset>",
  BLOG_SITEMAP_KEY: e.BLOG_SITEMAP_KEY||"<unset>",
  PUBLIC_TECH_BASE_URL: e.PUBLIC_TECH_BASE_URL||"<unset>",
  GOOGLE_PLACES_API_KEY: e.GOOGLE_PLACES_API_KEY||"<unset>",
  STRIPE_SECRET_KEY: (e.STRIPE_SECRET_KEY? "****" : "<unset>"),
  STORE_SUCCESS_URL: e.STORE_SUCCESS_URL||"<unset>",
  STORE_CANCEL_URL: e.STORE_CANCEL_URL||"<unset>"
});
'

echo "=== [REDEPLOY] Publish homepage (includes /store) ==="
sudo mkdir -p /var/www/juicejunkiez.com
sudo rsync -av --delete apps/homepage/public/ /var/www/juicejunkiez.com/

echo "=== [REDEPLOY] Sync blog content to web root (one-time) ==="
BLOG_S3_BUCKET="$BLOG_S3_BUCKET" \
BLOG_AWS_REGION="$BLOG_AWS_REGION" \
BLOG_SITEMAP_KEY="$BLOG_SITEMAP_KEY" \
BLOG_PREFIX="$BLOG_PREFIX" \
bash scripts/90-blog-sync.sh

echo "=== [REDEPLOY] Install/enable blog sync timer (systemd) ==="
sudo systemctl daemon-reload
sudo systemctl enable --now omneuro-blog-sync.timer || true
systemctl list-timers --all | grep -E "omneuro-blog-sync|NEXT" || true

echo "=== [REDEPLOY] Local health checks ==="
tries=40
until curl -fsS http://127.0.0.1:8092/healthz >/dev/null 2>&1; do
  ((tries--)) || { echo "[ERR] tech-gateway /healthz never came up"; break; }
  echo "[..] waiting on /healthz ($((40-tries))/40)"; sleep 1
done

curl -fsS http://127.0.0.1:8092/healthz >/dev/null && echo "[OK] /healthz" || echo "[ERR] /healthz"
curl -fsS http://127.0.0.1:8092/api/health >/dev/null && echo "[OK] /api/health" || echo "[ERR] /api/health"
echo "[garage] $(curl -i -s http://127.0.0.1:8092/api/garage/health | head -n 1 || true)"
curl -fsS http://127.0.0.1:8092/api/store/health >/dev/null && echo "[OK] /api/store/health" || echo "[ERR] /api/store/health"

echo "=== [REDEPLOY] Public health ==="
wait200() { local url="$1"; local tries="${2:-20}"; local delay="${3:-2}";
  for i in $(seq 1 "$tries"); do
    if curl -fsS "$url" >/dev/null 2>&1; then echo "[OK] $url"; return 0; fi
    echo "[..] waiting for $url ($i/$tries)"; sleep "$delay";
  done; echo "[ERR] $url failed"; return 1; }
wait200 "https://juicejunkiez.com/nginx-health"
wait200 "https://juicejunkiez.com/"
wait200 "https://juicejunkiez.com/store/"
wait200 "https://juicejunkiez.com/store/index.html"
wait200 "https://tech.juicejunkiez.com/healthz"
wait200 "https://tech.juicejunkiez.com/api/health"

echo "=== [REDEPLOY] Extended health ==="
curl -fsS https://juicejunkiez.com/sitemap.xml       >/dev/null && echo "[OK] root sitemap"
curl -fsS https://juicejunkiez.com/blog-sitemap.xml  >/dev/null && echo "[OK] blog sitemap" || true
curl -fsS https://tech.juicejunkiez.com/api/scheduler/health | jq . || true
curl -fsS https://tech.juicejunkiez.com/api/tech/health       | jq . || true

echo "=== [REDEPLOY] Tail last 120 lines (tech-gateway) ==="
pm2 logs tech-gateway --lines 120 --nostream || true

echo "=== [DONE] ==="