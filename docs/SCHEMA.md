# SCHEMA.md

## Purpose
Schema is the **contract** of Omneuro.  
It prevents drift, protects integrations, and forces clarity.  

If it isn’t in the schema, it isn’t real.  
If it changes, the change must be explicit and versioned.  

---

## 1. Principles

- **Single Source of Truth**  
  All inter-service contracts live here. No hidden assumptions.  

- **Schema Before Code**  
  We design schema before implementing features.  

- **Backward Compatibility**  
  No breaking changes without ADR approval.  

- **Contracts as Code**  
  Schemas are version-controlled, linted, and validated automatically.  

- **Minimal Surfaces**  
  Every endpoint and payload should be as small as possible while still solving the problem.  

---

## 2. Schema Format

- JSON Schema for payloads.  
- OpenAPI spec for service endpoints.  
- SQL schema migrations versioned and documented.  
- Events documented in the same way as REST endpoints.  

---

## 3. Validation

- Schemas are auto-tested during CI/CD.  
- Every deploy runs schema validation across:
  - API requests/responses.  
  - Event bus payloads.  
  - Database migrations.  

- Mismatches fail the build. No exceptions.  

---

## 4. Governance

- Schema changes require:
  - An ADR (see `/ADR-*`).  
  - Update to this document.  
  - Version bump in `CONTRACTS.md`.  
  - Tests proving compatibility.  

- Breaking changes only allowed if:
  - Version bump (e.g. `/v2/health`).  
  - Migration path documented in `RUNBOOK.md`.  
  - Downtime window approved.  

---

## 5. Contracts & Endpoints (Cross-Reference)

- **Brain API**  
  Health: `/healthz`  
  Core contract: see `brain-api.md`  

- **Tech Gateway**  
  Health: `/health`, `/api/tech/health`  
  (See `tech-gateway.md` for details)  

- **Shared Contracts**  
  - Standard health contract = `{ "status": "ok", "uptime": <seconds> }`  
  - Errors must use `{ "error": { "code": <int>, "message": <string> } }`  
  - Dates in ISO 8601 only.  
  - IDs are UUIDv4 unless documented otherwise.  

---

## 6. Common Pitfalls (Lessons Learned)

- **Untracked Changes**  
  We lost days when schema drifted silently. Rule: update schema first.  

- **Too Many Health Endpoints**  
  Confusion arose with duplicate health routes. Rule: one canonical, others redirect.  

- **Git Resets Nuking Contracts**  
  When `.secrets/` or schema got wiped, integration failed. Rule: protect schema in version control.  

- **Debug vs Contract Data**  
  Logs sometimes diverged from schema. Rule: never trust logs as contracts.  

- **Assumptions Between Services**  
  Services assumed payloads existed without schema proof. Rule: schemas must explicitly list optional vs required.  

---

## 7. Change Workflow

1. Propose schema change.  
2. Draft ADR.  
3. Update `SCHEMA.md`.  
4. Update `CONTRACTS.md`.  
5. Add validation tests.  
6. Merge → Deploy.  

---

## 8. Enforcement

- Pre-commit hooks lint schema.  
- CI fails on schema mismatch.  
- Deployment blocks until health endpoints confirm schema consistency.  

---

## 9. Schema Retro Rules (From Our Sprints)

- Document *first*, code *second*.  
- A contract isn’t real unless both humans + AI can enforce it.  
- Every schema change should leave behind a breadcrumb in docs.  
- Never debug schema by guesswork: run the validator.  
- If a schema update causes more than 3 failed cycles → stop and refactor.  

---

✅ Schema is the contract that keeps Omneuro alive.  
Follow it strictly, and services will align without surprises.  