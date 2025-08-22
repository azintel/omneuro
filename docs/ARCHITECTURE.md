# ARCHITECTURE.md

## Purpose
This document defines the architecture of Omneuro.  
It is the **map of the system**, the lines between components, and the rules for how those lines evolve.  
If OPS defines the *rituals*, ARCHITECTURE defines the *bones*.  

---

## 1. High-Level Overview

Omneuro consists of modular services connected by clear contracts:

- **Brain API**  
  Core reasoning engine.  
  Health: `/healthz`.  
  Serves model outputs and orchestrates workflows.

- **Tech Gateway**  
  Public-facing edge service.  
  Health: `/api/tech/health`.  
  Acts as the router and shield, exposing APIs to clients.  

- **Shared Infrastructure**  
  - AWS SSM for secrets.  
  - GitHub Actions for CI/CD.  
  - CloudWatch for logging.  
  - Git for version control.  

- **Documentation Layer**  
  All lessons, contracts, workflows, and schemas live alongside code.  
  ADRs record intentional architectural choices.  

---

## 2. Core Design Principles

- **Minimal Surfaces**  
  Each service does one thing well.  

- **Contracts Before Coupling**  
  Schema drives interactions (see `SCHEMA.md`).  

- **Observability Built-In**  
  Logging and health endpoints are first-class citizens.  

- **AI + Human Friendly**  
  Docs and workflows are structured so both developers and AI agents can onboard seamlessly.  

- **Resilience > Elegance**  
  Fail gracefully, retry intelligently.  

---

## 3. Services and Boundaries

### Brain API
- Focus: reasoning + orchestration.  
- Interfaces:  
  - `/healthz` (canonical).  
  - Core routes as documented in `brain-api.md`.  

### Tech Gateway
- Focus: edge API + routing.  
- Interfaces:  
  - `/api/tech/health` (canonical).  
  - Deprecated routes (`/healthz`, `/api/health`) are redirected, not removed.  

### Infrastructure Glue
- **Secrets:** SSM (with clear roles + permissions).  
- **Logs:** CloudWatch (standard JSON format).  
- **Deployments:** GitHub Actions with `deploy.yml` and manual `deploy-ops.sh`.  
- **Validation:** Schema validation is mandatory before deploy.  

---

## 4. Deployment Topology

- **Local Development**  
  - Run Brain API at `localhost:8081`.  
  - Run Tech Gateway at `localhost:8092`.  
  - Health checks used to verify local builds.  

- **Staging**  
  - Mirrors production, but logs are noisier.  
  - All schema validation must pass here before prod.  

- **Production**  
  - Immutable deploys.  
  - Auto rollback on health check failure.  

---

## 5. Key Lessons Learned

- **Too Many Health Endpoints**  
  We confused ourselves by running 3 different checks.  
  Rule: pick 1 canonical endpoint per service; redirect the rest.  

- **Silent Drift**  
  Services once assumed data existed without schema proof.  
  Rule: architecture must enforce schema validation across boundaries.  

- **AWS Permissions Hell**  
  Early mistakes with SSM and IAM wasted cycles.  
  Rule: minimum viable roles, tested first in staging.  

- **Logging Neglect**  
  Debugging without structured logs caused blind retries.  
  Rule: CloudWatch JSON logging from day 1.  

- **CI/CD Surprises**  
  GitHub Actions misfires blocked deploys.  
  Rule: always test workflows with `act` locally before pushing.  

- **Human + AI Coordination Failures**  
  - I forgot lessons you’d already written.  
  - You copied my mistaken outputs back to me.  
  - Debug noise polluted deploy cycles.  
  Rule: architecture must enforce documentation + clarity for both sides of the pair.  

---

## 6. Documentation Integration

- **This document** = big-picture map.  
- **SCHEMA.md** = contracts.  
- **OPS.md** = how we move.  
- **RUNBOOK.md** = what to do when it breaks.  
- **CHECKLISTS.md** = no missed steps.  
- **RULES.md** = guardrails.  

---

## 7. Future Directions (2.0)

- **Auto Deployments**  
  Move fully to GitHub Actions once health + schema validation are stable.  

- **Observability**  
  Expand CloudWatch with auto-metrics dashboards.  

- **Contracts as First-Class**  
  Schema-driven development → codegen clients.  

- **AI Co-Developer**  
  Documentation, rules, and contracts ensure AI can contribute safely without regressions.  

---

✅ Architecture defines the map.  
When humans or AIs wander, this is the compass.  