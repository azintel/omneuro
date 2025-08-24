# WORKFLOW.md  

## Purpose  
This document defines the **end-to-end development workflow** for the Omneuro project.  
It blends human discipline with AI assistance to ensure we build fast, safe, and repeatable systems.  
Everything here exists to eliminate wasted cycles, prevent debug traps, and enforce clarity.  

---

## Principles  

1. **Logs before code.**  
   No feature, fix, or deploy moves forward without logs in place.  

2. **Health checks before assumptions.**  
   Start at the edges — if health fails, fix that first.  

3. **Checklists before execution.**  
   Never rely on memory. Always consult `CHECKLISTS.md`.  

4. **One source of truth.**  
   Contracts → `SCHEMA.md`.  
   Rules → `RULES.md`.  
   Runbook fixes → `RUNBOOK.md`.  

5. **AI is a partner, not infallible.**  
   Verify outputs before execution. Humans must sanity-check.  

6. **Humans must avoid noise.**  
   Don’t feed debug chatter back to the AI as canonical source.  

---

## Dev Workflow  

1. **Plan**  
   - Reference `README-ops.md` index.  
   - Check if new work affects contracts (`SCHEMA.md`).  
   - Update ADRs if it’s an architecture-level decision.  

2. **Code**  
   - Start with log statements.  
   - Write clear request/response logs with request IDs.  
   - Keep debug noise out of production.  

3. **Commit & Push**  
git add -A
git commit -m “Message”
git push

4. **Deploy**  
- Run `./redeploy.sh`.  
- Script auto-applies `chmod +x`.  
- Script retries health checks with backoff.  

5. **Verify**  
- Confirm all greens in redeploy script.  
- Tail CloudWatch logs.  
- Validate service health:  
  - brain-api → `/healthz`  
  - tech-gateway → `/healthz`, `/api/tech/health`  

6. **Document**  
- Update `RUNBOOK.md` for fixes.  
- Update `RULES.md` for lessons.  
- Update `CHECKLISTS.md` if a new safety step emerges.  

---

## Debug Workflow  

1. **Start at health checks.**  
If they fail, stop and fix before digging deeper.  

2. **Logs-first policy.**  
If logs are unclear → fix logs first.  

3. **IAM & SSM validation.**  
Confirm credentials and tokens before assuming code is broken.  

4. **Compare local vs CloudWatch.**  
Eliminate environment mismatch early.  

5. **Limit cycles.**  
If 3 debug loops don’t resolve → re-check assumptions.  

6. **Document.**  
Every debug loop must end with a note in `logs.md` or `RUNBOOK.md`.  

---

## Ops Workflow  

- Triage starts with `OPS.md`.  
- IAM / permissions validated first.  
- Health checks re-run after every change.  
- Debug noise filtered into `logs.md`.  
- Final fixes committed back to repo.  
- Runbook entries must be created for future reference.  

---

## AI + Human Collaboration Workflow  

1. **AI Outputs**  
- Treated as drafts, not gospel.  
- Human verifies before execution.  

2. **Human Inputs**  
- Must be clean and noise-free.  
- Debug chatter logged separately.  

3. **Error Handling**  
- If AI drifts → reset with canonical docs.  
- If human misfeeds noise → backtrack using logs.  

4. **Retro Discipline**  
- Every misstep captured in `RULES.md`.  
- New lessons → extracted into checklists.  

---

## Communication Rules  

- Keep commits and logs concise.  
- Use structured, timestamped logs.  
- No ad-hoc endpoint names — verify in code first.  
- Distinguish between “debug chatter” and “production signals.”  
- Summarize lessons at the end of every sprint.  

---

## Anti-Patterns (to Avoid)  

❌ Flying blind without logs.  
❌ Phantom endpoints.  
❌ Debug loops >3 cycles.  
❌ Mixing debug chatter into canonical docs.  
❌ Forgetting to run checklists before deploy.  
❌ Silent drift between AI + human context.  
❌ IAM/SSM permissions left unvalidated.  

---

## Cross-References  

- **OPS.md** → Operations discipline.  
- **CHECKLISTS.md** → Execution safeguards.  
- **OBSERVABILITY.md** → Logging, tracing, monitoring.  
- **RULES.md** → Canonical lessons and principles.  
- **RUNBOOK.md** → Step-by-step fixes.  

---

✅ This workflow is designed to prevent **all 110+ mistakes** we’ve catalogued.  
If followed, we get consistent, safe progress — without wasted cycles.  