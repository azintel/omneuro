# Observability — Logs, Health, Correlation

## Logs
- PM2 writes: `/home/ubuntu/.pm2/logs/<module>-{out,err}.log`
- CloudWatch groups: `/omneuro/<module>`
- Streams: `<instance-id>/{out,err}`
- Force flush: agent config `force_flush_interval: 5`

## Recommended log shape (JSON lines)
{
  "ts": "2025-08-20T01:30:00Z",
  "lvl": "info",
  "svc": "tech-gateway",
  "msg": "forward message",
  "req_id": "rg_abc123",
  "job_id": "J-42",
  "tech_id": "t-123"
}

## Correlation
- Generate `req_id` at the gateway per incoming request; forward as header `x-request-id` to brain-api.
- Include `req_id` in all log statements on both services.

## Health
- Liveness: `/healthz` returns `{ok:true}`
- Diagnostics: `/admin/diag?key=<secret>` returns tail of PM2 logs and basic flags.