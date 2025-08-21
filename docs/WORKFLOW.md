# workflow

## Local dev
1. Use Node 20+.
2. `npm i && npm run build` in each service you touch.
3. Run locally and hit health/routes before committing.

## Commit discipline
- Update docs/scripts in the same PR as code changes.
- Include exact sanity steps in PR description.

## Deploy (manual via SSM, until CI)
1. Start SSM (see `docs/ops/ssm.md`).
2. Run `scripts/deploy/01-build.sh`.
3. Run `scripts/deploy/02-restart.sh`.
4. Run `scripts/deploy/03-sanity.sh`.
5. If any step fails, stop and fix—no silent retries.

## Hotfix
- Same as deploy, but branch off `main`, push PR, merge, deploy.
- If absolutely necessary, apply a minimal hotfix and immediately codify & document.

## Logging
- PM2: check recent lines.
- CloudWatch: use `aws logs tail` and `describe-log-streams` as documented.

## After-action
- If we learned something, add/adjust a rule and update docs.