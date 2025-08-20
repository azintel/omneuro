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