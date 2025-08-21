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