# brain-api (service)

Service providing conversational + job orchestration logic.  
Runs independently on port `8081`.

---

## Summary

- **Port:** `8081`
- **Runtime:** Node.js 20, ESM modules
- **Framework:** Express v5 + TypeScript
- **Build output:** `dist/server.js`

---

## Health

- `GET /healthz` → returns `{ status: "ok" }`

Health is critical for deployment:  
- Checked by `redeploy.sh`  
- Must return HTTP 200 consistently

---

## Routes

### RepairBot
- `POST /v1/repairbot/message`  
  Accepts structured message payloads, routes to repairbot pipeline.

### Jobs
- `PATCH /v1/jobs/:id/status`  
  Updates job status (pending → active → done).

---

## Build & Run

```bash
npm ci
npm run build
node dist/server.js   # local only