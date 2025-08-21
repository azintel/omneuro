omneuro/docs/ops/sanity.md
```md
# sanity checks (post-deploy)

## brain-api direct
```bash
curl -iS http://localhost:8081/healthz

curl -iS -X POST http://localhost:8081/v1/repairbot/message \
  -H 'content-type: application/json' \
  -d '{"techId":"t-123","jobId":"J-42","message":"Arrived","ts":"2025-08-20T18:10:00Z"}'

curl -iS -X PATCH http://localhost:8081/v1/jobs/J-42/status \
  -H 'content-type: application/json' \
  -d '{"status":"onsite","note":"battery triage","ts":"2025-08-20T18:12:00Z"}'