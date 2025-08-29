# deploy-ops.md

## Omneuro Deployment Operations Guide

This file documents how we redeploy services cleanly and reliably.  
Everything here was written in blood, sweat, and failed `curl` checks.

---

### 1. Principles

- **Zero-click deploys.** Scripts should handle everything with minimal human intervention.  
- **Health-first.** If health checks fail, deploy halts.  
- **Self-healing.** Scripts add retries and permissions fixes automatically.  
- **Consistency.** Every deploy follows the same steps across services.  
- **Correct user + path.** All commands must be run as `ubuntu` using `sudo -u ubuntu -- bash -lc '…'` in SSM.  
- **Canonical repo directory:** `/home/ubuntu/omneuro`.

---

### 2. Redeploy Script (`04-redeploy.sh`)

Key features:

1. **Git pull latest code**  
   - Always pulls fresh before redeploy.  
   - Immediately runs `chmod +x` to ensure executables are runnable (prevents silent fails).  

2. **Service restarts**  
   - Stops old processes cleanly.  
   - Starts fresh services (PM2/system).  

3. **Health checks**  
   - Retries up to 5 times with backoff.  
   - Only two tech-gateway routes tested:  
     - `/api/tech/health` ✅  
     - `/healthz` ✅  
   - No phantom endpoints tested.  

4. **Fail early**  
   - If any check fails after retries, script exits non-zero.  
   - Protects us from deploying silently broken code.  

---

### 3. Health Check Standards

- **brain-api** → `http://localhost:8081/healthz`  
- **tech-gateway** → `http://localhost:8092/healthz` and `http://localhost:8092/api/tech/health`  
- **curl with retries**:
  ```bash
  for i in {1..5}; do
    if curl -fsS "$url"; then
      echo "OK"; break
    else
      echo "Retry $i failed, sleeping..."
      sleep 2
    fi
  done
  ```

---

### 4. SSM Workflow (from workstation)

```bash
aws ssm start-session --region us-east-2 --target i-011c79fffa7af9e27
```

Then inside SSM, redeploy as ubuntu:

```bash
sudo -u ubuntu -- bash -lc '
set -euo pipefail
cd /home/ubuntu/omneuro
git fetch --all
git checkout main
git pull --ff-only
chmod +x scripts/*.sh
./scripts/04-redeploy.sh
curl -fsS http://127.0.0.1:8081/healthz
curl -fsS http://127.0.0.1:8092/healthz
curl -fsS https://tech.juicejunkiez.com/healthz
curl -fsS https://tech.juicejunkiez.com/api/tech/health
'
```

---

### 5. Handling Unstaged Changes

**Inspect:**
```bash
sudo -u ubuntu -- bash -lc '
cd /home/ubuntu/omneuro
git status -s
git --no-pager diff --name-only
'
```

**Stash then redeploy:**
```bash
sudo -u ubuntu -- bash -lc '
cd /home/ubuntu/omneuro
git stash push -m "server-pre-redeploy-$(date +%F_%H%M)"
git fetch --all
git pull --ff-only
chmod +x scripts/*.sh
./scripts/04-redeploy.sh
'
```

**Hard reset then redeploy:**
```bash
sudo -u ubuntu -- bash -lc '
cd /home/ubuntu/omneuro
mkdir -p "/home/ubuntu/_backup_scripts_$(date +%F_%H%M)" && cp scripts/*.sh "/home/ubuntu/_backup_scripts_$(date +%F_%H%M)/" || true
git fetch origin main
git reset --hard origin/main
chmod +x scripts/*.sh
./scripts/04-redeploy.sh
'
```

---

### 6. Cross-References

- `OPS.md` → environment overview, repo path, user discipline  
- `CHECKLISTS.md` → pre-/post-deploy steps  
- `RUNBOOK.md` → failure recovery playbooks  
- `OBSERVABILITY.md` → logs/metrics standards  