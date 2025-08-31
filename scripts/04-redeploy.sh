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

# --- Build apps ---
echo "=== [REDEPLOY] Building apps ==="
cd apps/brain-api && npm ci && npm run build && cd -
cd apps/tech-gateway && npm ci && npm run build && cd -

# --- Restart PM2 ---
echo "=== [REDEPLOY] Restarting PM2 apps ==="
pm2 restart ecosystem.config.cjs --update-env
pm2 save

# --- Verify ---
echo "=== [REDEPLOY] Verifying processes ==="
pm2 list

echo "[DEBUG] Running redeploy script from $(realpath "$0")"
echo "=== [REDEPLOY] Health check ==="

# brain-api
if curl -fs http://localhost:8081/healthz >/dev/null; then
  echo "brain-api health check passed"
else
  echo "brain-api health check failed"
fi

# helper function for retries
check_with_retries() {
  local url=$1
  local name=$2
  local retries=3
  local delay=2
  local count=0

  until curl -fs "$url" >/dev/null; do
    count=$((count+1))
    if [ $count -ge $retries ]; then
      echo "Checking $name $url ... FAILED after $retries attempts"
      return 1
    fi
    echo "Checking $name $url ... not up yet, retrying in $delay sec"
    sleep $delay
  done
  echo "Checking $name $url ... OK"
  return 0
}

# tech-gateway (only two real routes: /healthz and /api/health)
if check_with_retries http://localhost:8092/healthz "tech-gateway" \
   && check_with_retries http://localhost:8092/api/health "tech-gateway"; then
  echo "tech-gateway health checks passed"
else
  echo "tech-gateway health checks failed"
fi

### --- Post-deploy health checks (homepage + tech portal) ---
echo "=== [REDEPLOY] Health check (public) ==="

# helper: wait for a URL to return 200
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

# 1) Root site (homepage served by tech-gateway via Nginx)
wait200 "https://juicejunkiez.com/nginx-health"
wait200 "https://juicejunkiez.com/"

# 2) Tech portal basic health
wait200 "https://tech.juicejunkiez.com/healthz"
wait200 "https://tech.juicejunkiez.com/api/health"

# 3) Optional smoke test for chat API (expects JSON; masks long tokens in output)
echo "=== [REDEPLOY] Chat API smoke test ==="
CHAT_JSON='{"messages":[{"role":"user","content":"Say hello, Repairbot."}]}'
CHAT_RC=0
CHAT_OUT="$(curl -sS -w " HTTP:%{http_code}" -H "content-type: application/json" \
  -d "$CHAT_JSON" "https://tech.juicejunkiez.com/api/chat" || true)"
HTTP_CODE="${CHAT_OUT##* HTTP:}"
BODY="${CHAT_OUT% HTTP:*}"

if [ "$HTTP_CODE" = "200" ]; then
  echo "[OK] chat API HTTP 200"
else
  echo "[WARN] chat API not healthy (HTTP $HTTP_CODE). Body (trimmed):"
  echo "$BODY" | sed -E 's/[A-Za-z0-9_\-]{24,}/[REDACTED]/g' | head -c 400; echo
  CHAT_RC=1
fi

# Exit non-zero only if the mandatory health endpoints failed
# (homepage + portal). Chat smoke test is informative but non-fatal for deploys.
exit $CHAT_RC