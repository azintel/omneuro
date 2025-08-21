omneuro/docs/ops/readme-ops.md

# operations overview

- Deployment: `docs/ops/deploy.md`
- SSM sessions: `docs/ops/ssm.md`
- Logs (PM2 & CloudWatch): `docs/ops/logs.md`
- Sanity checks: `docs/ops/sanity.md`

**Golden path:** SSM → build → restart → sanity → logs (only if needed).