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

# --- AWS Region ---
export AWS_REGION="us-east-2"

# --- Helper: get SSM param (with decryption) ---
getp () {
  local name="$1"
  aws ssm get-parameter --name "$name" --with-decryption --region "$AWS_REGION" \
    --query "Parameter.Value" --output text 2>/dev/null || true
}

echo "=== [REDEPLOY] Fetching secrets from AWS SSM ==="
# Google/OpenAI
export GOOGLE_API_KEY="$(getp "/omneuro/google/api_key")"
export GOOGLE_CLIENT_ID="$(getp "/omneuro/google/client_id")"
export GOOGLE_CLIENT_SECRET="$(getp "/omneuro/google/client_secret")"
export OPENAI_API_KEY="$(getp "/omneuro/openai/api_key")"

# IDs
export SCHED_SPREADSHEET_ID="$(getp "/omneuro/google/scheduler_spreadsheet_id")"
export GOOGLE_CALENDAR_ID="$(getp "/omneuro/google/calendar_id")"
export SHEETS_SPREADSHEET_ID="$(getp "/omneuro/google/sheets_spreadsheet_id")"

# BLOG (NEW)
export BLOG_S3_BUCKET="$(getp "/omneuro/blog/s3_bucket")"
export BLOG_BASE_URL="$(getp "/omneuro/blog/base_url")"
export BLOG_AWS_REGION="$(getp "/omneuro/blog/aws_region")"
export BLOG_SITEMAP_KEY="$(getp "/omneuro/blog/sitemap_key")"; [[ -z "${BLOG_SITEMAP_KEY:-}" || "${BLOG_SITEMAP_KEY}" == "None" ]] && BLOG_SITEMAP_KEY="blog/sitemap.xml"

# Sanity
[[ -z "${SHEETS_SPREADSHEET_ID:-}" || "${SHEETS_SPREADSHEET_ID}" == "None" ]] && { echo "[FATAL] /omneuro/google/sheets_spreadsheet_id missing"; exit 2; }
[[ -z "${BLOG_S3_BUCKET:-}" || "${BLOG_S3_BUCKET}" == "None" ]] && { echo "[FATAL] /omneuro/blog/s3_bucket missing"; exit 2; }
[[ -z "${BLOG_BASE_URL:-}" || "${BLOG_BASE_URL}" == "None" ]] && { echo "[FATAL] /omneuro/blog/base_url missing"; exit 2; }
[[ -z "${BLOG_AWS_REGION:-}" || "${BLOG_AWS_REGION}" == "None" ]] && BLOG_AWS_REGION="$AWS_REGION"

echo "[SSM] SHEETS_SPREADSHEET_ID=$(printf '%s' "$SHEETS_SPREADSHEET_ID" | sed -E 's/(.{4}).+(.{4})/\1…\2/')"
echo "[SSM] BLOG_S3_BUCKET=${BLOG_S3_BUCKET}"
echo "[SSM] BLOG_BASE_URL=${BLOG_BASE_URL}"
echo "[SSM] BLOG_AWS_REGION=${BLOG_AWS_REGION}"
echo "[SSM] BLOG_SITEMAP_KEY=${BLOG_SITEMAP_KEY}"

# --- Build apps ---
echo "=== [REDEPLOY] Building apps ==="
mkdir -p /home/ubuntu/build-logs
set -x
time npm --prefix apps/brain-api ci
time npm --prefix apps/brain-api run build | tee /home/ubuntu/build-logs/brain-api-tsc.log

time npm --prefix apps/tech-gateway ci
time npm --prefix apps/tech-gateway run build | tee /home/ubuntu/build-logs/tech-gateway-tsc.log
set +x

# --- Show build artifacts ---
echo "=== [REDEPLOY] Build artifacts ==="
ls -1 apps/tech-gateway/dist/{db,routes,server}.js 2>/dev/null || true
ls -1 apps/brain-api/dist/server.js 2>/dev/null || true

# --- Restart PM2 with env ---
echo "=== [REDEPLOY] Restart PM2 ==="
SHEETS_SPREADSHEET_ID="$SHEETS_SPREADSHEET_ID" \
BLOG_S3_BUCKET="$BLOG_S3_BUCKET" \
BLOG_BASE_URL="$BLOG_BASE_URL" \
BLOG_AWS_REGION="$BLOG_AWS_REGION" \
BLOG_SITEMAP_KEY="$BLOG_SITEMAP_KEY" \
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
  BLOG_S3_BUCKET: e.BLOG_S3_BUCKET||"<unset>",
  BLOG_BASE_URL: e.BLOG_BASE_URL||"<unset>",
  BLOG_AWS_REGION: e.BLOG_AWS_REGION||"<unset>",
  BLOG_SITEMAP_KEY: e.BLOG_SITEMAP_KEY||"<unset>"
});
'

# --- Sync homepage to web root ---
echo "=== [REDEPLOY] Publish homepage ==="
sudo mkdir -p /var/www/juicejunkiez.com
sudo rsync -av --delete apps/homepage/public/ /var/www/juicejunkiez.com/

# --- Copy latest blog sitemap from S3 to web root (so root domain can serve it) ---
echo "=== [REDEPLOY] Publish latest blog sitemap to web root ==="
aws s3 cp "s3://${BLOG_S3_BUCKET}/${BLOG_SITEMAP_KEY}" /tmp/blog-sitemap.xml --region "$AWS_REGION" || true
if [[ -s /tmp/blog-sitemap.xml ]]; then
  sudo cp /tmp/blog-sitemap.xml /var/www/juicejunkiez.com/blog-sitemap.xml
  sudo chown root:root /var/www/juicejunkiez.com/blog-sitemap.xml
  echo "[OK] blog-sitemap.xml updated in web root"
else
  echo "[WARN] could not fetch blog sitemap from S3"
fi

# --- Local health checks ---
echo "=== [REDEPLOY] Local health checks ==="
tries=20
until curl -fsS http://127.0.0.1:8092/healthz >/dev/null 2>&1; do
  ((tries--)) || { echo "[ERR] tech-gateway /healthz never came up"; break; }
  echo "[..] waiting on /healthz ($((20-tries))/20)"; sleep 1
done

curl -fsS http://127.0.0.1:8092/healthz >/dev/null && echo "[OK] /healthz" || echo "[ERR] /healthz"
curl -fsS http://127.0.0.1:8092/api/health >/dev/null && echo "[OK] /api/health" || echo "[ERR] /api/health"
echo "[garage] $(curl -i -s http://127.0.0.1:8092/api/garage/health | head -n 1 || true)"

# --- Public health checks (best-effort) ---
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
curl -fsS https://juicejunkiez.com/sitemap.xml >/dev/null && echo "[OK] root sitemap"
curl -fsS https://juicejunkiez.com/blog-sitemap.xml >/dev/null && echo "[OK] blog sitemap"
curl -fsS https://tech.juicejunkiez.com/api/scheduler/health | jq .
curl -fsS https://tech.juicejunkiez.com/api/tech/health | jq .

echo "=== [REDEPLOY] Tail last 80 lines (tech-gateway) ==="
pm2 logs tech-gateway --lines 80 --nostream || true

echo "=== [DONE] ==="