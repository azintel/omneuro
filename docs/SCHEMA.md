# Omneuro Data Model (v0.1)

## Principles
- Single source of truth in brain-api; gateway is stateless/edge.
- Event-first: every meaningful action emits an Event for the KB.
- Start with SQLite for speed, migrate to Postgres when scale requires.

## Entities (MVP)
### techs
- id (text, pk)
- name (text)
- phone (text)
- email (text)
- active (int/bool)
- created_at (text ISO)
- updated_at (text ISO)

### clients
- id (text, pk)
- name (text)
- phone (text)
- email (text)
- preferred_channel (text: sms|email|call)
- created_at, updated_at

### jobs
- id (text, pk)
- client_id (text -> clients.id)
- title (text)
- status (text: intake|scheduled|onsite|repairing|ready|shipped|closed|cancelled)
- scheduled_for (text ISO)
- assigned_tech_id (text -> techs.id)
- location (text)
- notes (text)
- created_at, updated_at

### messages
- id (text, pk)
- job_id (text -> jobs.id) nullable
- tech_id (text -> techs.id) nullable
- client_id (text -> clients.id) nullable
- direction (text: inbound|outbound)
- channel (text: chat|sms|email|phone)
- body (text)
- ts (text ISO)
- meta (json)

### events
- id (text, pk)
- kind (text: job.status.changed|tech.message|client.message|schedule.created|payment.*|kb.ingest)
- actor (text: tech:<id>|client:<id>|system)
- ref_type (text: job|client|tech)
- ref_id (text)
- payload (json)
- ts (text ISO)

### schedule
- id (text, pk)
- job_id (text -> jobs.id)
- tech_id (text -> techs.id)
- start_ts (text ISO)
- end_ts (text ISO)
- status (text: planned|confirmed|done|cancelled)
- meta (json)

### kb_entries
- id (text, pk)
- source_event_id (text -> events.id)
- type (text: faq|howto|diag|part|note)
- title (text)
- body (text)
- tags (text)
- ts (text ISO)
- embedding (blob/json) [future]

## Indices
- jobs(client_id), jobs(status), jobs(scheduled_for)
- messages(job_id, ts)
- events(ref_type, ref_id, ts)
- schedule(tech_id, start_ts)

## Event flow
- Any gateway action → brain-api endpoint → domain change → write to events → optional projection into jobs/messages/schedule/kb_entries.

## Migrations
- SQLite: simple `ALTER TABLE`/“create new table + copy”.
- Plan for Postgres: pg-migrate or Prisma later.