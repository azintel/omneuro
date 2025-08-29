# CHECKLISTS.md

## Purpose
These checklists are the daily safety rails of Omneuro.  
They exist because when we skipped steps, things broke.  
They are meant to be executed as written, not interpreted.  

If something is missing, update this file. If something repeats across projects, move it into `RULES.md`.  

---

## 1. Pre-Deploy Checklist

- [ ] Pull latest `main` branch.  
- [ ] Verify `.secrets/` is intact and ignored in Git.  
- [ ] Run `chmod +x redeploy.sh` (script should self-fix).  
- [ ] Validate AWS identity: `aws sts get-caller-identity`.  
- [ ] Confirm AWS region matches project defaults.  
- [ ] Ensure SSM agent is running on all target instances.  
- [ ] Validate fresh tokens/credentials.  
- [ ] Confirm you are running as `ubuntu` user (use `sudo -i -u ubuntu` if needed).  
- [ ] Run unit tests and integration tests locally.  
- [ ] Run schema contract validation (`SCHEMA.md` alignment).  
- [ ] Push code and docs updates together (atomic commit).  

---

## 2. Deploy Checklist

- [ ] Execute `./redeploy.sh` or `./scripts/04-redeploy.sh` as `ubuntu`.  
- [ ] Confirm script retries health checks with backoff.  
- [ ] Validate ECS task stabilization.  
- [ ] Verify services register healthy in CloudWatch.  
- [ ] Curl each health endpoint manually:
  - [ ] Gateway: `/health`
  - [ ] Service 1: `/ping`
  - [ ] Service 2: `/ready`
  - [ ] Any others as documented in `tech-gateway.md`.  
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

✅ These checklists are living documents.  
If you skip one, you risk burning cycles we already paid for.  