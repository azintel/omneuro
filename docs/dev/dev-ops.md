# OPS.md

## Omneuro Operations Guide

This document captures the essential principles, workflows, and lessons learned for operating Omneuro in production. Every detail here is distilled from our experience: what worked, what failed, and how we now run smoothly.

---

## 1. Principles

- **Reliability first.** Ops is measured by uptime and health, not speed.
- **Automate everything.** Every repeated action must become a script.
- **Minimal human error surface.** Clear checklists and single-click deploys.
- **Observability is mandatory.** If it isn’t measured, it’s broken.
- **Documentation-driven ops.** All processes must live here.

---

## 2. Core Workflows

- **Redeploys:** Always use `redeploy.sh` with health checks.
- **Logging:** Centralized via CloudWatch; local dev uses console logs.
- **Secrets:** Managed by AWS SSM; never hardcode.
- **Monitoring:** Health endpoints are tested with retries.
- **Incidents:** Documented in runbooks; never solved ad hoc.

---

## 3. Lessons Learned

### AWS & Permissions
- Always verify **correct AWS profile** before running commands.
- IAM misconfigurations cause silent failures → scripts enforce checks.
- SSM setup requires correct region + account scope.

### Deployment
- `chmod +x` on every script → prevents silent execution failures.
- Health checks must retry with backoff; one miss ≠ failure.
- Only test real endpoints (`/healthz`, `/api/...`), not phantom routes.

### Logging
- CloudWatch agent requires explicit install + permissions.
- Stream names must be consistent (`service/env`).
- Local dev: avoid debug noise in production logs.

### Human/AI Workflow
- AI drift: always re-verify script logic before execution.
- Human error: double-check copy-pasted commands.
- Debug loops wasted time → enforce structured logging.

---

## 4. Standard Tools

- **Process manager:** `pm2` for Node services.
- **Infrastructure:** AWS EC2, SSM, CloudWatch.
- **Monitoring:** health endpoints + logs dashboard.
- **Git:** all ops changes committed with messages → no “dirty” servers.

---

## 5. Golden Rules

1. Never deploy without health checks.  
2. Never run raw TypeScript in prod → always build first.  
3. Always document ops fixes here before repeating them.  
4. If something breaks twice, automate the fix.  
5. Debug noise is the enemy → isolate dev/test logs.  
6. Health > features → revert broken deploys immediately.  
7. Documentation is part of the system.  

---

## 6. References

- `deploy-ops.md` → detailed deploy script docs
- `logs.md` → log management
- `ssm.md` → secrets and environment variables
- `sanity.md` → periodic sanity checks
- `RUNBOOK.md` → incident handling