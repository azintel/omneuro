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