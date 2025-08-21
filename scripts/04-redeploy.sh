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

check_service() {
  local name=$1
  local url=$2
  echo -n "Checking $name $url ... "
  if curl -4 -fsS --max-time 5 "$url" >/dev/null; then
    echo "OK"
  else
    echo "FAILED"
  fi
}

# brain-api
check_service "brain-api" "http://localhost:8081/healthz"

# tech-gateway
check_service "tech-gateway" "http://localhost:8092/healthz"
check_service "tech-gateway" "http://localhost:8092/api/health"
check_service "tech-gateway" "http://localhost:8092/api/tech/health"