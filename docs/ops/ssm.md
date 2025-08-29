# ssm.md

## Omneuro SSM (AWS Systems Manager) Standards

SSM is our single source of truth for secrets, configs, and runtime parameters.  
This file codifies every rule we learned to avoid AWS + IAM hell.

---

### 1. Philosophy

- **No secrets in code. Ever.**  
- **SSM Parameter Store is canonical.**  
- If it’s not in SSM, it doesn’t exist.  
- One source → many consumers (humans, AI, CI/CD).  

---

### 2. Setup + Access

- Parameters live in `/omneuro/{service}/{key}`.  
- Environments: `dev`, `staging`, `prod`.  
- **Use least privilege IAM roles**:  
  - Services → read-only scoped to their prefix.  
  - Humans → need explicit write perms.  
- No root account usage. Never.  

---

### 3. Secrets Discipline

- Tokens, DB creds, API keys → **SSM only**.  
- Rotate credentials quarterly (minimum).  
- Validate values after every change (`aws ssm get-parameter`).  
- Never copy-paste secrets into Slack, Git, or logs.  

---

### 4. Retrieval Rules

- Services pull secrets on startup.  
- No secret hardcoding in Docker images.  
- Local dev:  
  - `aws-vault` or `dotenv` → pull from SSM before running.  
  - Never hand-type creds.  

---

### 5. IAM Lessons Learned

- Wrong perms = wasted days.  
- Explicitly map which role can touch which path.  
- Avoid `AdministratorAccess` — lazy perms create dangerous drift.  
- Log every failed `AccessDenied` → fix IAM first, not code.  

---

### 6. Deployment + CI/CD

- Deploy pipeline injects env vars **from SSM only**.  
- No `.env` checked into git, not even local dev stubs.  
- `deploy-ops.sh` verifies required SSM keys exist before rolling out.  
- Missing secrets block deploys. Better to fail early than run broken.  

---

### 7. Observability + Auditing

- CloudTrail enabled for all `ssm:GetParameter` / `PutParameter`.  
- Alert on unusual access patterns.  
- Keep version history; never overwrite blindly.  
- Rotate and prune stale parameters regularly.  

---

### 8. Human/AI Workflow Rules

- If AI asks for a secret: **Never paste it.** Put in SSM.  
- If human copies/pastes creds into the wrong place → rotate immediately.  
- Debug cycles often wasted here — always check IAM + SSM first.  
- When in doubt: `aws ssm describe-parameters | grep <service>`.  

---

### 9. Anti-Patterns

- Secrets in `.gitignore` files → still a leak risk.  
- Storing creds in Lambda env vars manually.  
- Giving humans full `ssm:*` perms.  
- Forgetting to refresh SSM cache → leads to stale creds and silent errors.  

---

### 10. Sanity Rituals

- Every new service → SSM checklist:  
  - [ ] Create parameter path.  
  - [ ] Assign IAM role with least privilege.  
  - [ ] Test read from service.  
  - [ ] Document in `CONTRACTS.md`.  
- Rotate → test → commit → deploy.  

---

**Final Note:**  
Every bad AWS/SSM cycle cost us hours.  
Follow this doc and **we never relive that pain again.**  