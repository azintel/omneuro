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

---

### 2. Redeploy Script (`redeploy.sh`)

Our canonical redeploy script is now stable and green across the board.  

Key features:

1. **Git pull latest code**
   - Always pulls fresh before redeploy.
   - Immediately runs `chmod +x` to ensure executables are runnable (prevents silent fails).

2. **Service restarts**
   - Stops old processes cleanly.
   - Starts fresh containers/services.

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