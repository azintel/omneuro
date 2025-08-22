# README-ops.md

## Omneuro Operations Documentation

Welcome to the **Ops knowledge base** for Omneuro.  
This repo is our **living brain** for development, deployment, debugging, and scaling.  

It captures every rule, workflow, and lesson we’ve learned — so we never repeat past mistakes and always move forward professionally.

---

## 1. Philosophy

- **No chaos, no thrash.** Ops are rituals, not improvisation.  
- **Humans + AI are equal contributors.** Contracts bind both.  
- **Clarity beats cleverness.** No magic hacks.  
- **Observability is survival.** If you can’t see it, you can’t fix it.  
- **Every pain became a rule.** If we lost time, it’s written here.  

---

## 2. Document Map

Use this as your index — each doc serves a specific purpose.

- **ARCHITECTURE.md** → System design overview.  
- **OPS.md** → Core dev workflows + ops discipline.  
- **RULES.md** → Guardrails from 110 lessons.  
- **WORKFLOW.md** → Step-by-step development cycle.  
- **CHECKLISTS.md** → Ritualized action flows (deploys, PRs, etc).  
- **RUNBOOK.md** → Break/fix emergency guide.  
- **OBSERVABILITY.md** → Logging, monitoring, alerts.  
- **SCHEMA.md** → Data contracts + validation.  
- **CONTRACTS.md** → Service agreements between modules.  
- **onboarding.md** → Getting new humans/AI up to speed.  
- **ADR files (`adr/`)** → Architectural decisions + design history.  

---

## 3. Quickstart for Developers

1. **Clone repo** → `git clone ...`  
2. **Install dependencies** (see `OPS.md`).  
3. **Start services**:  
   - Brain API → `:8081/healthz`  
   - Tech Gateway → `:8092/api/tech/health`  
4. **Run health script** (`deploy-ops.sh`)  
   - Verifies executables (`chmod +x` enforced)  
   - Retries health checks until all green  
   - Blocks merges if red  

---

## 4. Deployment Flow

- **Git add/commit/push** triggers GitHub Actions.  
- **Pipeline runs**:  
  - Install + build  
  - Schema validation  
  - Unit + integration tests  
  - Health checks (retry loop)  
  - Auto rollback if fail  

- **Never bypass pipeline.** Manual deploys caused drift.  

---

## 5. Observability Basics

- Logs are structured JSON.  
- CloudWatch used for centralized logs.  
- Debug logs ≠ production logs (must stay separate).  
- Health endpoints:  
  - Brain API → `/healthz`  
  - Tech Gateway → `/api/tech/health`  

---

## 6. Rules You Must Know (see RULES.md for full list)

- **No placeholders.** Docs, code, commits must be complete.  
- **Retry loops everywhere.** Prevent false negatives.  
- **Canonical endpoints only.** Don’t guess health paths.  
- **Schema validation mandatory.** Prevents bad deploys.  
- **Always update docs** when workflows or ops change.  
- **Context is required.** Don’t issue commands without it.  

---

## 7. Common Pitfalls

- **AWS IAM/SSM**: Wrong users or perms wasted cycles → always use roles.  
- **Logs**: Drowned in noise → enforce log levels.  
- **Deploys**: GitHub vs manual drift → single pipeline only.  
- **Human/AI misalignment**: Copy/paste confusion → confirm before execution.  
- **Health checks**: Wrong endpoints tested → locked down to canonical ones.  

---

## 8. Developer + AI Workflow (short form)

1. Define work in issue/ticket.  
2. Code locally.  
3. Validate schemas.  
4. Run health checks.  
5. Commit + push → CI pipeline.  
6. Monitor logs + health.  
7. Update docs.  

For full details: see `WORKFLOW.md` and `OPS.md`.  

---

## 9. Emergency Flow

If something breaks:  
- Follow `RUNBOOK.md` step-by-step.  
- Rollback is automatic. Don’t fight it.  
- If rollback fails, escalate via `CHECKLISTS.md`.  

---

## 10. Final Note

This repo is the **collective memory of Omneuro.**  
Every frustration, lost cycle, and breakthrough is codified here.  

Read it, follow it, and you’ll:  
- Avoid our mistakes.  
- Deploy with confidence.  
- Scale without fear.  

Welcome to Omneuro Ops. 🚀