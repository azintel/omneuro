# RUNBOOK.md  

## Purpose  
This runbook documents **step-by-step recovery actions** for every recurring issue encountered during development, deployment, or operations of Omneuro.  
It is the "break glass" manual for humans and AI when something fails.  

Each entry captures:  
- **Symptom** (what went wrong)  
- **Diagnosis** (how we found the cause)  
- **Fix** (step-by-step)  
- **Prevention** (rule/checklist lesson)  

Cross-references point to `OPS.md`, `RULES.md`, `CHECKLISTS.md`, and `OBSERVABILITY.md`.  

---

## Core Recovery Procedures  

### 1. Deploy Script Failures  
- **Symptom**: `Permission denied` on `redeploy.sh`.  
- **Diagnosis**: File not marked executable.  
- **Fix**:  
- **Prevention**: Deploy script now self-applies `chmod`. Rule added to `RULES.md`.  

---

### 2. Health Check Failures (tech-gateway)  
- **Symptom**: `/healthz` failed, `/api/health` failed, `/api/tech/health` worked.  
- **Diagnosis**: Service only exposes two valid endpoints, not three.  
- **Fix**:  
- Update `redeploy.sh` health check logic to test only `/healthz` and `/api/tech/health`.  
- Add retry logic with backoff.  
- **Prevention**: All new services must document canonical health endpoints in `OBSERVABILITY.md`.  

---

### 3. IAM / Permissions Denied  
- **Symptom**: SSM or AWS commands fail (`AccessDenied`).  
- **Diagnosis**: Wrong IAM role or expired session token.  
- **Fix**:  
Validate role and region. Refresh credentials.  
- **Prevention**: IAM validation step added to pre-deploy checklist.  

---

### 4. Phantom Endpoints / Wrong Routes  
- **Symptom**: cURL returns `404` or `503` despite code changes.  
- **Diagnosis**: Endpoint doesn’t exist in service, or route changed without doc update.  
- **Fix**:  
- Confirm routes in service code.  
- Update `OBSERVABILITY.md` with real endpoints.  
- **Prevention**: Contract-first discipline in `SCHEMA.md`.  

---

### 5. Debug Loops without Progress  
- **Symptom**: Repeated testing with no change in results.  
- **Diagnosis**: Debugging the wrong layer (logs missing or unclear).  
- **Fix**:  
- Stop after 3 failed cycles.  
- Insert logs at boundaries.  
- Compare local logs vs CloudWatch.  
- **Prevention**: “Logs before code” enforced in `RULES.md`.  

---

### 6. CloudWatch Log Silence  
- **Symptom**: No logs appear in CloudWatch after deploy.  
- **Diagnosis**: Wrong log group name or misconfigured IAM.  
- **Fix**:  
- Verify log group in Terraform or CDK.  
- Validate `awslogs-group` in task definition.  
- **Prevention**: Log group names documented in `OBSERVABILITY.md`.  

---

### 7. SSM Setup Failures  
- **Symptom**: SSM agent fails or parameters can’t be fetched.  
- **Diagnosis**: Misconfigured policies or wrong region.  
- **Fix**:  
- Check SSM agent status.  
- Validate `ssm:GetParameter` IAM permission.  
- Ensure parameters exist in region.  
- **Prevention**: SSM procedures documented in `ssm.md`.  

---

### 8. Git Reset / Lost Secrets  
- **Symptom**: `.secrets` wiped after reset.  
- **Diagnosis**: Not excluded properly from Git.  
- **Fix**:  
- Recreate `.secrets`.  
- Add `.secrets/` to `.gitignore`.  
- **Prevention**: Secrets handling documented in `OPS.md`.  

---

### 9. Drift Between Human & AI Context  
- **Symptom**: AI suggests code that doesn’t exist; human executes wrong step.  
- **Diagnosis**: Context misaligned due to noise or stale memory.  
- **Fix**:  
- Re-sync by reloading canonical docs (`README-ops.md`, `RULES.md`).  
- **Prevention**: Debug chatter kept out of project docs. Retro discipline enforced.  

---

### 10. Cloud Deployment Failures (503)  
- **Symptom**: `503 Service Unavailable` during redeploy.  
- **Diagnosis**: ECS service not yet healthy.  
- **Fix**:  
- Add retry/backoff logic to health checks.  
- Verify task logs in CloudWatch.  
- **Prevention**: Health checks wait for service stabilization.  

---

## Debugging Playbook  

- Always start with health checks.  
- Validate IAM/SSM before assuming code is broken.  
- Insert structured logs with request IDs.  
- Tail logs in real-time (`aws logs tail --follow`).  
- If stuck >3 cycles, reset and re-check assumptions.  
- Document the outcome in `RUNBOOK.md`.  

---

## Escalation Paths  

- **Local dev failure** → Check `sanity.md` → escalate to logs.  
- **AWS failure** → Check IAM roles and SSM parameters.  
- **Persistent deploy failure** → Escalate to ADR review.  
- **Unclear system state** → Force redeploy with `./redeploy.sh`.  

---

## Cross-References  

- **OPS.md** → General operating principles.  
- **OBSERVABILITY.md** → Logging/tracing/metrics.  
- **CHECKLISTS.md** → Pre-flight checks.  
- **RULES.md** → Long-term principles.  
- **SCHEMA.md** → Source of truth for contracts.  

---

✅ This runbook is the **hands-on recovery manual**.  
If followed, every known failure path in Omneuro has a documented resolution.  