////scripts/04-redeploy.sh
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
export BASIC_AUTH_USER="$(get_param "/omneuro/tech-gateway/BASIC_AUTH_USER")"
export BASIC_AUTH_PASS="$(get_param "/omneuro/tech-gateway/BASIC_AUTH_PASS")"
export BLOG_S3_BUCKET="$(getp "/omneuro/blog/s3_bucket")"
export BLOG_BASE_URL="$(getp "/omneuro/blog/base_url")"
export PUBLIC_BLOG_BASE_URL="$(getp "/omneuro/blog/public_base_url")"
export BLOG_PREFIX="$(getp "/omneuro/blog/prefix")"
export BLOG_AWS_REGION="$(getp "/omneuro/blog/aws_region")"
export BLOG_SITEMAP_KEY="$(getp "/omneuro/blog/sitemap_key")"

[[ -z "${BLOG_SITEMAP_KEY:-}" || "${BLOG_SITEMAP_KEY}" == "None" ]] && BLOG_SITEMAP_KEY="blog/sitemap.xml"
[[ -z "${BLOG_AWS_REGION:-}" || "${BLOG_AWS_REGION}" == "None" ]] && BLOG_AWS_REGION="$AWS_REGION"

printf "[SSM] SHEETS_SPREADSHEET_ID=%s\n" "$(printf '%s' "${SHEETS_SPREADSHEET_ID:-<none>}" | sed -E 's/(.{4}).+(.{4})/\1…\2/')"
printf "[SSM] GOOGLE_CALENDAR_ID=%s\n"     "$(printf '%s' "${GOOGLE_CALENDAR_ID:-<none>}" | sed -E 's/(.{4}).+(.{4})/\1…\2/')"
printf "[SSM] SCHED_SPREADSHEET_ID=%s\n"   "$(printf '%s' "${SCHED_SPREADSHEET_ID:-<none>}" | sed -E 's/(.{4}).+(.{4})/\1…\2/')"
echo   "[SSM] BLOG_S3_BUCKET=${BLOG_S3_BUCKET:-<none>}"
echo   "[SSM] BLOG_BASE_URL=${BLOG_BASE_URL:-<none>}"
echo   "[SSM] PUBLIC_BLOG_BASE_URL=${PUBLIC_BLOG_BASE_URL:-<none>}"
echo   "[SSM] BLOG_PREFIX=${BLOG_PREFIX:-<none>}"
echo   "[SSM] BLOG_AWS_REGION=${BLOG_AWS_REGION:-<none>}"
echo   "[SSM] BLOG_SITEMAP_KEY=${BLOG_SITEMAP_KEY:-<none>}"

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
BLOG_S3_BUCKET="${BLOG_S3_BUCKET:-}" \
BLOG_BASE_URL="${BLOG_BASE_URL:-}" \
PUBLIC_BLOG_BASE_URL="${PUBLIC_BLOG_BASE_URL:-${BLOG_BASE_URL:-}}" \
BLOG_PREFIX="${BLOG_PREFIX:-blog}" \
BLOG_AWS_REGION="${BLOG_AWS_REGION:-$AWS_REGION}" \
BLOG_SITEMAP_KEY="${BLOG_SITEMAP_KEY:-blog/sitemap.xml}" \
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
  BLOG_S3_BUCKET: e.BLOG_S3_BUCKET||"<unset>",
  BLOG_BASE_URL: e.BLOG_BASE_URL||"<unset>",
  PUBLIC_BLOG_BASE_URL: e.PUBLIC_BLOG_BASE_URL||"<unset>",
  BLOG_PREFIX: e.BLOG_PREFIX||"<unset>",
  BLOG_AWS_REGION: e.BLOG_AWS_REGION||"<unset>",
  BLOG_SITEMAP_KEY: e.BLOG_SITEMAP_KEY||"<unset>"
});
'

echo "=== [REDEPLOY] Publish homepage ==="
sudo mkdir -p /var/www/juicejunkiez.com
sudo rsync -av --delete apps/homepage/public/ /var/www/juicejunkiez.com/

echo "=== [REDEPLOY] Sync blog content to web root (one-time) ==="
BLOG_S3_BUCKET="$BLOG_S3_BUCKET" \
BLOG_AWS_REGION="$BLOG_AWS_REGION" \
BLOG_SITEMAP_KEY="$BLOG_SITEMAP_KEY" \
bash scripts/90-blog-sync.sh

echo "=== [REDEPLOY] Install/enable blog sync timer (systemd) ==="
# unit files are created elsewhere; just enable and start them idempotently
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

echo "=== [REDEPLOY] Public health ==="
wait200() { local url="$1"; local tries="${2:-20}"; local delay="${3:-2}";
  for i in $(seq 1 "$tries"); do
    if curl -fsS "$url" >/dev/null 2>&1; then echo "[OK] $url"; return 0; fi
    echo "[..] waiting for $url ($i/$tries)"; sleep "$delay";
  done; echo "[ERR] $url failed"; return 1; }
wait200 "https://juicejunkiez.com/nginx-health"
wait200 "https://juicejunkiez.com/"
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