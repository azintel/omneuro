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

# --- Region / PATH (aws + pm2) ---
export AWS_REGION="us-east-2"
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"

# --- Helper: fetch SSM parameter (decrypted) ---
getp () {
  local name="$1"
  aws ssm get-parameter --name "$name" --with-decryption --region "$AWS_REGION" \
    --query "Parameter.Value" --output text 2>/dev/null || true
}

echo "=== [REDEPLOY] Fetching secrets from AWS SSM ==="
# Core IDs (required)
export SCHED_SPREADSHEET_ID="$(getp "/omneuro/google/scheduler_spreadsheet_id")"
export GOOGLE_CALENDAR_ID="$(getp "/omneuro/google/calendar_id")"
export SHEETS_SPREADSHEET_ID="$(getp "/omneuro/google/sheets_spreadsheet_id")"

# Optional keys (don't fail if missing)
export GOOGLE_API_KEY="$(getp "/omneuro/google/api_key")"
export GOOGLE_CLIENT_ID="$(getp "/omneuro/google/client_id")"
export GOOGLE_CLIENT_SECRET="$(getp "/omneuro/google/client_secret")"
export OPENAI_API_KEY="$(getp "/omneuro/openai/api_key")"

# Optional BLOG integration (never fatal)
export BLOG_S3_BUCKET="$(getp "/omneuro/blog/s3_bucket")"
export BLOG_BASE_URL="$(getp "/omneuro/blog/base_url")"
export BLOG_AWS_REGION="$(getp "/omneuro/blog/aws_region")"
export BLOG_SITEMAP_KEY="$(getp "/omneuro/blog/sitemap_key")"
[[ -z "${BLOG_AWS_REGION:-}" || "${BLOG_AWS_REGION}" == "None" ]] && BLOG_AWS_REGION="$AWS_REGION"
[[ -z "${BLOG_SITEMAP_KEY:-}" || "${BLOG_SITEMAP_KEY}" == "None" ]] && BLOG_SITEMAP_KEY="blog/sitemap.xml"

# Sanity for the one thing tech-gateway actually needs at runtime
if [[ -z "${SHEETS_SPREADSHEET_ID:-}" || "${SHEETS_SPREADSHEET_ID}" == "None" ]]; then
  echo "[FATAL] /omneuro/google/sheets_spreadsheet_id missing"; exit 2
fi

obfuscate(){ sed -E 's/(.{4}).+(.{4})/\1…\2/'; }
echo "[SSM] SHEETS_SPREADSHEET_ID=$(printf '%s' "$SHEETS_SPREADSHEET_ID" | obfuscate)"
echo "[SSM] GOOGLE_CALENDAR_ID=$(printf '%s' "${GOOGLE_CALENDAR_ID:-<unset>}" | obfuscate || true)"
echo "[SSM] SCHED_SPREADSHEET_ID=$(printf '%s' "${SCHED_SPREADSHEET_ID:-<unset>}" | obfuscate || true)"
echo "[SSM] BLOG_S3_BUCKET=${BLOG_S3_BUCKET:-<unset>}"
echo "[SSM] BLOG_BASE_URL=${BLOG_BASE_URL:-<unset>}"
echo "[SSM] BLOG_AWS_REGION=${BLOG_AWS_REGION:-<unset>}"
echo "[SSM] BLOG_SITEMAP_KEY=${BLOG_SITEMAP_KEY:-<unset>}"

# --- Build apps ---
echo "=== [REDEPLOY] Building apps (npm ci + build) ==="
mkdir -p /home/ubuntu/build-logs
set -x
time npm --prefix apps/brain-api ci
time npm --prefix apps/brain-api run build | tee /home/ubuntu/build-logs/brain-api-tsc.log

time npm --prefix apps/tech-gateway ci
time npm --prefix apps/tech-gateway run build | tee /home/ubuntu/build-logs/tech-gateway-tsc.log
set +x

# --- Build artifacts sanity ---
echo "=== [REDEPLOY] Build artifacts ==="
ls -1 apps/tech-gateway/dist/{db,routes,server}.js 2>/dev/null || true
ls -1 apps/brain-api/dist/server.js 2>/dev/null || true

