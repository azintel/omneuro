# omneuro rules (v1.0 → foundation for 2.0)

## 1) Tiny, deterministic, self-reporting steps
- Scripts and commands must print what they’re doing and hard-fail on errors.
- Break large operations into small steps with visible outputs.

## 2) Repo-first, docs-with-code
- All changes that affect behavior must update docs and scripts in the same PR.
- No one-off commands that aren’t codified in `scripts/` and explained in docs.

## 3) Single source of truth
- Environment, ports, process names, and service URLs live in the repo (README + service docs).
- Avoid “tribal knowledge”—if it matters, write it down.

## 4) Path discipline
- In SSM, **no tildes**; use absolute paths under `/home/ubuntu/omneuro`.
- Locally, use the repo root and service subfolders—do not write outside the tree.

## 5) Explicit versions and engines
- Node 18+ (ideally 20+). Enforce via `"engines"` in package.json.
- Express v5, ESM imports, TypeScript compiler pinned per repo tsconfig.

## 6) Ports and listeners
- brain-api: `PORT=8081`
- tech-gateway: `PORT=8092` and `BRAIN_API_URL=http://localhost:8081`
- Update both the PM2 config (or start cmd) and sanity checks when you change ports.

## 7) PM2 only (for now)
- All services run under PM2 with explicit names. No ad-hoc `node file.js`.
- Restart only via scripts and verify via sanity checks.

## 8) Logging
- PM2 logs to `~/.pm2/logs`.
- CloudWatch Agent ships `/home/ubuntu/.pm2/logs/*` to `/omneuro/<service>`. Streams: `{instance_id}/out` and `{instance_id}/error`.
- Scripts must include tail/describe commands with clear outputs.

## 9) SSM sessions
- Always print user/host/date/node/pm2 at session start.
- Never assume default directories; `cd` explicitly and verify with `pwd`.

## 10) Script maintenance rule
- If repo structure, build commands, or processes change, update:
  - `scripts/deploy/*`
  - docs (this file + relevant ops/dev docs)
  - sanity checks

## 11) Git flow
- Feature branches → PR → review → merge `main`.
- PR must include scripts + docs if behavior changes.
- Tag releases when we cut a milestone (e.g., `v1.0.0`, `v2.0.0`).

## 12) Sanity first
- After any deploy/restart: run `03-sanity.sh`. Green or it didn’t happen.

## 13) CI later, scripts now
- Until CI/CD is in place, scripts are the contract. Keep them clean and deterministic.