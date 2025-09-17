# scripts/04-redeploy.sh
#!/bin/bash
set -euo pipefail

echo "=== [REDEPLOY] Full cycle ==="
cd /home/ubuntu/omneuro

echo "=== [REDEPLOY] Git sync ==="
git fetch --all
git reset --hard origin/main

# Ensure scripts are executable
chmod +x /home/ubuntu/omneuro/scripts/*.sh || true

# --- AWS Region ---
export AWS_REGION="us-east-2"

# --- Helper: get SSM param (with decryption) ---
getp() {
  local name="$1"
  aws ssm get-parameter --name "$name" --with-decryption --region "$AWS_REGION" \
    --query "Parameter.Value" --output text 2>/dev/null || true
}

mask(){ sed -E 's/(.{4}).+(.{4})/\1…\2/'; }

echo "=== [REDEPLOY] Fetching secrets from AWS SSM ==="
# Core IDs
export SHEETS_SPREADSHEET_ID="$(getp "/omneuro/google/sheets_spreadsheet_id")"
export GOOGLE_CALENDAR_ID="$(getp "/omneuro/google/calendar_id")"
export SCHED_SPREADSHEET_ID="$(getp "/omneuro/google/scheduler_spreadsheet_id")"

# Blog
export BLOG_S3_BUCKET="$(getp "/omneuro/blog/s3_bucket")"
export BLOG_BASE_URL="$(getp "/omneuro/blog/base_url")"
export BLOG_AWS_REGION="$(getp "/omneuro/blog/aws_region")"
export BLOG_SITEMAP_KEY="$(getp "/omneuro/blog/sitemap_key")"
export PUBLIC_BLOG_BASE_URL="$(getp "/omneuro/blog/public_blog_base_url")"
export BLOG_PREFIX="$(getp "/omneuro/blog/prefix")"

# Mailer
export MAIL_TRANSPORT="$(getp "/omneuro/mail/transport")"
export MAIL_FROM="$(getp "/omneuro/mail/from")"
export MAIL_SES_REGION="$(getp "/omneuro/mail/ses/region")"
export SMTP_HOST="$(getp "/omneuro/mail/smtp/host")"
export SMTP_PORT="$(getp "/omneuro/mail/smtp/port")"
export SMTP_SECURE="$(getp "/omneuro/mail/smtp/secure")"
export SMTP_USER="$(getp "/omneuro/mail/smtp/user")"
export SMTP_PASS="$(getp "/omneuro/mail/smtp/pass")"

# Tech Portal base
export PUBLIC_TECH_BASE_URL="$(getp "/omneuro/tech/public_base_url")"

# === NEW: Google Places API key ===
export GOOGLE_PLACES_API_KEY="$(getp "/omneuro/tech-gateway/GOOGLE_PLACES_API_KEY")"

# Normalize defaults
[[ -z "${BLOG_SITEMAP_KEY:-}" || "${BLOG_SITEMAP_KEY}" == "None" ]] && BLOG_SITEMAP_KEY="blog/sitemap.xml"
[[ -z "${BLOG_AWS_REGION:-}" || "${BLOG_AWS_REGION}" == "None" ]] && BLOG_AWS_REGION="$AWS_REGION"
[[ -z "${BLOG_BASE_URL:-}"   || "${BLOG_BASE_URL}"   == "None" ]] && BLOG_BASE_URL="https://juicejunkiez.com"
[[ -z "${PUBLIC_BLOG_BASE_URL:-}" || "${PUBLIC_BLOG_BASE_URL}" == "None" ]] && PUBLIC_BLOG_BASE_URL="${BLOG_BASE_URL}"
[[ -z "${BLOG_PREFIX:-}"     || "${BLOG_PREFIX}"     == "None" ]] && BLOG_PREFIX="blog"
[[ -z "${MAIL_TRANSPORT:-}"  || "${MAIL_TRANSPORT}"  == "None" ]] && MAIL_TRANSPORT="ses"
[[ -z "${MAIL_SES_REGION:-}" || "${MAIL_SES_REGION}" == "None" ]] && MAIL_SES_REGION="$AWS_REGION"
[[ -z "${PUBLIC_TECH_BASE_URL:-}" || "${PUBLIC_TECH_BASE_URL}" == "None" ]] && PUBLIC_TECH_BASE_URL="https://tech.juicejunkiez.com"

# Log what we pulled (masked where appropriate)
printf "[SSM] SHEETS_SPREADSHEET_ID=%s\n" "$(printf '%s' "${SHEETS_SPREADSHEET_ID:-<none>}" | mask)"
printf "[SSM] GOOGLE_CALENDAR_ID=%s\n"     "$(printf '%s' "${GOOGLE_CALENDAR_ID:-<none>}" | mask)"
printf "[SSM] SCHED_SPREADSHEET_ID=%s\n"   "$(printf '%s' "${SCHED_SPREADSHEET_ID:-<none>}" | mask)"
echo   "[SSM] BLOG_S3_BUCKET=${BLOG_S3_BUCKET:-<none>}"
echo   "[SSM] BLOG_BASE_URL=${BLOG_BASE_URL:-<none>}"
echo   "[SSM] PUBLIC_BLOG_BASE_URL=${PUBLIC_BLOG_BASE_URL:-<none>}"
echo   "[SSM] BLOG_PREFIX=${BLOG_PREFIX:-<none>}"
echo   "[SSM] BLOG_AWS_REGION=${BLOG_AWS_REGION:-<none>}"
echo   "[SSM] BLOG_SITEMAP_KEY=${BLOG_SITEMAP_KEY:-<none>}"
echo   "[SSM] MAIL_TRANSPORT=${MAIL_TRANSPORT:-<none>}"
echo   "[SSM] MAIL_FROM=${MAIL_FROM:-<none>}"
echo   "[SSM] MAIL_SES_REGION=${MAIL_SES_REGION:-<none>}"
echo   "[SSM] SMTP_HOST=${SMTP_HOST:-<none>}"
echo   "[SSM] SMTP_PORT=${SMTP_PORT:-<none>}"
echo   "[SSM] SMTP_SECURE=${SMTP_SECURE:-<none>}"
echo   "[SSM] SMTP_USER=${SMTP_USER:-<none>}"
echo   "[SSM] SMTP_PASS=$( [[ -n "${SMTP_PASS:-}" ]] && echo '********' || echo '<none>' )"
echo   "[SSM] PUBLIC_TECH_BASE_URL=${PUBLIC_TECH_BASE_URL:-<none>}"
echo   "[SSM] GOOGLE_PLACES_API_KEY=$( [[ -n "${GOOGLE_PLACES_API_KEY:-}" && "${GOOGLE_PLACES_API_KEY}" != "None" ]] && echo '****…' || echo '<none>' )"

echo "=== [REDEPLOY] Building apps (npm ci + build) ==="
mkdir -p /home/ubuntu/build-logs
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
SHEETS_SPREADSHEET_ID="${SHEETS_SPREADSHEET_ID:-}" \
GOOGLE_CALENDAR_ID="${GOOGLE_CALENDAR_ID:-}" \
SCHED_SPREADSHEET_ID="${SCHED_SPREADSHEET_ID:-}" \
BLOG_S3_BUCKET="${BLOG_S3_BUCKET:-}" \
BLOG_BASE_URL="${BLOG_BASE_URL:-}" \
PUBLIC_BLOG_BASE_URL="${PUBLIC_BLOG_BASE_URL:-${BLOG_BASE_URL:-https://juicejunkiez.com}}" \
BLOG_AWS_REGION="${BLOG_AWS_REGION:-$AWS_REGION}" \
BLOG_SITEMAP_KEY="${BLOG_SITEMAP_KEY:-blog/sitemap.xml}" \
BLOG_PREFIX="${BLOG_PREFIX:-blog}" \
MAIL_TRANSPORT="${MAIL_TRANSPORT:-ses}" \
MAIL_FROM="${MAIL_FROM:-Juice Junkiez <notifications@juicejunkiez.com>}" \
MAIL_SES_REGION="${MAIL_SES_REGION:-$AWS_REGION}" \
SMTP_HOST="${SMTP_HOST:-}" \
SMTP_PORT="${SMTP_PORT:-}" \
SMTP_SECURE="${SMTP_SECURE:-}" \
SMTP_USER="${SMTP_USER:-}" \
SMTP_PASS="${SMTP_PASS:-}" \
PUBLIC_TECH_BASE_URL="${PUBLIC_TECH_BASE_URL:-https://tech.juicejunkiez.com}" \
GOOGLE_PLACES_API_KEY="${GOOGLE_PLACES_API_KEY:-}" \
pm2 startOrReload ecosystem.config.cjs --only tech-gateway --update-env

pm2 startOrReload ecosystem.config.cjs --only brain-api --update-env
pm2 save

echo "=== [REDEPLOY] PM2 env check (tech-gateway) ==="
pm2 jlist | node -e '
const a=JSON.parse(require("fs").readFileSync(0,"utf8"));
const p=a.find(x=>x.name==="tech-gateway")||{};
const e=p.pm2_env?.env||{};
function mask(v){ if(!v||v=="<unset>") return "<unset>"; return (v+"").slice(0,4)+"…"; }
console.log({
  SHEETS_SPREADSHEET_ID: e.SHEETS_SPREADSHEET_ID||"<unset>",
  GOOGLE_CALENDAR_ID: e.GOOGLE_CALENDAR_ID||"<unset>",
  SCHED_SPREADSHEET_ID: e.SCHED_SPREADSHEET_ID||"<unset>",
  BLOG_S3_BUCKET: e.BLOG_S3_BUCKET||"<unset>",
  BLOG_BASE_URL: e.BLOG_BASE_URL||"<unset>",
  PUBLIC_BLOG_BASE_URL: e.PUBLIC_BLOG_BASE_URL||"<unset>",
  BLOG_PREFIX: e.BLOG_PREFIX||"<unset>",
  BLOG_AWS_REGION: e.BLOG_AWS_REGION||"<unset>",
  BLOG_SITEMAP_KEY: e.BLOG_SITEMAP_KEY||"<unset>",
  MAIL_TRANSPORT: e.MAIL_TRANSPORT||"<unset>",
  MAIL_FROM: e.MAIL_FROM||"<unset>",
  MAIL_SES_REGION: e.MAIL_SES_REGION||"<unset>",
  SMTP_HOST: e.SMTP_HOST||"<unset>",
  SMTP_USER: e.SMTP_USER||"<unset>",
  PUBLIC_TECH_BASE_URL: e.PUBLIC_TECH_BASE_URL||"<unset>",
  GOOGLE_PLACES_API_KEY: mask(e.GOOGLE_PLACES_API_KEY||"<unset>")
});
'

echo "=== [REDEPLOY] Publish homepage ==="
sudo mkdir -p /var/www/juicejunkiez.com
# Do not wipe blog content or sitemap
sudo rsync -av --delete \
  --exclude 'blog' \
  --exclude 'blog-sitemap.xml' \
  apps/homepage/public/ /var/www/juicejunkiez.com/

echo "=== [REDEPLOY] Publish blog sitemap (best-effort) ==="
aws s3 cp "s3://${BLOG_S3_BUCKET}/${BLOG_SITEMAP_KEY}" /tmp/blog-sitemap.xml --region "${BLOG_AWS_REGION}" || true
if [[ -s /tmp/blog-sitemap.xml ]]; then
  sudo cp /tmp/blog-sitemap.xml /var/www/juicejunkiez.com/blog-sitemap.xml
  sudo chown root:root /var/www/juicejunkiez.com/blog-sitemap.xml
  echo "[OK] blog-sitemap.xml updated in web root"
else
  echo "[WARN] could not fetch blog sitemap from S3"
fi

echo "=== [REDEPLOY] Sync blog content to web root ==="
sudo mkdir -p /var/www/juicejunkiez.com/blog
sudo aws s3 sync "s3://${BLOG_S3_BUCKET}/blog" /var/www/juicejunkiez.com/blog \
  --region "${BLOG_AWS_REGION}" --delete --exclude "sitemap.xml" || true
sudo chown -R root:root /var/www/juicejunkiez.com/blog || true
sudo find /var/www/juicejunkiez.com/blog -type d -exec chmod 755 {} \; || true
sudo find /var/www/juicejunkiez.com/blog -type f -exec chmod 644 {} \; || true

echo "=== [REDEPLOY] Install/enable blog sync timer (systemd) ==="
if [[ -f ops/systemd/omneuro-blog-sync.service && -f ops/systemd/omneuro-blog-sync.timer ]]; then
  sudo install -m 0644 ops/systemd/omneuro-blog-sync.service /etc/systemd/system/omneuro-blog-sync.service
  sudo install -m 0644 ops/systemd/omneuro-blog-sync.timer   /etc/systemd/system/omneuro-blog-sync.timer
  sudo systemctl daemon-reload
  sudo systemctl unmask omneuro-blog-sync.timer || true
  sudo systemctl unmask omneuro-blog-sync.service || true
  sudo systemctl enable --now omneuro-blog-sync.timer
  sudo systemctl start omneuro-blog-sync.service || true
  echo "[OK] systemd blog sync timer enabled"
else
  echo "[WARN] systemd unit files not found in repo; skipping timer install"
fi

echo "=== [REDEPLOY] Local health checks ==="
tries=40
until curl -fsS http://127.0.0.1:8092/healthz >/dev/null 2>&1; do
  ((tries--)) || { echo "[ERR] tech-gateway /healthz never came up"; break; }
  echo "[..] waiting on /healthz ($((40-tries))/40)"; sleep 1
done

if curl -fsS http://127.0.0.1:8092/healthz >/dev/null; then
  echo "[OK] /healthz"
else
  echo "[ERR] /healthz"
fi

if curl -fsS http://127.0.0.1:8092/api/health >/dev/null; then
  echo "[OK] /api/health"
else
  echo "[ERR] /api/health"
fi

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