# --- Restart PM2 with updated env for tech-gateway first (it hosts healthz) ---
echo "=== [REDEPLOY] Restart PM2 ==="
SHEETS_SPREADSHEET_ID="$SHEETS_SPREADSHEET_ID" \
GOOGLE_CALENDAR_ID="${GOOGLE_CALENDAR_ID:-}" \
SCHED_SPREADSHEET_ID="${SCHED_SPREADSHEET_ID:-}" \
BLOG_S3_BUCKET="${BLOG_S3_BUCKET:-}" \
BLOG_BASE_URL="${BLOG_BASE_URL:-}" \
BLOG_AWS_REGION="${BLOG_AWS_REGION:-}" \
BLOG_SITEMAP_KEY="${BLOG_SITEMAP_KEY:-}" \
pm2 startOrReload ecosystem.config.cjs --only tech-gateway --update-env

pm2 startOrReload ecosystem.config.cjs --only brain-api --update-env
pm2 save

echo "=== [REDEPLOY] PM2 env check (tech-gateway) ==="
pm2 jlist | node -e '
const a=JSON.parse(require("fs").readFileSync(0,"utf8"));
const p=a.find(x=>x.name==="tech-gateway")||{};
const e=p.pm2_env?.env||{};
console.log({
  SHEETS_SPREADSHEET_ID: e.SHEETS_SPREADSHEET_ID || "<unset>",
  GOOGLE_CALENDAR_ID:   e.GOOGLE_CALENDAR_ID   || "<unset>",
  SCHED_SPREADSHEET_ID: e.SCHED_SPREADSHEET_ID || "<unset>",
  BLOG_S3_BUCKET:       e.BLOG_S3_BUCKET       || "<unset>",
  BLOG_BASE_URL:        e.BLOG_BASE_URL        || "<unset>",
  BLOG_AWS_REGION:      e.BLOG_AWS_REGION      || "<unset>",
  BLOG_SITEMAP_KEY:     e.BLOG_SITEMAP_KEY     || "<unset>"
});
'

# --- Publish homepage (root domain) ---
echo "=== [REDEPLOY] Publish homepage ==="
sudo mkdir -p /var/www/juicejunkiez.com
sudo rsync -av --delete apps/homepage/public/ /var/www/juicejunkiez.com/

# --- (Optional) publish latest blog sitemap to web root; never fatal ---
echo "=== [REDEPLOY] Publish blog sitemap (best-effort) ==="
if [[ -n "${BLOG_S3_BUCKET:-}" && "${BLOG_S3_BUCKET}" != "None" ]]; then
  aws s3 cp "s3://${BLOG_S3_BUCKET}/${BLOG_SITEMAP_KEY}" /tmp/blog-sitemap.xml --region "$BLOG_AWS_REGION" || true
  if [[ -s /tmp/blog-sitemap.xml ]]; then
    sudo cp /tmp/blog-sitemap.xml /var/www/juicejunkiez.com/blog-sitemap.xml
    sudo chown root:root /var/www/juicejunkiez.com/blog-sitemap.xml
    echo "[OK] blog-sitemap.xml updated in web root"
  else
    echo "[WARN] could not fetch blog sitemap from S3"
  fi
else
  echo "[INFO] BLOG_S3_BUCKET unset; skipping blog sitemap publish"
fi

# --- Local health checks (wait up to 40s) ---
echo "=== [REDEPLOY] Local health checks ==="
tries=40
until curl -fsS http://127.0.0.1:8092/healthz >/dev/null 2>&1; do
  ((tries--)) || { echo "[ERR] tech-gateway /healthz never came up"; break; }
  echo "[..] waiting on /healthz ($((40-tries))/40)"; sleep 1
done

curl -fsS http://127.0.0.1:8092/healthz      >/dev/null && echo "[OK] /healthz"      || echo "[ERR] /healthz"
curl -fsS http://127.0.0.1:8092/api/health   >/dev/null && echo "[OK] /api/health"   || echo "[ERR] /api/health"
curl -fsS http://127.0.0.1:8092/api/tech/health >/dev/null && echo "[OK] /api/tech/health" || echo "[ERR] /api/tech/health"
curl -isS  http://127.0.0.1:8092/api/garage/health | head -n1 || true
curl -isS  http://127.0.0.1:8092/api/scheduler/health | head -n1 || true

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
curl -fsS https://juicejunkiez.com/sitemap.xml       >/dev/null && echo "[OK] root sitemap" || echo "[WARN] root sitemap"
curl -fsS https://juicejunkiez.com/blog-sitemap.xml  >/dev/null && echo "[OK] blog sitemap" || echo "[INFO] blog sitemap not present"
curl -fsS https://tech.juicejunkiez.com/api/scheduler/health | jq . || true
curl -fsS https://tech.juicejunkiez.com/api/tech/health | jq . || true

echo "=== [REDEPLOY] Tail last 100 lines (tech-gateway) ==="
pm2 logs tech-gateway --lines 100 --nostream || true

echo "=== [DONE] ==="