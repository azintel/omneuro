# CHECKLISTS.md

## Purpose
These checklists are the daily safety rails of Omneuro.  
They exist because when we skipped steps, things broke.  
They are meant to be executed as written, not interpreted.  

If something is missing, update this file. If something repeats across projects, move it into `RULES.md`.  

---

## 1. Pre-Deploy Checklist

- [ ] **User context:** Run as `ubuntu` (SSM: `sudo -u ubuntu -- bash -lc '…'`).  
- [ ] **Repo path:** All commands inside `/home/ubuntu/omneuro`.  
- [ ] Pull latest `main` branch.  
- [ ] Verify `.secrets/` is intact and ignored in Git.  
- [ ] Run `chmod +x scripts/*.sh`.  
- [ ] Validate AWS identity: `aws sts get-caller-identity`.  
- [ ] Confirm AWS region matches project defaults.  
- [ ] Ensure SSM agent is running on all target instances.  
- [ ] Validate fresh tokens/credentials.  
- [ ] Run unit tests and integration tests locally.  
- [ ] Run schema contract validation (`SCHEMA.md` alignment).  
- [ ] Push code and docs updates together (atomic commit).  

---

## 2. Deploy Checklist

- [ ] Execute redeploy:
  ```bash
  sudo -u ubuntu -- bash -lc '
  set -euo pipefail
  cd /home/ubuntu/omneuro
  ./scripts/04-redeploy.sh
  '
  ```
- [ ] Confirm script retries health checks with backoff.  
- [ ] Validate ECS/PM2 processes restarted and healthy.  
- [ ] Verify health endpoints manually:
  - [ ] brain-api → `/healthz`
  - [ ] tech-gateway → `/healthz`, `/api/tech/health`
- [ ] Check CloudWatch logs for each service (no silent failures).  
- [ ] Post-deploy retro: capture any issues in `RUNBOOK.md`.  

---

## 3. Debugging Checklist

When something fails:

- [ ] Check IAM permissions first.  
- [ ] Verify AWS region.  
- [ ] Confirm tokens are valid.  
- [ ] Look for logs in CloudWatch.  
- [ ] If logs missing: fix observability before debugging.  
- [ ] Curl endpoint directly.  
- [ ] Compare against schema contracts.  
- [ ] Roll back to last known good deploy if needed.  
- [ ] Document fix in `RUNBOOK.md`.  

---

## 4. Git & Workflow Checklist

- [ ] Never reset without backup.  
- [ ] Commit code, scripts, and docs together.  
- [ ] Review `git diff` before push (no debug or noise).  
- [ ] Use feature branches; keep `main` stable.  
- [ ] Ensure ADR exists for major changes.  
- [ ] Retro captured at sprint end.  
- [ ] Update README index if new files/docs added.  

---

## 5. Ops Checklist (AWS & Infra)

- [ ] Confirm CloudWatch log groups exist for new services.  
- [ ] Ensure metrics are auto-publishing.  
- [ ] Check ECS cluster/task health.  
- [ ] Validate SSM connectivity before assuming code error.  
- [ ] Rotate tokens if older than 24h.  
- [ ] Check for duplicate resources (no “phantom infra”).  

---

## 6. Human–AI Collaboration Checklist

- [ ] Re-sync context before each dev session.  
- [ ] Confirm commands before executing.  
- [ ] AI confirms assumptions before suggesting.  
- [ ] Human confirms outputs before deploying.  
- [ ] Retro extracted into rules after major cycle.  
- [ ] Debug chatter stays out of docs.  
- [ ] If stuck after 3 debug cycles → stop, escalate.  

---

## 7. Runbook Maintenance Checklist

- [ ] Every failure path must be logged in `RUNBOOK.md`.  
- [ ] Runbook entries cross-reference rules and checklists.  
- [ ] If a fix repeats, convert it into a permanent checklist item.  
- [ ] Keep runbook entries concise and executable.  

---

## 8. Cultural Checklist

- [ ] Keep docs spartan: short, clear, referenceable.  
- [ ] No startup chaos: move professionally.  
- [ ] Communicate respectfully, leave rope not threats.  
- [ ] End every sprint with retro + distilled rules.  

---

## 9. Non-Negotiables (Added for clarity)

- **Run as `ubuntu`.** Always prefix with `sudo -u ubuntu -- bash -lc '…'` in SSM.  
- **Use `/home/ubuntu/omneuro`.** Do not run from ad-hoc directories.  
- **Docs with code.** No deploy without updated docs and contracts.  

---

✅ These checklists are living documents.  
If you skip one, you risk burning cycles we already paid for.  