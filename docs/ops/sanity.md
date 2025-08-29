# sanity.md

## Omneuro Sanity Checklist

This file exists to keep us from thrashing.  
Before coding, deploying, or debugging, run through this checklist.

---

### 1. Personal Sanity

- Breathe. Don’t rush.  
- Confirm **what** you’re solving. Context first.  
- Separate **debug noise** from real development.  
- Never chase phantom bugs without verifying health checks.  
- If logs are unreadable → fix logging first, *then* debug.  

---

### 2. Service Sanity

- `brain-api` → curl `:8081/healthz`  
- `tech-gateway` → curl `:8092/api/tech/health`  
- If either fails: run `deploy-ops.sh` (handles retries + chmod fix).  
- Do **not** guess endpoints — only use canonical ones.  

---

### 3. Git + Deploy Sanity

- `git status` → repo is clean before pushing.  
- `git log` → confirm latest commit matches intent.  
- `deploy-ops.sh` → all green health before merging.  
- Never skip pipeline. Manual deploys = drift.  

---

### 4. AI/Human Sanity

- Confirm commands before running.  
- Keep copies of important configs (no ephemeral debug).  
- If confusion arises: stop, align, re-check rules.  
- Every lost cycle = a new rule in `RULES.md`.  

---

### 5. Sanity Rituals

- Keep deploys small.  
- Logs must stay clear (no wall-of-text debugging).  
- Always update documentation **as part of the work**, not later.  
- If frustrated → step back, check `sanity.md`.  

---

**Bottom line:**  
This file is the **panic brake**.  
When things feel messy, run through these steps and reset.  