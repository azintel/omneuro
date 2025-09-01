# Omneuro — Stitched Docs
Generated: 2025-09-01T20:50:39Z
HEAD: 1bcab778a2ee2c4c33507a87b6f82bdcbf8c446f

---
### docs/ADR/0000-template.md
```md
Create directory docs/adr/ and add one file per decision.

# ADR-YYYYMMDD-<slug>

## Context
Problem, constraints, related systems.

## Decision
What we decided and why (short).

## Consequences
Positive/negative outcomes, follow-ups.

## Alternatives Considered
Options, trade-offs, why rejected.

## References
Links to code, issues, diagrams.

Seed ADRs to write first:
	•	ADR: “ESM + explicit .js imports from TS”
	•	ADR: “CloudWatch unified logging + stream naming <iid>/{out,err}”
	•	ADR: “Gateway ↔ Brain contract for /api/tech/message and /jobs/:id/status”

```

---
### docs/ADR/ADR-20250820-cloudwatch-logging.md
```md
# ADR-20250820 — Unified CloudWatch logging via agent + PM2

## Context
We need reliable, queryable logs for each module with separate out/err streams.

## Decision
- Use Amazon CloudWatch Agent to ship `/home/ubuntu/.pm2/logs/<module>-{out,err}.log`.
- Log group per module: `/omneuro/<module>`.
- Log stream per instance: `<instance-id>/{out,err}`.
- Provide `om-logs-setup.sh` + `om-logs-verify.sh` to enforce/verify config.

## Consequences
- First-class, centralized logs for debugging releases quickly.
- Slight operational overhead (agent, IAM perms).

## Alternatives Considered
- PM2 Cloud, third‑party SaaS: more features, recurring cost, new surface area.

## References
- Streams confirmed for `brain-api` and `tech-gateway` with seeded events.
```

---
### docs/ADR/ADR-20250820-esm-imports.md
```md
# ADR-20250820 — ESM everywhere + explicit .js imports from TS

## Context
Node projects (`brain-api`, `tech-gateway`) are `"type": "module"`. TS emits `.js`. Node ESM resolver needs explicit file extensions.

## Decision
- Keep ESM across services.
- In TS source, import local files with explicit `.js` when they compile to JS and are imported by other compiled JS (e.g. `import techRouter from "./routes/tech.js"`).
- Avoid `require()` in ESM; use `import` and `express.json()`.

## Consequences
- Fewer “ERR_MODULE_NOT_FOUND” issues.
- Clear boundary between TS dev-time paths and JS runtime paths.

## Alternatives Considered
- CommonJS (`type: "commonjs"`): simpler resolver but conflicts with newer deps and our ESM-first direction.

## References
- Commit: ESM import fixes in `apps/tech-gateway/src/server.ts`
```

---
### docs/ADR/ADR-20250820-gateway-brain-contract.md
```md
# ADR-20250820 — Gateway ↔ Brain API contract (v1)

## Context
Techs talk to Omneuro via `tech-gateway`. `brain-api` holds domain logic (RepairBot, jobs).

## Decision
- `POST /api/tech/message` → forward to `${BRAIN_API_URL}/v1/repairbot/message`.
- `PATCH /api/tech/jobs/:id/status` → forward to `${BRAIN_API_URL}/v1/jobs/:id/status`.
- `GET /api/tech/health` returns `{ ok: true }`. `GET /healthz` for process liveness.

## Consequences
- Very thin edge; domain logic stays in `brain-api`.
- Easy to evolve with versioned endpoints.

## Alternatives Considered
- Put NL processing in gateway: heavier edge, worse separation.

## References
- `apps/tech-gateway/src/routes/tech.ts`
- `apps/tech-gateway/src/server.ts`
```

