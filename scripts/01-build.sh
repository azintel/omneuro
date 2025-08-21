set -euo pipefail

echo "== who/where =="; whoami; hostname; date -Is

REPO="$(pwd)"
echo "== git rev =="
git -C "$REPO" rev-parse --short HEAD

echo "== build brain-api =="
cd "$REPO/apps/brain-api"
rm -rf node_modules dist package-lock.json
npm i --silent
npm run build
ls -l dist/server.js

echo "== build tech-gateway =="
cd "$REPO/apps/tech-gateway"
rm -rf node_modules dist package-lock.json
npm i --silent
npm run build
ls -l dist/server.js

echo "== DONE build =="