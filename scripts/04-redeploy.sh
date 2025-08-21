#!/bin/bash
set -euo pipefail

echo "=== [REDEPLOY] Full cycle ==="
cd /home/ubuntu/omneuro

# --- Sync repo ---
echo "=== [REDEPLOY] Git sync ==="
git fetch --all
git reset --hard origin/main

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


echo "=== [REDEPLOY] Health check ==="
if curl -fs http://localhost:8081/healthz >/dev/null; then
  echo "brain-api health check passed"
else
  echo "brain-api health check failed"
fi

if curl -fs http://localhost:8092/healthz >/dev/null \
   && curl -fs http://localhost:8092/api/health >/dev/null \
   && curl -fs http://localhost:8092/api/tech/health >/dev/null; then
  echo "tech-gateway health checks passed"
else
  echo "tech-gateway health checks failed"
fi