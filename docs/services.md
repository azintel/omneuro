# SERVICES.md

## Services

### tech-gateway
- **Port:** `8092`
- **Health:** `GET /healthz`, `GET /api/tech/health`
- **Fronted by Nginx:** `https://tech.juicejunkiez.com`
- **Notes:** runs under PM2 (see PM2 section)

### brain-api
- **Port:** `8081`
- **Health:** `GET /healthz`
- **Access:** internal only (proxied by tech-gateway for app flows)

---

## PM2

We observed PM2 HOME as `/etc/.pm2` (root context).  
For consistency, we will standardize to **ubuntu** in a future maintenance window:

**Target state:**
- PM2 HOME: `/home/ubuntu/.pm2`
- Owner: `ubuntu:ubuntu`
- Processes started via SSM/PM2 as `ubuntu` with `HOME=/home/ubuntu`.

### Discovery helpers
```bash
PM2_HOME=/etc/.pm2 pm2 jlist
PM2_HOME=/home/ubuntu/.pm2 pm2 jlist