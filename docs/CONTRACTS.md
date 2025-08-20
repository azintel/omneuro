POST /api/tech/message

{
  "techId": "t-123",
  "jobId": "J-42",
  "message": "Arrived on site",
  "ts": "2025-08-20T01:25:00Z"
}

→ Forwards to BRAIN_API_URL/v1/repairbot/message.

PATCH /api/tech/jobs/:id/status

{ "status": "onsite", "note": "battery triage", "ts": "2025-08-20T01:30:00Z" }

→ Forwards to BRAIN_API_URL/v1/jobs/:id/status.
