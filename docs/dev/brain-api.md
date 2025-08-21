```md
# brain-api (service)

- Port: `8081`
- ESM, Express v5, TypeScript build → `dist/server.js`
- Health: `GET /healthz`
- Tech routes: 
  - `POST /v1/repairbot/message`
  - `PATCH /v1/jobs/:id/status`

## Build
```bash
npm ci
npm run build
node dist/server.js  # local only