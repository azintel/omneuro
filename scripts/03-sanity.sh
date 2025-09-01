set -euo pipefail

PORT_BRAIN="${PORT_BRAIN:-8081}"
PORT_GATE="${PORT_GATE:-8092}"
BRAIN_URL="http://localhost:${PORT_BRAIN}"

echo "== restart with PM2 =="
cd "$(git rev-parse --show-toplevel)"

cd apps/brain-api
PORT="$PORT_BRAIN" pm2 restart dist/server.js --name brain-api --update-env \
  || PORT="$PORT_BRAIN" pm2 start dist/server.js --name brain-api --update-env
pm2 save

cd ../tech-gateway
PORT="$PORT_GATE" BRAIN_API_URL="$BRAIN_URL" pm2 restart dist/server.js --name tech-gateway --update-env \
  || PORT="$PORT_GATE" BRAIN_API_URL="$BRAIN_URL" pm2 start dist/server.js --name tech-gateway --update-env
pm2 save

pm2 status