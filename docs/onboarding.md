# Omneuro Developer Onboarding

Welcome to the **Omneuro Project**.  
This document gets you from **zero → building → deploying → testing** in about 10 minutes.  

---

## 1. Clone & Setup

git clone https://github.com/azintel/omneuro.git  
cd omneuro  

We use Node.js + npm. Install dependencies per service when working locally:

cd apps/brain-api && npm i  
cd ../tech-gateway && npm i  

> 🔑 Always `npm i` after pulling code changes.  

---

## 2. Scripts Overview

All automation lives in `scripts/deploy/`:

- **01-build.sh** → cleans, installs, builds both services.  
- **02-restart.sh** → restarts services under `pm2`.  
- **03-sanity.sh** → runs health checks to verify system is alive.  

Usage (from repo root):

./scripts/deploy/01-build.sh  
./scripts/deploy/02-restart.sh  
./scripts/deploy/03-sanity.sh  

---

## 3. Services Overview

### brain-api
- Express API for backend logic.  
- Runs on **port 8081** under `pm2`.  
- Health check: `GET http://localhost:8081/healthz`.

### tech-gateway
- Gateway/proxy layer.  
- Runs on **port 8092** under `pm2`.  
- Health check: `GET http://localhost:8092/api/tech/health`.

Both services are restarted and wired together by the deploy scripts.  

---

## 4. Deployment Flow

1. Pull latest code  
   git pull origin main  

2. Build  
   ./scripts/deploy/01-build.sh  

3. Restart services  
   ./scripts/deploy/02-restart.sh  

4. Verify  
   ./scripts/deploy/03-sanity.sh  

If all checks pass → you’re good.  

---

## 5. Logs & Debugging

View logs with:  
pm2 logs brain-api  
pm2 logs tech-gateway  

Stop/start services individually:  
pm2 restart brain-api  
pm2 restart tech-gateway  

---

## 6. Development Rules

- ✅ Always stage, commit, and push (`git add . && git commit -m "..." && git push`).  
- ✅ Always update docs when you update code.  
- ✅ Always run sanity checks after deploy.  
- ❌ Never use `~` in scripts or paths — use `$HOME`.  
- ❌ Never hack around logs — always use `pm2 logs` or structured logging.  

See `docs/rules.md` for the full list.  

---

## 7. First Run Quickstart

./scripts/deploy/01-build.sh  
./scripts/deploy/02-restart.sh  
./scripts/deploy/03-sanity.sh  

Expected output:  
- Brain API responds to `/healthz`.  
- Gateway responds to `/api/tech/health`.  
- Messages flow end-to-end via `/api/tech/message`.  

---

## 8. Next Steps

- Add features in `apps/brain-api` or `apps/tech-gateway`.  
- Update tests, docs, and scripts if needed.  
- Commit and push regularly.  

---

✨ Congratulations — you’re now a co-developer. 🚀