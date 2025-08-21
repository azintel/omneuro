omneuro/docs/dev/tech-gateway.md
```md
# tech-gateway (service)

- Port: `8092`
- Env: `BRAIN_API_URL=http://localhost:8081`
- Health proxy: `GET /api/tech/health` (responds `{ok:true}`)
- Forwards:
  - `POST /api/tech/message` → brain-api `/v1/repairbot/message`
  - `PATCH /api/tech/jobs/:id/status` → brain-api `/v1/jobs/:id/status`

## Build
```bash
npm ci
npm run build
node dist/server.js  # local only