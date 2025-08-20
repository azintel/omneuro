# Omneuro Runbook

## Golden checks
- Gateway up: `curl -sS http://localhost:8092/healthz`
- Gateway API: `curl -sS http://localhost:8092/api/tech/health`
- Brain up: `curl -sS http://localhost:8081/healthz`
- PM2: `pm2 status` / `pm2 logs <app> --lines 120`

## Deploy (single service)
1) `git pull --ff-only`
2) `cd apps/tech-gateway && npm ci && npm run build`
3) `PORT=8092 BRAIN_API_URL=http://localhost:8081 pm2 start dist/server.js --name tech-gateway --update-env || pm2 restart tech-gateway --update-env`
4) `pm2 save`
5) Verify:
   - `curl -fsS http://localhost:8092/healthz && echo OK`
   - `curl -fsS http://localhost:8092/api/tech/health && echo OK`

## Rollback
- `pm2 restart tech-gateway --update-env --time`
- `git checkout <last-good-sha> && npm run build && pm2 restart tech-gateway --update-env && pm2 save`

## Logs (CloudWatch)
Set: REGION=us-east-2
IID=
aws logs get-log-events –region “$REGION” –log-group-name “/omneuro/tech-gateway” –log-stream-name “$IID/out” –limit 50
aws logs get-log-events –region “$REGION” –log-group-name “/omneuro/tech-gateway” –log-stream-name “$IID/err” –limit 50

## Common fixes
- ESM import error: ensure compiled imports include `.js` (e.g. `import x from "./routes/tech.js"`).
- JSON body parser: use `app.use(express.json({ limit: "5mb" }))` (no `require` in ESM).
- Port not listening: `pm2 logs tech-gateway` and `ss -ltnp | grep 8092`.

## Daily ops
- `pm2 status`
- `pm2 logs tech-gateway --lines 200`
- `curl -sS http://localhost:8092/admin/diag?key=$DIAG_KEY`