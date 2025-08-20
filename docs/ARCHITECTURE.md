Omneuro – Architecture & Ops Pack (v0.2)

Living doc set to keep context across chats. Treat this as the single source of truth (SSOT). Update in small commits alongside code.

⸻

0) Repo Snapshot (to be auto-synced)

Status: awaiting repo URL to pull tree + fill this section.

Planned sections once synced:
	•	Tree (top-level + key subdirs)
	•	Service map (brain-api, tech-gateway, cron/scheduler, infra)
	•	Env/ports matrix
	•	Shared models/types locations
	•	Scripts/tools (deploy, logs, verify)

TODO: Paste repo URL → we’ll pull and pin the current structure here.

⸻

1) System Overview
	•	User surfaces: Tech chat (via tech-gateway HTTP API), Client web portal (TBD), Phone/SMS (Twilio TBD)
	•	Core services: brain-api (domain logic + RepairBot), tech-gateway (edge, auth, fan‑out), scheduler (TBD), kb-indexer (TBD)
	•	Observability: PM2 + CloudWatch logs (/omneuro/<module>), /healthz, /admin/diag

