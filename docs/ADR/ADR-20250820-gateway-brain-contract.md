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