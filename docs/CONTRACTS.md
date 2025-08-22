# CONTRACTS.md

## Purpose
This document defines the **explicit agreements** between services, humans, and AIs.  
Contracts are the promises that keep Omneuro coherent.  
If **SCHEMA.md** defines *what* the data looks like, **CONTRACTS.md** defines *how* we interact.  

---

## 1. Core Principles

- **Single Source of Truth**  
  All contracts are versioned here.  

- **Schema First**  
  Every API interaction references a schema (see `SCHEMA.md`).  

- **Minimal, Explicit, Durable**  
  Contracts should be few, easy to understand, and stable over time.  

- **AI and Human Symmetry**  
  Contracts must be unambiguous for both human developers and AI agents.  

---

## 2. Service-to-Service Contracts

### Brain API ↔ Tech Gateway
- **Health**  
  - Brain API: `/healthz` → returns `{ status: "ok" }`.  
  - Tech Gateway: `/api/tech/health` → returns `{ status: "ok" }`.  
  - Other health endpoints redirect here.  

- **Data Exchange**  
  - Requests validated against JSON schemas (see `SCHEMA.md`).  
  - Responses include explicit status codes (`200`, `400`, `500`).  
  - Errors always return a structured JSON error object:  
    ```json
    {
      "error": "string",
      "code": "E123",
      "details": {}
    }
    ```

- **Resilience**  
  - All requests retry with exponential backoff.  
  - Timeouts: 5s default.  
  - Circuit breaker: trip after 3 consecutive failures.  

---

## 3. Human ↔ AI Contracts

- **No Placeholders**  
  AI never produces `[TODO]` in docs or code.  

- **Full Context**  
  Humans provide full repo/docs context before asking for changes.  

- **Debug Separation**  
  Debug logs and dev logs stay separate (see `OBSERVABILITY.md`).  

- **Repeatability**  
  Every script, deploy, or test must be reproducible without human memory.  

---

## 4. Infrastructure Contracts

- **Secrets (SSM)**  
  - Accessed only via IAM roles.  
  - No hardcoded secrets in repo.  
  - Testing requires dummy values, not production secrets.  

- **Logging (CloudWatch)**  
  - Standard: structured JSON logs.  
  - Contract: every error log must include `service`, `timestamp`, `requestId`.  

- **Deployments**  
  - GitHub Actions pipeline enforces schema validation before deploy.  
  - Deploy script (`deploy-ops.sh`) retries health checks before success.  

---

## 5. Behavioral Contracts

- **Documentation Discipline**  
  Every change in workflow or architecture → update in docs.  

- **Single Source of Deployment Truth**  
  Either GitHub Actions or manual script — never both in parallel.  

- **Rollbacks**  
  If health checks fail, rollback is automatic.  

- **Consistency Over Creativity**  
  No clever shortcuts that violate rules.  

---

## 6. Lessons Learned

- **Multiple Health Endpoints Confused Us**  
  → Contract: one canonical endpoint per service.  

- **IAM / SSM Permissions Hell**  
  → Contract: minimum viable roles, documented in `ssm.md`.  

- **Debug Noise in Deploy Loops**  
  → Contract: separate observability channels for debugging vs. production logs.  

- **Schema Drift Broke Integration**  
  → Contract: schema validation before merge.  

- **Human/AI Miscommunication**  
  → Contract: no copy-paste without confirming intent and correctness.  

- **Retries Saved Deployments**  
  → Contract: all health checks must retry before marking failure.  

---

## 7. Governance

- **Change Control**  
  All contract changes require an ADR (see `adr/`).  

- **Versioning**  
  - v1: Current stable.  
  - v2+: Future revisions must remain backward compatible for 1 release cycle.  

- **Breaking Changes**  
  Must be flagged in ADR + changelog.  

---

## 8. Cross-References

- `ARCHITECTURE.md` → defines system boundaries.  
- `SCHEMA.md` → defines data shapes.  
- `OPS.md` → defines rituals.  
- `OBSERVABILITY.md` → defines visibility guarantees.  
- `RULES.md` → defines behavior guardrails.  

---

✅ Contracts are the **promises**.  
Break a contract → break the system.  
Keep them → Omneuro thrives.  