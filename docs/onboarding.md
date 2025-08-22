# ONBOARDING.md

## Welcome to Omneuro

This guide is for **new humans and AI agents** joining the Omneuro project.  
It captures everything we’ve learned — the wins, the mistakes, the scars — so you can **start strong, avoid old pitfalls, and move fast without breaking trust.**

If you read only one document: read this, then follow the cross-references.  

---

## 1. Philosophy

- **Spartan, not messy** → Simple rules, consistently applied.  
- **Symmetry** → Humans and AI follow the same contracts.  
- **Context is king** → Everything you need is documented.  
- **Ops are sacred** → Deploys and debugging follow rituals, not improvisation.  
- **Progress over chaos** → Avoid “startup dev” thrash. Build like pros.  

---

## 2. Your First Day

### Step 1: Read the Core Docs
- `README-ops.md` → Index + orientation.  
- `ARCHITECTURE.md` → What the system is.  
- `OPS.md` → How we work.  
- `RULES.md` → Guardrails.  
- `RUNBOOK.md` → What to do when it breaks.  
- `OBSERVABILITY.md` → How we see what’s happening.  
- `CHECKLISTS.md` → Ritualized flows (deploy, PR, etc).  
- `CONTRACTS.md` → What we promise each other.  

### Step 2: Run Local Services
- Clone repo.  
- Start `brain-api` and `tech-gateway`.  
- Use health endpoints to confirm they’re alive:  
  - Brain API → `http://localhost:8081/healthz`  
  - Tech Gateway → `http://localhost:8092/api/tech/health`  

### Step 3: Run the Health Script
- `deploy-ops.sh` has built-in retry loops and green-check verification.  
- Never merge without seeing all green.  

---

## 3. Tools You’ll Use

- **GitHub** → Source control + Actions pipeline.  
- **AWS (SSM + CloudWatch)** → Secrets + logs.  
- **curl** → First line of testing.  
- **Structured JSON logs** → Debugging clarity.  
- **ADR files** (`adr/`) → Design history and decisions.  

---

## 4. Golden Rules (from RULES.md)

1. No placeholders. Ever.  
2. Health checks must be green before merging.  
3. Debug logs ≠ production logs (keep them separate).  
4. Schema validation is mandatory pre-merge.  
5. Contracts define truth, not memory.  
6. Always update docs when workflows change.  
7. Rollbacks are automatic — don’t fight them.  
8. Use retries for resilience.  
9. Humans and AI communicate in full sentences, with full context.  
10. No clever hacks that bypass rules.  

---

## 5. Common Pitfalls (Learn From Our Pain)

### AWS / SSM
- Wrong user permissions killed hours.  
- Contract: use IAM roles, not static keys.  

### Logging
- Debug noise drowned real issues.  
- Fix: structured JSON, log levels, separation.  

### Deploys
- GitHub vs manual deploys caused drift.  
- Fix: single pipeline, retries built-in, auto rollback.  

### Health Checks
- We wasted cycles on wrong endpoints.  
- Fix: 1 canonical health endpoint per service.  

### Human/AI Drift
- Copy-paste without checking context = chaos.  
- Fix: confirm intent before executing.  

---

## 6. Day 2–7: Deep Dive

- **Study ADRs** (`adr/`)  
  See why we made certain choices.  

- **Trace Logs in CloudWatch**  
  Learn our JSON structure.  

- **Follow a Full Deploy Cycle**  
  Run `git push`, watch GitHub Actions, validate with health script.  

- **Break and Fix Something in Sandbox**  
  Use `RUNBOOK.md` to recover.  

---

## 7. Lessons Baked Into Culture

- **Retries are non-negotiable.**  
- **Observability isn’t optional.**  
- **Schemas prevent drift.**  
- **Docs are part of the product.**  
- **Every frustration became a rule.**  
- **We never “just wing it” anymore.**  

---

## 8. How to Contribute

- **PRs must include:**  
  - Schema validation.  
  - Updated docs (if workflow changed).  
  - Passing health checks.  

- **AI Contributions**  
  - Never truncate due to token limits without warning.  
  - Never overwrite existing info; append and cross-reference.  
  - Always assume your output will be executed as-is.  

---

## 9. Cross-References

- `OPS.md` → Rituals for daily dev + deploy.  
- `RUNBOOK.md` → Break/fix playbook.  
- `OBSERVABILITY.md` → Logging + monitoring.  
- `CHECKLISTS.md` → Step-by-step flows.  
- `CONTRACTS.md` → System promises.  

---

## 10. Final Note

Onboarding isn’t just about “reading docs.”  
It’s about absorbing the discipline we earned by **burning cycles, losing time, and clawing our way to stability.**  

If you follow this guide and the cross-references:  
- You won’t repeat our mistakes.  
- You’ll be productive on Day 1.  
- And Omneuro will continue to move forward like a professional team.  

Welcome aboard. 🚀