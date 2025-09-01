# tech-gateway

## Purpose
`tech-gateway` is the public-facing Node.js/Express service that fronts Omneuro’s repair operations.  
It serves three main roles:
- **Tech Portal** – password-protected interface at [https://tech.juicejunkiez.com](https://tech.juicejunkiez.com) for internal use.  
- **Repairbot Chat API** – `/api/chat` endpoint that brokers calls to OpenAI with keys securely fetched from AWS SSM.  
- **Static Homepage Proxy** – traffic to [https://juicejunkiez.com](https://juicejunkiez.com) is handled by Nginx as a static site, separate from the Node runtime.

## Architecture
- **Express app** under `apps/tech-gateway/src/server.ts`
  - Serves `/api/chat` via `routes/chat.ts`
  - Mounts `techRouter` under `/api/tech`
  - Provides `/healthz` and `/api/health` endpoints
  - Static assets under `apps/tech-gateway/src/public`
- **Secrets** resolved via `src/lib/ssm.ts`
  - Reads `/omneuro/openai/api_key` from AWS SSM
  - Region pinned to `us-east-2`
  - Cached in-memory for efficiency
- **PM2** manages processes (`ecosystem.config.cjs`)
  - `tech-gateway` bound to port `8092`
  - `BRAIN_API_URL` set to `http://localhost:8081`
  - Env vars injected at reload (`--update-env`)
- **Nginx** handles TLS + routing
  - `tech.juicejunkiez.com` → proxied to Node `8092`
  - `juicejunkiez.com` → static HTML from `/var/www/juicejunkiez.com`
  - Certbot manages SSL certificates
- **Deploy scripts**
  - `scripts/04-redeploy.sh` resets perms, pulls latest, builds, and restarts PM2
  - Always runs as `ubuntu` with `sudo`

## Health Checks
- Local: `curl http://127.0.0.1:8092/healthz`
- Public (proxied):  
  - `curl https://tech.juicejunkiez.com/healthz`  
  - `curl https://juicejunkiez.com/nginx-health`  

Both must return `200 OK` before deploy is considered healthy.

## Rules
- Never store secrets in repo; always SSM.  
- Always `chmod +x scripts/*.sh` after git reset.  
- All ops commands run as `ubuntu` with `sudo`.  
- No overlapping server_name blocks in Nginx (conflicts cause 404/redirect loops).  
- Homepage is static, tech portal is Node; do not conflate.  

## Cross-References
- [OPS.md](../ops/OPS.md) – global ops patterns  
- [RULES.md](../ops/RULES.md) – non-negotiable dev rules  
- [secrets.md](../ops/secrets.md) – SSM parameter paths  
- [roadmap.md](../ROADMAP.md) – feature milestones (Homepage, Garage, Shop)  