---
### docs/ADR/ADR-20250901-homepage-tech-split.md
```md
# ADR-20250901-homepage-tech-split.md

## Title
Separate Homepage (juicejunkiez.com) and Tech Portal (tech.juicejunkiez.com)

## Status
Accepted

## Context
Originally, both the **public homepage** and the **tech portal** were being served through the same `index.html` under `apps/tech-gateway/public`.  
This caused two issues:  
1. **Password prompt on homepage** – The entire site was gated by the tech portal’s basic auth, blocking clients.  
2. **Context confusion** – Public vs internal traffic was not clearly separated in nginx or in the repo structure.  

During deployment, the homepage was expected at `juicejunkiez.com` (public) while the password-protected tech portal was expected at `tech.juicejunkiez.com`. Mixing them caused failures and wasted cycles.  

## Decision
- **Homepage** (`juicejunkiez.com`):  
  - Served directly by nginx.  
  - Static files live under `/var/www/juicejunkiez.com`.  
  - Branding: black + gold, Juice Junkiez logo.  
  - Public links: Shop, Client Garage, Tech Portal.  
  - No authentication required.  

- **Tech Portal** (`tech.juicejunkiez.com`):  
  - Served by `apps/tech-gateway` (Node/Express).  
  - Protected with password auth.  
  - Contains internal tools: Repairbot chat, job tracking, diagnostics.  
  - API access remains under `/api/*`.  

- **nginx split**:  
  - `juicejunkiez.com` → static root at `/var/www/juicejunkiez.com`.  
  - `tech.juicejunkiez.com` → proxied to Node app on port 8092.  
  - Health endpoints exist for both domains.  

## Consequences
- Clients and partners access a clean, public-facing homepage without being blocked by authentication.  
- Techs continue to log in through `tech.juicejunkiez.com`.  
- Code and infrastructure are cleaner:  
  - `apps/homepage/` for static site.  
  - `apps/tech-gateway/` for tech tools + APIs.  
- TLS certificates managed separately but via a unified certbot process.  
- Deploy script (`scripts/04-redeploy.sh`) updated to sync both homepage and tech portal.  

## Cross-References
- `ROADMAP.md` – Lists homepage and tech portal milestones.  
- `RULES.md` – Rule: “No phantom endpoints; homepage and tech portal must not overlap.”  
- `OPS.md` – nginx + certbot deployment steps.  
- `RUNBOOK.md` – Recovery path if homepage accidentally password-protected.  
```

---
### docs/ARCHITECTURE.md
```md
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
```

---
### docs/CHECKLISTS.md
```md
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
```

---
### docs/CONTRACTS.md
```md
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
```

---
### docs/dev/brain-api.md
```md
# brain-api (service)

Service providing conversational + job orchestration logic.  
Runs independently on port `8081`.

---

## Summary

- **Port:** `8081`
- **Runtime:** Node.js 20, ESM modules
- **Framework:** Express v5 + TypeScript
- **Build output:** `dist/server.js`

---

## Health

- `GET /healthz` → returns `{ status: "ok" }`

Health is critical for deployment:  
- Checked by `redeploy.sh`  
- Must return HTTP 200 consistently

---

## Routes

### RepairBot
- `POST /v1/repairbot/message`  
  Accepts structured message payloads, routes to repairbot pipeline.

### Jobs
- `PATCH /v1/jobs/:id/status`  
  Updates job status (pending → active → done).

---

## Build & Run

```bash
npm ci
npm run build
node dist/server.js   # local only
```

---
### docs/dev/dev-ops.md
```md
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
```

---
### docs/dev/tech-gateway.md
```md
# tech-gateway

## Purpose
`tech-gateway` is the public-facing Node.js/Express service that fronts Omneuro’s repair operations.  
It serves three main roles:
- **Tech Portal** – password-protected interface at [https://tech.juicejunkiez.com](https://tech.juicejunkiez.com) for internal use.  
- **Repairbot Chat API** – `/api/chat` endpoint that brokers calls to OpenAI with keys securely fetched from AWS SSM.  
- **Static Homepage Proxy** – traffic to [https://juicejunkiez.com](https://juicejunkiez.com) is handled by Nginx as a static site, separate from the Node runtime.

## Architecture
- **Express app** under `apps/tech-gateway/src/server.ts`
  - Serves `/api/chat` via `routes/chat.ts`
  - Mounts `techRouter` under `/api/tech`
  - Provides `/healthz` and `/api/health` endpoints
  - Static assets under `apps/tech-gateway/src/public`
- **Secrets** resolved via `src/lib/ssm.ts`
  - Reads `/omneuro/openai/api_key` from AWS SSM
  - Region pinned to `us-east-2`
  - Cached in-memory for efficiency
- **PM2** manages processes (`ecosystem.config.cjs`)
  - `tech-gateway` bound to port `8092`
  - `BRAIN_API_URL` set to `http://localhost:8081`
  - Env vars injected at reload (`--update-env`)
- **Nginx** handles TLS + routing
  - `tech.juicejunkiez.com` → proxied to Node `8092`
  - `juicejunkiez.com` → static HTML from `/var/www/juicejunkiez.com`
  - Certbot manages SSL certificates
- **Deploy scripts**
  - `scripts/04-redeploy.sh` resets perms, pulls latest, builds, and restarts PM2
  - Always runs as `ubuntu` with `sudo`

## Health Checks
- Local: `curl http://127.0.0.1:8092/healthz`
- Public (proxied):  
  - `curl https://tech.juicejunkiez.com/healthz`  
  - `curl https://juicejunkiez.com/nginx-health`  

Both must return `200 OK` before deploy is considered healthy.

## Rules
- Never store secrets in repo; always SSM.  
- Always `chmod +x scripts/*.sh` after git reset.  
- All ops commands run as `ubuntu` with `sudo`.  
- No overlapping server_name blocks in Nginx (conflicts cause 404/redirect loops).  
- Homepage is static, tech portal is Node; do not conflate.  

## Cross-References
- [OPS.md](../ops/OPS.md) – global ops patterns  
- [RULES.md](../ops/RULES.md) – non-negotiable dev rules  
- [secrets.md](../ops/secrets.md) – SSM parameter paths  
- [roadmap.md](../ROADMAP.md) – feature milestones (Homepage, Garage, Shop)  
```

---
### docs/ENVIRONMENTS.md
```md

```

---
### docs/HEALTH.md
```md
# HEALTH.md

## Purpose
This document consolidates all **health checks** used in Omneuro.  
Health checks are canonical — if they fail, the service is not considered deployed.  

---

## Homepage (juicejunkiez.com)

- **HTTP**  
  - `http://juicejunkiez.com/nginx-health` → `200 OK` (redirects to HTTPS)  
- **HTTPS**  
  - `https://juicejunkiez.com/nginx-health` → `200 OK`  

Confirms Nginx is up, TLS is valid, and homepage static root is served.  

---

## Tech Gateway (tech.juicejunkiez.com)

- **Local (Node)**  
  - `http://127.0.0.1:8092/healthz` → `{"ok":true}`  
- **Public (through Nginx)**  
  - `https://tech.juicejunkiez.com/healthz` → `{"ok":true}`  
  - `https://tech.juicejunkiez.com/api/health` → `{"ok":true}`  
- **Chat API Smoke**  
  - `curl -sS https://tech.juicejunkiez.com/api/chat -H "content-type: application/json" -d '{"messages":[{"role":"user","content":"ping"}]}'`  
  → must return JSON with `"reply"`  

---

## Brain API

- **Local (Node)**  
  - `http://127.0.0.1:8081/healthz` → `{"ok":true}`  
- **Public** (if proxied in future) TBD  

---

## Certbot (TLS renewal)

- **Renewal test**  
  - `sudo certbot renew --dry-run` → must succeed without error  
- Certificates stored at:  
  - `/etc/letsencrypt/live/juicejunkiez.com/fullchain.pem`  
  - `/etc/letsencrypt/live/juicejunkiez.com/privkey.pem`  

---

## Ops Integration

- All redeploy scripts must verify these endpoints at the end.  
- Failures must block deploy until fixed.  
- When adding new subdomains (e.g., `shop.juicejunkiez.com`), update this file immediately.  

---

✅ Health checks are **non-optional**. If not documented here, they do not exist.  
```

---
### docs/LOGGING.md
```md

```

---
### docs/NEXT.md
```md
 Next Actions
	•	Provide repo URL → auto-sync repo tree here
	•	Add scheduler + kb-indexer stubs (ports, health)
	•	Fill env/ports matrix and shared types index
	•	Write 3 seed ADRs listed above
```

---
### docs/OBSERVABILITY.md
```md
# OBSERVABILITY.md

## Observability Guide

Omneuro relies on strong observability to prevent blind debugging loops and wasted cycles. This document defines the standards, practices, and lessons learned.

---

## 1. Principles

- **Measure everything.** If it isn’t logged, it doesn’t exist.  
- **Single source of truth.** CloudWatch is the system of record.  
- **Fast feedback.** Errors must surface within seconds.  
- **Minimal noise.** Logs should be actionable, not spammy.  
- **Correct user context.** Observability setup and verification commands must be executed as the `ubuntu` user with `sudo` in SSM sessions.

---

## 2. Health Checks

- Every service implements `GET /healthz`.  
- `tech-gateway` adds `GET /api/tech/health`.  
- Health check script retries 5× with backoff.  
- No phantom endpoints are allowed in tests.  
- Health checks must be run under `ubuntu` to ensure correct environment and permissions.  

---

## 3. Logging

- **CloudWatch**:  
  - Each service streams logs by `service/env`.  
  - Standardized JSON format for parsing.  
- **Local dev**:  
  - Console logging only.  
  - No debug spam in production builds.  
- **Error logging**:  
  - Stack traces logged once, not repeatedly.  
  - Redacted sensitive data (secrets, tokens).  

---

## 4. Metrics

- Success/failure counts for health endpoints.  
- Deploy success/failure metrics tied to `redeploy.sh`.  
- Latency measurements for API calls.  
- Error rate thresholds trigger rollback.  

---

## 5. Lessons Learned

- **Blind debugging** cost days → fixed by adding CloudWatch + local logs.  
- **Inconsistent stream names** broke dashboards → now enforced in config.  
- **Debug noise** obscured real errors → strict filtering in production logs.  
- **Phantom endpoints** wasted time → strict endpoint registry.  
- **Wrong user context** in SSM caused missing logs/metrics → rule: always switch to `ubuntu`.  

---

## 6. References

- `logs.md` → detailed log management.  
- `sanity.md` → periodic sanity checks.  
- `deploy-ops.md` → integrated health checks.  

---
```

---
### docs/onboarding.md
```md
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
- **Always switch to `ubuntu` with `sudo -i -u ubuntu` when running redeploys.**  

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
  - `git push` your changes.  
  - Watch GitHub Actions pipeline.  
  - Connect via SSM → switch to `ubuntu` with `sudo -i -u ubuntu`.  
  - Run `./scripts/04-redeploy.sh`.  
  - Validate with health script.  

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
```

---
### docs/OPS.md
```md
# OPS.md

## Purpose
Operations practices for Omneuro / JuiceJunkiez.  
This file captures the lessons, defaults, and recovery patterns that keep our infra stable.  
Every section exists because we broke it once and had to fix it.  

Ops rules are not optional. They are the playbook.  

---

## Environments

- **AWS EC2**: Core services (brain-api, tech-gateway) run on a single EC2 host with PM2.  
- **Ubuntu user**: All commands run as `ubuntu` with `sudo`. Never stay as `ssm-user`.  
- **Home directory layout**:
  - `/home/ubuntu/omneuro` – Git repo root.
  - `/var/www/juicejunkiez.com` – Static homepage root.  
- **Domains**:
  - `juicejunkiez.com` – Public homepage (no password).  
  - `tech.juicejunkiez.com` – Tech portal + Repairbot (password-protected).  

---

## Deploy & Redeploy

- **Always pull fresh**: `git fetch && git reset --hard origin/main`.  
- **Scripts executable**: Redeploy script (`scripts/04-redeploy.sh`) must `chmod +x` itself after pull.  
- **PM2 reload**: Apps (`brain-api`, `tech-gateway`) are restarted via `ecosystem.config.cjs`.  
- **Static homepage**: Synced from repo (`apps/homepage/public/`) to `/var/www/juicejunkiez.com`.  
- **Health checks**: Run after every redeploy. Each service/page must pass before completion.  

---

## Health Checks

Every service and site publishes a health endpoint:

- **Brain API**: `http://localhost:8081/healthz`  
- **Tech Gateway**: `http://localhost:8092/healthz`, `/api/health`, `/api/tech/health`  
- **Nginx sites**:
  - `https://juicejunkiez.com/nginx-health` – static homepage
  - `https://tech.juicejunkiez.com/healthz` – tech portal (proxied to Node)  

Health checks are canonical. They retry with backoff. Failures block deploy.  

---

## TLS / DNS

- **Route53**: `juicejunkiez.com` + `www.juicejunkiez.com` A records point to EC2 Elastic IP.  
- **Certbot**: Certificates issued via `certbot --nginx`.  
- **Auto-renew**: Cron/systemd handles renewal. Test with `certbot renew --dry-run`.  
- **Redirects**:
  - `www.juicejunkiez.com` → `juicejunkiez.com`  
  - All HTTP → HTTPS  

---

## Permissions

- **Repo scripts**: Must stay executable (`chmod +x`).  
- **Static homepage**: Owned by `www-data:www-data`.  
- **Nginx configs**: `/etc/nginx/sites-available/*` symlinked into `/etc/nginx/sites-enabled/`.  
- **Fixes**: If perms drift, run `chown -R www-data:www-data /var/www/juicejunkiez.com` and reset.  

---

## Secrets

- **AWS SSM** is the only source of secrets (see `SECRETS.md`).  
- **OpenAI API key**: `/omneuro/openai/api_key` (SecureString).  
- **Other keys**: Google client ID/secret, Telnyx key, Stripe keys (future).  
- **Never in Git**. Never in local configs.  

---

## Debug Patterns

- **Start with IAM + region**: Most SSM issues are missing perms or wrong region.  
- **Curl the healthz**: Always test endpoint directly before assuming code broke.  
- **Logs before code**: PM2 logs are the first stop, not code edits.  
- **Check perms**: 90% of homepage/NGINX failures were file ownership or chmod.  

---

## Documentation Discipline

- **Single-block rule**: Docs must always be output in one block to avoid spill/mix.  
- **Cross-link**: OPS, RULES, OBSERVABILITY, RUNBOOK, and CHECKLISTS must point to each other.  
- **No drift**: Every new lesson goes straight into docs.  

---

## Cross-References

- **RULES.md** – Non-negotiable rules (dev + ops).  
- **OBSERVABILITY.md** – Log groups, tracing, metrics.  
- **RUNBOOK.md** – Recovery actions for failures.  
- **CHECKLISTS.md** – Step-by-step deploy/debug sanity checks.  
- **SECRETS.md** – Canonical list of SSM paths.  

---

✅ Ops are codified here so we don’t repeat mistakes.  
If it isn’t in `OPS.md`, it didn’t happen.  
```

---
### docs/ops/deploy-ops.md
```md
# deploy-ops.md

## Omneuro Deployment Operations Guide

This file documents how we redeploy services cleanly and reliably.  
Everything here was written in blood, sweat, and failed `curl` checks.

---

### 1. Principles

- **Zero-click deploys.** Scripts should handle everything with minimal human intervention.  
- **Health-first.** If health checks fail, deploy halts.  
- **Self-healing.** Scripts add retries and permissions fixes automatically.  
- **Consistency.** Every deploy follows the same steps across services.  
- **Correct user + path.** All commands must be run as `ubuntu` using `sudo -u ubuntu -- bash -lc '…'` in SSM.  
- **Canonical repo directory:** `/home/ubuntu/omneuro`.

---

### 2. Redeploy Script (`04-redeploy.sh`)

Key features:

1. **Git pull latest code**  
   - Always pulls fresh before redeploy.  
   - Immediately runs `chmod +x` to ensure executables are runnable (prevents silent fails).  

2. **Service restarts**  
   - Stops old processes cleanly.  
   - Starts fresh services (PM2/system).  

3. **Health checks**  
   - Retries up to 5 times with backoff.  
   - Only two tech-gateway routes tested:  
     - `/api/tech/health` ✅  
     - `/healthz` ✅  
   - No phantom endpoints tested.  

4. **Fail early**  
   - If any check fails after retries, script exits non-zero.  
   - Protects us from deploying silently broken code.  

---

### 3. Health Check Standards

- **brain-api** → `http://localhost:8081/healthz`  
- **tech-gateway** → `http://localhost:8092/healthz` and `http://localhost:8092/api/tech/health`  
- **curl with retries**:
  ```bash
  for i in {1..5}; do
    if curl -fsS "$url"; then
      echo "OK"; break
    else
      echo "Retry $i failed, sleeping..."
      sleep 2
    fi
  done
  ```

---

### 4. SSM Workflow (from workstation)

```bash
aws ssm start-session --region us-east-2 --target i-011c79fffa7af9e27
```

Then inside SSM, redeploy as ubuntu:

```bash
sudo -u ubuntu -- bash -lc '
set -euo pipefail
cd /home/ubuntu/omneuro
git fetch --all
git checkout main
git pull --ff-only
chmod +x scripts/*.sh
./scripts/04-redeploy.sh
curl -fsS http://127.0.0.1:8081/healthz
curl -fsS http://127.0.0.1:8092/healthz
curl -fsS https://tech.juicejunkiez.com/healthz
curl -fsS https://tech.juicejunkiez.com/api/tech/health
'
```

---

### 5. Handling Unstaged Changes

**Inspect:**
```bash
sudo -u ubuntu -- bash -lc '
cd /home/ubuntu/omneuro
git status -s
git --no-pager diff --name-only
'
```

**Stash then redeploy:**
```bash
sudo -u ubuntu -- bash -lc '
cd /home/ubuntu/omneuro
git stash push -m "server-pre-redeploy-$(date +%F_%H%M)"
git fetch --all
git pull --ff-only
chmod +x scripts/*.sh
./scripts/04-redeploy.sh
'
```

**Hard reset then redeploy:**
```bash
sudo -u ubuntu -- bash -lc '
cd /home/ubuntu/omneuro
mkdir -p "/home/ubuntu/_backup_scripts_$(date +%F_%H%M)" && cp scripts/*.sh "/home/ubuntu/_backup_scripts_$(date +%F_%H%M)/" || true
git fetch origin main
git reset --hard origin/main
chmod +x scripts/*.sh
./scripts/04-redeploy.sh
'
```

---

### 6. Cross-References

- `OPS.md` → environment overview, repo path, user discipline  
- `CHECKLISTS.md` → pre-/post-deploy steps  
- `RUNBOOK.md` → failure recovery playbooks  
- `OBSERVABILITY.md` → logs/metrics standards  
```

---
### docs/ops/logs.md
```md
# logs.md

## Omneuro Logging Standards

Logs are our eyes. If we can’t see, we can’t operate.  
This file defines how logs are structured, filtered, and used.

---

### 1. Log Philosophy

- Logs are **for humans + AI**. Both must parse them clearly.  
- Structured JSON only.  
- No noise. If logs are unreadable → fix the logging, not the service.  

---

### 2. Levels

- **DEBUG** → Local dev only. Never ship to prod.  
- **INFO** → Normal service state.  
- **WARN** → Something off, but service still OK.  
- **ERROR** → Immediate human attention needed.  
- **FATAL** → Service crash. Must trigger alert.  

---

### 3. Observability Integration

- All logs stream into **CloudWatch**.  
- Local dev → `docker logs -f <service>`.  
- Health checks always log **success + failure**, never silently fail.  
- Logs tied directly to metrics + alerts (see `OBSERVABILITY.md`).  

---

### 4. Anti-Patterns

- **Do not** spam debug. Use selective, contextual logs.  
- **Do not** log secrets (tokens, passwords, API keys).  
- **Do not** rely only on stack traces — add context.  
- **Do not** leave logs unstructured.  

---

### 5. Rules from Lessons

- Always add request IDs to correlate across services.  
- Logs must be greppable.  
- Every retry/healthcheck logs both failure + eventual success.  
- Noise in logs = wasted cycles → trim aggressively.  
- Log rotation enforced; old logs auto-expire.  
- If you can’t explain a log line’s purpose, delete it.  

---

### 6. Debug Discipline

When debugging:  
1. Check health endpoints first.  
2. Tail logs with grep filters (don’t drown).  
3. Isolate one variable at a time.  
4. If nothing makes sense → sanity reset (`sanity.md`).  

---

**Final Note:**  
Logs are the most common source of wasted cycles.  
Follow these standards, and you’ll never drown again.  
```

---
### docs/ops/README-ops.md
```md
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
```

---
### docs/ops/sanity.md
```md
# sanity.md

## Omneuro Sanity Checklist

This file exists to keep us from thrashing.  
Before coding, deploying, or debugging, run through this checklist.

---

### 1. Personal Sanity

- Breathe. Don’t rush.  
- Confirm **what** you’re solving. Context first.  
- Separate **debug noise** from real development.  
- Never chase phantom bugs without verifying health checks.  
- If logs are unreadable → fix logging first, *then* debug.  

---

### 2. Service Sanity

- `brain-api` → curl `:8081/healthz`  
- `tech-gateway` → curl `:8092/api/tech/health`  
- If either fails: run `deploy-ops.sh` (handles retries + chmod fix).  
- Do **not** guess endpoints — only use canonical ones.  

---

### 3. Git + Deploy Sanity

- `git status` → repo is clean before pushing.  
- `git log` → confirm latest commit matches intent.  
- `deploy-ops.sh` → all green health before merging.  
- Never skip pipeline. Manual deploys = drift.  

---

### 4. AI/Human Sanity

- Confirm commands before running.  
- Keep copies of important configs (no ephemeral debug).  
- If confusion arises: stop, align, re-check rules.  
- Every lost cycle = a new rule in `RULES.md`.  

---

### 5. Sanity Rituals

- Keep deploys small.  
- Logs must stay clear (no wall-of-text debugging).  
- Always update documentation **as part of the work**, not later.  
- If frustrated → step back, check `sanity.md`.  

---

**Bottom line:**  
This file is the **panic brake**.  
When things feel messy, run through these steps and reset.  
```

---
### docs/ops/ssm.md
```md
# ssm.md

## Omneuro SSM (AWS Systems Manager) Standards

SSM is our single source of truth for secrets, configs, and runtime parameters.  
This file codifies every rule we learned to avoid AWS + IAM hell.

---

### 1. Philosophy

- **No secrets in code. Ever.**  
- **SSM Parameter Store is canonical.**  
- If it’s not in SSM, it doesn’t exist.  
- One source → many consumers (humans, AI, CI/CD).  

---

### 2. Setup + Access

- Parameters live in `/omneuro/{service}/{key}`.  
- Environments: `dev`, `staging`, `prod`.  
- **Use least privilege IAM roles**:  
  - Services → read-only scoped to their prefix.  
  - Humans → need explicit write perms.  
- No root account usage. Never.  

---

### 3. Secrets Discipline

- Tokens, DB creds, API keys → **SSM only**.  
- Rotate credentials quarterly (minimum).  
- Validate values after every change (`aws ssm get-parameter`).  
- Never copy-paste secrets into Slack, Git, or logs.  

---

### 4. Retrieval Rules

- Services pull secrets on startup.  
- No secret hardcoding in Docker images.  
- Local dev:  
  - `aws-vault` or `dotenv` → pull from SSM before running.  
  - Never hand-type creds.  

---

### 5. IAM Lessons Learned

- Wrong perms = wasted days.  
- Explicitly map which role can touch which path.  
- Avoid `AdministratorAccess` — lazy perms create dangerous drift.  
- Log every failed `AccessDenied` → fix IAM first, not code.  

---

### 6. Deployment + CI/CD

- Deploy pipeline injects env vars **from SSM only**.  
- No `.env` checked into git, not even local dev stubs.  
- `deploy-ops.sh` verifies required SSM keys exist before rolling out.  
- Missing secrets block deploys. Better to fail early than run broken.  

---

### 7. Observability + Auditing

- CloudTrail enabled for all `ssm:GetParameter` / `PutParameter`.  
- Alert on unusual access patterns.  
- Keep version history; never overwrite blindly.  
- Rotate and prune stale parameters regularly.  

---

### 8. Human/AI Workflow Rules

- If AI asks for a secret: **Never paste it.** Put in SSM.  
- If human copies/pastes creds into the wrong place → rotate immediately.  
- Debug cycles often wasted here — always check IAM + SSM first.  
- When in doubt: `aws ssm describe-parameters | grep <service>`.  

---

### 9. Anti-Patterns

- Secrets in `.gitignore` files → still a leak risk.  
- Storing creds in Lambda env vars manually.  
- Giving humans full `ssm:*` perms.  
- Forgetting to refresh SSM cache → leads to stale creds and silent errors.  

---

### 10. Sanity Rituals

- Every new service → SSM checklist:  
  - [ ] Create parameter path.  
  - [ ] Assign IAM role with least privilege.  
  - [ ] Test read from service.  
  - [ ] Document in `CONTRACTS.md`.  
- Rotate → test → commit → deploy.  

---

**Final Note:**  
Every bad AWS/SSM cycle cost us hours.  
Follow this doc and **we never relive that pain again.**  
```

---
### docs/README.md
```md
# omneuro docs

This folder is the source of truth for how we build, deploy, and operate omneuro.

## Index
- rules: `docs/rules.md`
- workflow: `docs/workflow.md`
- operations overview: `docs/ops/README.md`
  - deploy scripts & PM2: `docs/ops/deploy.md`
  - SSM sessions: `docs/ops/ssm.md`
  - logs (PM2 & CloudWatch): `docs/ops/logs.md`
  - sanity checks: `docs/ops/sanity.md`
- service notes
  - brain-api: `docs/dev/brain-api.md`
  - tech-gateway: `docs/dev/tech-gateway.md`

**Prime directive:** every code/infra change that affects behavior must update these docs *in the same PR*.
```

---
### docs/ROADMAP.md
```md

```

---
### docs/RULES.md
```md
# RULES.md

## Purpose
Omneuro development and operations are guided by hard rules.  
These rules exist because every one of them cost us time, energy, or clarity.  
They are designed to keep humans and AI in sync, avoid repeated mistakes,  
and enforce a disciplined, professional workflow.  

Rules are **non-negotiable**. They should be short, direct, and actionable.  

---

## Core Development Rules

1. **Logs before code** – Never debug blind. Insert logs at every service boundary before writing fixes.  
2. **Three-strike debug reset** – If the same test fails 3 times, stop. Re-check assumptions, logs, and contracts.  
3. **No phantom endpoints** – Every endpoint must exist in code, schema, and docs.  
4. **Contract-first discipline** – Schema and ADRs are the source of truth. Code must follow contracts, never the other way around.  
5. **Secrets are never in Git** – Always in `.secrets/` and ignored. Handle with SSM or environment injection.  
6. **Every deploy script is executable** – Scripts self-apply `chmod +x`.  
7. **Health checks are canonical** – Services must publish documented health endpoints.  
8. **Retry, don’t panic** – Health checks always retry with backoff before failing.  
9. **One source of truth per concept** – Contracts in `SCHEMA.md`, ops in `OPS.md`, observability in `OBSERVABILITY.md`. Never duplicate.  
10. **Cross-reference everything** – If a runbook entry, checklist, or rule exists, link it. Don’t fragment knowledge.  
11. **Single-block discipline** – All doc updates must be output in one fenced block containing the entire file. No plaintext spills, no partials.  
12. **Repo is the source of truth** – Always scan the repo first before editing code or docs. Never deprecate or overwrite without confirmation.  

---

## Human–AI Collaboration Rules

13. **Re-sync often** – When drift happens (human confuses AI, or AI forgets), re-read `README-ops.md` and docs.  
14. **Keep debug chatter out of docs** – Only clean knowledge makes it into the repo.  
15. **Don’t assume memory** – Always restate context when starting a dev session.  
16. **Humans confirm before execution** – AI can propose, human executes only after checking.  
17. **AI confirms before suggestion** – Never hallucinate commands; verify against docs or repo structure.  
18. **Noise filter discipline** – Retro lessons and chat noise must be distilled into rules, not left raw.  
19. **Document the fix** – Every resolved error path becomes a runbook entry.  
20. **One step at a time** – Don’t chain unverified fixes. Validate before moving.  

---

## Ops & AWS Rules

21. **Validate IAM first** – Most AWS failures are IAM-related. Always `aws sts get-caller-identity` before assuming code is wrong.  
22. **Check region always** – Many failures came from wrong AWS region. Default to `us-east-1` unless explicitly overridden.  
23. **SSM is strict** – Ensure agent is running, permissions are set, and parameters exist before deploying.  
24. **Logs are gold** – CloudWatch must always have logs. If silent, fix logging first.  
25. **Standard log groups** – Use canonical log group names, documented in `OBSERVABILITY.md`.  
26. **No manual AWS edits** – All infra changes go through Terraform/CDK or documented scripts.  
27. **Auto-logs, auto-deploy** – Deployment must emit logs by default; no silent pipelines.  
28. **ECS stabilization required** – Never trust a green until ECS tasks show healthy.  
29. **IAM least privilege** – Grant only what’s needed. Debug with admin, then roll back to minimal.  
30. **Token freshness** – Rotate and validate tokens before every deploy.  
31. **Correct user context** – All operational commands must be run as the `ubuntu` user with `sudo`. Running as `ssm-user` without escalation will fail.  
32. **Nginx/TLS consistency** – All site configs must validate with `nginx -t` and `/nginx-health` before deploy. Certbot is the canonical TLS manager.  

---

## Git & Workflow Rules

33. **Never reset without backup** – Git resets must not destroy `.secrets`, configs, or ADRs.  
34. **Commits are atomic** – One logical change per commit. Scripts, configs, and docs updated together.  
35. **Docs update with code** – Every change must include documentation.  
36. **ADR for every decision** – Major changes require an ADR entry.  
37. **Use feature branches** – Never commit experimental changes directly to main.  
38. **Pull, then chmod** – `redeploy.sh` must always reset its own perms after pull.  
39. **Check diff before push** – Avoid committing debug or noise.  
40. **No deploy without green tests** – All health checks must pass before production deploy.  
41. **Don’t repeat past mistakes** – If it’s in the runbook, check it before re-debugging.  

---

## Debugging Rules

42. **Start simple** – Always check permissions, regions, and logs before touching code.  
43. **Boundary testing** – Verify where the request fails: gateway, service, schema, or infra.  
44. **Instrument first** – Add metrics/tracing before deep debug loops.  
45. **Stop log blindness** – If logs don’t explain the failure, fix observability first.  
46. **No assumption loops** – Don’t spend cycles guessing. Validate with evidence.  
47. **Escalate after 3 cycles** – If stuck, escalate to ADR or retro.  
48. **Use structured logs** – Include request IDs, timestamps, correlation data.  
49. **Always curl the endpoint** – Don’t trust assumptions; test endpoints directly.  

---

## Cultural Rules

50. **Spartan docs** – Short, clear, referenceable. No fluff.  
51. **Respect the checklist** – Checklists exist because we failed without them. Use them.  
52. **Retro discipline** – Every sprint ends with a retro distilled into rules.  
53. **No startup chaos** – Move like professionals, not hobbyists.  
54. **Leave rope, not threats** – Communication (internal and external) is assertive but respectful.  

---

## Cross-References

- **OPS.md** – Operating principles, system-wide lessons.  
- **OBSERVABILITY.md** – Metrics, tracing, logs.  
- **CHECKLISTS.md** – Step-by-step sanity checks.  
- **RUNBOOK.md** – Recovery actions for failures.  
- **SCHEMA.md** – Contracts and definitions.  

---

✅ This file contains **the distilled discipline of Omneuro**.  
Follow these rules and you will not repeat our mistakes.  
Break them, and you will burn cycles we already paid for.  
```

---
### docs/RUNBOOK.md
```md
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
- **Diagnosis**: File not marked executable, or wrong user context.  
- **Fix**:  
  - Mark script executable:  
    ```bash
    chmod +x ./scripts/04-redeploy.sh
    ```  
  - Ensure you are running as `ubuntu` inside the canonical repo path:  
    ```bash
    sudo -u ubuntu -- bash -lc '
    cd /home/ubuntu/omneuro
    ./scripts/04-redeploy.sh
    '
    ```  
- **Prevention**: Deploy script now self-applies `chmod`. Rule added to `RULES.md`. Always confirm `ubuntu` context and `/home/ubuntu/omneuro` path in `CHECKLISTS.md`.  

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
  - Validate role and region.  
  - Refresh credentials.  
- **Prevention**: IAM validation step added to pre-deploy checklist.  

---

### 4. Phantom Endpoints / Wrong Routes  
- **Symptom**: `curl` returns `404` or `503` despite code changes.  
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
- **Diagnosis**: Service not yet healthy.  
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
- **Unclear system state** → Force redeploy from `/home/ubuntu/omneuro` using documented scripts.  

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
```

---
### docs/SCHEMA.md
```md
# SCHEMA-KB.md
> Omneuro Knowledge Base (KB) schema, ingestion contracts, and retrieval rules  
> Scope: PEV-focused service ops (no VINs; Make/Model taxonomy), multi-channel interactions (web, SMS, voice), artifacts (images, PDFs, logs), and RAG over curated + operational data.

---

## 0. Principles (MUST/SHOULD)
- One source of truth: Contracts live here; code follows. No phantom fields.
- PEV-first identifiers: No VIN. Use (make, model, year?, variant?, serial?).
- Upsert everywhere: Idempotent by stable id + source_fingerprint.
- Lineage & audit: Every record carries source, created_by, updated_by, ingested_at, lineage.
- PII minimalism: Collect only what’s needed; tag & encrypt-at-rest; redact in embeddings.
- Human-in-the-loop gates: Any auto-knowledge added to “LIVE” must pass review or come from allowlisted sources.
- Retrieval with citations: Always return provenance links; never “knowledge without a source”.

---

## 1. Canonical Entities

### 1.1 Client
    {
      "id": "cli_7RZ2…",
      "email": "juicejunkiezmd@gmail.com",
      "phone_e164": "+19512968725",
      "name": "First Last",
      "preferred_contact": "sms|email|call",
      "addresses": [
        { "type": "dropoff", "line1": "409 S Addison St", "city": "Baltimore", "region": "MD", "postal":"", "country":"US" }
      ],
      "consents": {
        "marketing": false,
        "sms": true,
        "voice_recording": true,
        "data_sharing_research": false
      },
      "tags": ["vip","repeat"],
      "created_at": "2025-08-30T20:10:00Z",
      "updated_at": "2025-08-31T01:22:11Z",
      "lineage": {"source":"garage-ui|telnyx|import","source_id":"…"}
    }

### 1.2 PEV (Vehicle)
    {
      "id": "pev_KS0…",
      "client_id": "cli_7RZ2…",
      "make": "Begode",
      "model": "Master",
      "model_year": 2023,
      "variant": "High Torque",
      "serial": "BGM-123456",
      "color": "black",
      "mileage_km": 2100,
      "notes": "Aftermarket controller",
      "created_at": "…",
      "updated_at": "…",
      "taxonomy": {
        "category": "EUC|E-Bike|E-Scooter|Other",
        "battery_format": "custom|21700|18650|LFP|…",
        "voltage_class": "100V|126V|…"
      }
    }

### 1.3 WorkOrder / Job
    {
      "id": "job_9QW…",
      "client_id": "cli_…",
      "pev_id": "pev_…",
      "status": "intake|diagnosing|awaiting_parts|in_progress|awaiting_payment|ready|delivered|canceled",
      "intake": {
        "symptoms": ["no power", "overheat at 30mph"],
        "priority": "normal|rush|emergency",
        "dropoff_slot": "2025-09-02T14:00:00Z"
      },
      "estimates": [
        {"id":"est_1","parts_total": 320.00,"labor_hours": 2.5,"labor_rate": 110,"fees": 15}
      ],
      "approved": true,
      "assigned_to": "tech_id|name",
      "events": [
        {"ts":"…","type":"status_changed","from":"intake","to":"diagnosing","by":"system|user_id"}
      ],
      "created_at":"…","updated_at":"…","lineage":{"source":"garage-ui"}
    }

### 1.4 Interaction (Omnichannel)
    {
      "id": "ixn_CaL…",
      "client_id": "cli_…",
      "job_id": "job_…",
      "channel": "chat_web|sms|voice|email",
      "direction": "inbound|outbound",
      "ts": "2025-09-01T17:00:00Z",
      "content_text": "Client: wheel shuts off on bumps",
      "content_html": null,
      "attachments": [
        {"artifact_id":"art_…","kind":"image|pdf|log"}
      ],
      "nlp": {
        "intents": ["report_issue"],
        "entities": {"model":"Master","speed_kmh":48},
        "pii_tags": ["phone","name"]
      },
      "provenance": {"provider":"Telnyx|OpenAI","external_id":"msg_…"},
      "redaction": {"policy":"v1","applied":true}
    }

### 1.5 Artifact (Binary)
    {
      "id": "art_PDf…",
      "kind": "image|pdf|audio|video|log|schematic",
      "mime": "image/png",
      "bytes": 812345,
      "storage_url": "s3://omneuro-prod-artifacts/…/jjz-logo.png",
      "hash_sha256": "…",
      "labels": ["wiring","controller","proof-of-dropoff"],
      "created_at":"…","uploaded_by":"tech|client|system"
    }

### 1.6 Knowledge Item (Curated or Mined)
    {
      "id": "kb_BeGoDeMaster_wiring_v1",
      "kind": "howto|known_issue|wiring|part_ref|sop",
      "title": "Begode Master Wiring Diagram (2023)",
      "pev_signature": {"make":"Begode","model":"Master","year":2023,"variant":"*"},
      "body_md": "…",
      "sources": [
        {"type":"manual","url":"…"},
        {"type":"internal_note","artifact_id":"art_…"}
      ],
      "citations": [{"span":[120,240],"source_idx":0}],
      "confidence": 0.92,
      "status": "draft|review|live|deprecated",
      "owner": "lead-tech",
      "created_at":"…","updated_at":"…","version":"1.3.2"
    }

### 1.7 Embedding Chunk (RAG)
    {
      "id": "emb_8s…",
      "kb_id": "kb_BeGoDeMaster_wiring_v1",
      "chunk_ix": 3,
      "text": "To access controller…",
      "vector_1536": "base64-encoded or provider-native ref",
      "model": "text-embedding-3-large",
      "dims": 3072,
      "provenance": {"kb_version":"1.3.2","chunker":"v2","hash":"…"},
      "pii_scrubbed": true,
      "created_at":"…"
    }

---

## 2. Identity & Keys
- IDs: cli_, pev_, job_, ixn_, art_, kb_, emb_.
- Natural keys:
  - Client: email or phone_e164 (normalized).
  - PEV: (client_id, make, model, serial?) unique.
  - Knowledge scoping: pev_signature drives retrieval filters.

---

## 3. Ingestion Pipelines

### 3.1 Sources (allowlist)
- Telnyx (SMS/voice transcripts + recordings)
- OpenAI (tool results, assistant messages – content we generate)
- Manual Upload (tech portal)
- Shop (product manuals/specs)
- Public Docs (only via curated import with source URLs)

### 3.2 Stages
1) Collect → store raw in S3 (s3://omneuro-prod-raw/{source}/{date}/…), write Artifact.  
2) Extract → OCR/transcribe; produce text + pages + timespans.  
3) Normalize → to Interaction or Knowledge Item draft; attach provenance.  
4) PII Scrub → mask personal fields in text destined for embeddings.  
5) Chunk → windowed, overlap 128–256 tokens; keep citations spans where possible.  
6) Embed → OpenAI text-embedding-3-large (configurable); produce Embedding Chunk.  
7) Index → upsert in vector store (pgvector or external).  
8) Promote → draft→review→live with owner approval (unless source is allowlisted SOP).

### 3.3 Dedup
- Compute source_fingerprint = sha256(normalized_text + canonical_source_url); reject duplicates.
- If kb_id exists and hash changed, version bump and create new embeddings; keep old for historical answers until deprecated.

---

## 4. Retrieval (RAG) Contract

### 4.1 Query Envelope
    {
      "actor": "client|tech|system",
      "scope": {
        "client_id": "cli_…",
        "pev_signature": {"make":"Begode","model":"Master","year":null,"variant":"*"},
        "job_id": "job_…"
      },
      "question": "How do I diagnose overheat cutouts on a Begode Master?",
      "top_k": 8,
      "filters": {"kind": ["howto","known_issue"], "status": "live"},
      "must_cite": true,
      "safety": {"no_pii_leak": true}
    }

### 4.2 Answer Envelope
    {
      "answer_md": "…",
      "citations": [
        {"kb_id":"kb_…","title":"…","source":{"type":"manual","url":"…"},"chunk_ix":3,"score":0.82}
      ],
      "used_embeddings_model": "text-embedding-3-large",
      "guardrails": {"pii_check": "passed","scope_check":"ok"},
      "latency_ms": 430
    }

### 4.3 Guardrails
- Scope enforcement: If actor=client, exclude internal notes unless explicitly whitelisted (status=client_safe).
- PII scrub: Ensure returned snippets do not include other clients’ PII.
- PEV routing: Prefer documents matching (make, model); soft-boost by year, variant.

---

## 5. Permissions & Visibility
- Roles: owner, lead-tech, tech, csr, client, system.
- Visibility tags: internal, client_safe, billing, legal_hold.
- Row-level rules:
  - Client sees only (client_id=self) + client_safe knowledge.
  - Tech sees all live, drafts if owner/lead-tech or author.
  - Voice/SMS transcripts default internal until reviewed.

---

## 6. PII/Retention
- PII tags: email, phone, address, payment, voiceprint, plate?, serial?.
- Embedding scrub: Replace PII with semantic placeholders before vectorization.
- Retention:
  - interaction.audio: 12 months (configurable).
  - billing: per tax requirements.
  - legal_hold: indefinite until cleared.

---

## 7. Storage Layout (AWS)
- S3 buckets:
  - omneuro-prod-artifacts (public: false)
    - /raw/{source}/YYYY/MM/DD/{uuid}.{ext}
    - /derived/{artifact_id}/text.json
    - /kb/{kb_id}/v{semver}/{files}
- SSM Parameters (SecureString):
  - /omneuro/openai/api_key
  - /omneuro/google/api_key
  - /omneuro/telnyx/api_key
  - /omneuro/vector/pg_url (if using RDS + pgvector)
- KMS: CMK for SSM + S3 SSE-KMS; role OmneuroSSMRole allowed kms:Decrypt.

---

## 8. Indexing & Vector Store
- Option A (preferred): Postgres + pgvector
  - Table embeddings(id, kb_id, chunk_ix, text, vector, dims, pii_scrubbed, created_at)
  - HNSW index or IVF on vector
- Option B: Managed vector (e.g., Elastic, Pinecone); keep id alignment and provenance.

---

## 9. APIs (tech-gateway ↔ brain-api)

### 9.1 Ingestion
POST /v1/kb/ingest
    {
      "source": "manual|tech-note|transcript",
      "pev_signature": {"make":"Begode","model":"Master"},
      "title": "Controller thermal limits",
      "body_md": "…",
      "artifacts": ["art_…"],
      "allowlist_auto_live": false
    }
Response ⇒ { "kb_id":"kb_…", "version":"1.0.0" }

### 9.2 Query
POST /v1/kb/query accepts the Query Envelope above.

### 9.3 Link PEV to Knowledge
POST /v1/pev/{pev_id}/link-kb ⇒ { "kb_id":"kb_…" }

### 9.4 Interaction Log
POST /v1/interaction with the Interaction contract.

---

## 10. Events & Webhooks
- Events: job.status_changed, pev.added, kb.promoted, invoice.paid, call.transcribed.
- Webhook format:
    {
      "id":"evt_…",
      "type":"kb.promoted",
      "ts":"…",
      "data":{"kb_id":"kb_…","version":"1.3.2"},
      "signature":"hmac-sha256(base64)"
    }

---

## 11. Observability & QA
- Logs: Structured JSON with req_id, actor, entity, action, status, latency_ms.
- Metrics: kb_ingest_latency, kb_chunks, kb_dedup_hits, rag_hit_rate, guardrail_blocks.
- Health checks: /healthz (brain-api, tech-gateway), /api/kb/health returns index status.
- Canary queries: Nightly: 10 representative (make,model) prompts; alert on retrieval regressions.

---

## 12. Versioning & Deprecation
- Semantic versions on Knowledge Item.
- Promotion rules:
  - draft → review (owner/lead-tech)
  - review → live (owner)
  - live → deprecated (superseded or unsafe)
- Never hard-delete knowledge; tombstone with status:"deprecated" and replaced_by.

---

## 13. Client Garage Hooks
- When client adds a PEV:
  - Create pev record
  - Emit pev.added → trigger knowledge.prefetch for (make,model)
  - Prefetch artifacts (manuals/specs), create initial kb entries (status=review)
- When job created/updated:
  - Index diagnostic notes as tech-note (internal by default)
  - Promote resolved steps that are generalizable to howto after review

---

## 14. Security Notes
- No secrets in git; read via SSM in runtime.
- Signed webhooks (HMAC with SSM-stored secret).
- Role separation: owner can promote/deprecate; tech cannot publish live.

---

## 15. Minimal Seed Taxonomy (PEV)
    {
      "makes": ["Begode","Inmotion","Leaperkim","King Song","Segway-Ninebot","Specialized","Trek","Other"],
      "models": {
        "Begode": ["Master","T4","EX30","RS","Other"],
        "Inmotion": ["V11","V12","V13","S1","Other"],
        "Leaperkim": ["Sherman","Patton","Abrams","Other"]
      },
      "categories": ["EUC","E-Bike","E-Scooter","Other"]
    }

---

## 16. Open Questions (track via ADR)
- Attach confidence & safety signals to answers and expose to UI?
- Multi-tenant future: namespace all IDs by org_id?
- Client-initiated data deletion + vector reindexing strategy (GDPR-like erasure)?

---

## 17. Quick Contracts Summary (for implementers)
- Create KB: POST /v1/kb/ingest → kb_id
- Promote KB: POST /v1/kb/{kb_id}/promote body {to:"review|live|deprecated"}
- Query KB: POST /v1/kb/query → {answer_md, citations[]}
- Log Interaction: POST /v1/interaction
- Add PEV (Garage): POST /v1/pev → emits pev.added (triggers prefetch)

---

## 18. Changelog
- 2025-09-01: Initial KB schema aligned with PEV (no VIN), omnichannel intake, RAG with citations, SSM-backed secrets, and client garage hooks.
```

---
### docs/secrets.md
```md
# Secrets

Omneuro uses AWS SSM Parameter Store for secret management.  
All secrets are stored as SecureString and never committed to the repo.

---

## Paths

- /omneuro/openai/api_key — OpenAI project API key
- /omneuro/google/api_key — Google API key
- /omneuro/google/client_id — Google OAuth client ID
- /omneuro/google/client_secret — Google OAuth client secret
- (future) /omneuro/telnyx/api_key — Telnyx API key

---

## IAM Policy

Attach inline policy to OmneuroSSMRole:

{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:GetParameters",
        "ssm:GetParametersByPath",
        "ssm:DescribeParameters"
      ],
      "Resource": "arn:aws:ssm:us-east-2:<ACCOUNT_ID>:parameter/omneuro/*"
    },
    {
      "Effect": "Allow",
      "Action": ["kms:Decrypt", "kms:DescribeKey"],
      "Resource": "arn:aws:kms:us-east-2:<ACCOUNT_ID>:key/<KMS-KEY-ID>"
    }
  ]
}

---

## Usage

- tech-gateway  
  Reads OMNEURO_OPENAI_API_KEY_PARAM (default: /omneuro/openai/api_key) at runtime,  
  fetches the value from SSM, and caches in memory.  
  Requires AWS_REGION to be set (us-east-2).

- brain-api  
  May later consume Google or Telnyx keys for additional integrations.

---

## Guidelines

1. Always create new secrets in SSM with --type SecureString and --with-key-id if KMS required.  
2. Never commit actual values to GitHub or logs.  
3. Reference secrets by SSM path in code or configs.  
4. Rotate sensitive keys (OpenAI, Stripe, Telnyx, Google) regularly.  
5. Verify permissions after adding new parameters — missing ssm:GetParameter or kms:Decrypt will break runtime.  

---

## Necessity Explanation

Secrets management is central to Omneuro’s reliability and security:

- Ensures no plaintext secrets exist in code or repo.  
- Centralizes control with AWS IAM, making auditing and rotation easier.  
- Supports multiple environments (dev, staging, prod) by using different SSM paths.  
- Prevents accidental leakage in logs, client builds, or browser output.  
- Simplifies redeployments: apps fetch secrets live at runtime, not from baked configs.  

---

## Example Workflow

1. Store a new secret:

aws ssm put-parameter \
  --name "/omneuro/openai/api_key" \
  --type SecureString \
  --value "sk-..." \
  --overwrite

2. Verify secret is present:

aws ssm get-parameter \
  --name "/omneuro/openai/api_key" \
  --with-decryption

3. Redeploy app to pick up new secret:

cd ~/omneuro
./scripts/04-redeploy.sh

---

## Notes

- Secrets are fetched at runtime (not build time).  
- If a secret is missing or permissions are wrong, the app logs will show:

[ssm] get-parameter failed: name=/omneuro/openai/api_key region=us-east-2

- In such cases, check:  
  - IAM role OmneuroSSMRole has ssm:GetParameter and kms:Decrypt.  
  - Parameter exists in SSM at the expected path.  
  - AWS_REGION is correctly set in environment (default: us-east-2).  

```

---
### docs/services.md
```md
# SERVICES.md

## Services

### tech-gateway
- **Port:** `8092`
- **Health:** `GET /healthz`, `GET /api/tech/health`
- **Fronted by Nginx:** `https://tech.juicejunkiez.com`
- **Notes:** runs under PM2 (see PM2 section)

### brain-api
- **Port:** `8081`
- **Health:** `GET /healthz`
- **Access:** internal only (proxied by tech-gateway for app flows)

---

## PM2

We observed PM2 HOME as `/etc/.pm2` (root context).  
For consistency, we will standardize to **ubuntu** in a future maintenance window:

**Target state:**
- PM2 HOME: `/home/ubuntu/.pm2`
- Owner: `ubuntu:ubuntu`
- Processes started via SSM/PM2 as `ubuntu` with `HOME=/home/ubuntu`.

### Discovery helpers
```bash
PM2_HOME=/etc/.pm2 pm2 jlist
PM2_HOME=/home/ubuntu/.pm2 pm2 jlist
```

---
### docs/TLS.md
```md
# TLS.md

## Let’s Encrypt

- **Issued for:** `tech.juicejunkiez.com`
- **Issuer:** Let’s Encrypt
- **Certificate path:** `/etc/letsencrypt/live/tech.juicejunkiez.com/fullchain.pem`
- **Private key path:** `/etc/letsencrypt/live/tech.juicejunkiez.com/privkey.pem`
- **Expires:** 2025-11-27 (auto-renew enabled via `certbot.timer`)
- **Renewal service:** `systemctl status certbot.timer`
- **Renewal logs:** `journalctl -u certbot`

### Verify certificate & health

```bash
# Check HTTPS response headers (should be 200 from healthz)
curl -I https://tech.juicejunkiez.com/healthz

# Optional: show certificate chain details
echo | openssl s_client -servername tech.juicejunkiez.com -connect tech.juicejunkiez.com:443 2>/dev/null | openssl x509 -noout -issuer -subject -dates

Notes
	•	Nginx listens on port 80 for ACME HTTP challenges and general redirects; TLS termination is on 443.
	•	Certificates are stored under /etc/letsencrypt/live/; do not commit or copy keys into the repo.
	•	If renewal fails, check DNS records and ensure port 80 is reachable from the internet.
```

---
### docs/WORKFLOW.md
```md
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
   ```bash
   git add -A
   git commit -m "Message"
   git push
   ```

4. **Deploy**  
   - Connect via SSM:  
     ```bash
     aws ssm start-session --region us-east-2 --target <instance-id>
     ```  
   - Switch to ubuntu user:  
     ```bash
     sudo -i -u ubuntu
     cd ~/omneuro
     ```  
   - Run the canonical redeploy:  
     ```bash
     ./scripts/04-redeploy.sh
     ```  
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
```
