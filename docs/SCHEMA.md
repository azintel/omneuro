# SCHEMA-KB.md
> Omneuro Knowledge Base (KB) schema, ingestion contracts, and retrieval rules  
> Scope: PEV-focused service ops (no VINs; Make/Model taxonomy), multi-channel interactions (web, SMS, voice), artifacts (images, PDFs, logs), and RAG over curated + operational data.

---

## 0. Principles (MUST/SHOULD)
- One source of truth: Contracts live here; code follows. No phantom fields.
- PEV-first identifiers: No VIN. Use (make, model, year?, variant?, serial?).
- Upsert everywhere: Idempotent by stable id + source_fingerprint.
- Lineage & audit: Every record carries source, created_by, updated_by, ingested_at, lineage.
- PII minimalism: Collect only what’s needed; tag & encrypt-at-rest; redact in embeddings.
- Human-in-the-loop gates: Any auto-knowledge added to “LIVE” must pass review or come from allowlisted sources.
- Retrieval with citations: Always return provenance links; never “knowledge without a source”.

---

## 1. Canonical Entities

### 1.1 Client
    {
      "id": "cli_7RZ2…",
      "email": "juicejunkiezmd@gmail.com",
      "phone_e164": "+19512968725",
      "name": "First Last",
      "preferred_contact": "sms|email|call",
      "addresses": [
        { "type": "dropoff", "line1": "409 S Addison St", "city": "Baltimore", "region": "MD", "postal":"", "country":"US" }
      ],
      "consents": {
        "marketing": false,
        "sms": true,
        "voice_recording": true,
        "data_sharing_research": false
      },
      "tags": ["vip","repeat"],
      "created_at": "2025-08-30T20:10:00Z",
      "updated_at": "2025-08-31T01:22:11Z",
      "lineage": {"source":"garage-ui|telnyx|import","source_id":"…"}
    }

### 1.2 PEV (Vehicle)
    {
      "id": "pev_KS0…",
      "client_id": "cli_7RZ2…",
      "make": "Begode",
      "model": "Master",
      "model_year": 2023,
      "variant": "High Torque",
      "serial": "BGM-123456",
      "color": "black",
      "mileage_km": 2100,
      "notes": "Aftermarket controller",
      "created_at": "…",
      "updated_at": "…",
      "taxonomy": {
        "category": "EUC|E-Bike|E-Scooter|Other",
        "battery_format": "custom|21700|18650|LFP|…",
        "voltage_class": "100V|126V|…"
      }
    }

### 1.3 WorkOrder / Job
    {
      "id": "job_9QW…",
      "client_id": "cli_…",
      "pev_id": "pev_…",
      "status": "intake|diagnosing|awaiting_parts|in_progress|awaiting_payment|ready|delivered|canceled",
      "intake": {
        "symptoms": ["no power", "overheat at 30mph"],
        "priority": "normal|rush|emergency",
        "dropoff_slot": "2025-09-02T14:00:00Z"
      },
      "estimates": [
        {"id":"est_1","parts_total": 320.00,"labor_hours": 2.5,"labor_rate": 110,"fees": 15}
      ],
      "approved": true,
      "assigned_to": "tech_id|name",
      "events": [
        {"ts":"…","type":"status_changed","from":"intake","to":"diagnosing","by":"system|user_id"}
      ],
      "created_at":"…","updated_at":"…","lineage":{"source":"garage-ui"}
    }

### 1.4 Interaction (Omnichannel)
    {
      "id": "ixn_CaL…",
      "client_id": "cli_…",
      "job_id": "job_…",
      "channel": "chat_web|sms|voice|email",
      "direction": "inbound|outbound",
      "ts": "2025-09-01T17:00:00Z",
      "content_text": "Client: wheel shuts off on bumps",
      "content_html": null,
      "attachments": [
        {"artifact_id":"art_…","kind":"image|pdf|log"}
      ],
      "nlp": {
        "intents": ["report_issue"],
        "entities": {"model":"Master","speed_kmh":48},
        "pii_tags": ["phone","name"]
      },
      "provenance": {"provider":"Telnyx|OpenAI","external_id":"msg_…"},
      "redaction": {"policy":"v1","applied":true}
    }

### 1.5 Artifact (Binary)
    {
      "id": "art_PDf…",
      "kind": "image|pdf|audio|video|log|schematic",
      "mime": "image/png",
      "bytes": 812345,
      "storage_url": "s3://omneuro-prod-artifacts/…/jjz-logo.png",
      "hash_sha256": "…",
      "labels": ["wiring","controller","proof-of-dropoff"],
      "created_at":"…","uploaded_by":"tech|client|system"
    }

### 1.6 Knowledge Item (Curated or Mined)
    {
      "id": "kb_BeGoDeMaster_wiring_v1",
      "kind": "howto|known_issue|wiring|part_ref|sop",
      "title": "Begode Master Wiring Diagram (2023)",
      "pev_signature": {"make":"Begode","model":"Master","year":2023,"variant":"*"},
      "body_md": "…",
      "sources": [
        {"type":"manual","url":"…"},
        {"type":"internal_note","artifact_id":"art_…"}
      ],
      "citations": [{"span":[120,240],"source_idx":0}],
      "confidence": 0.92,
      "status": "draft|review|live|deprecated",
      "owner": "lead-tech",
      "created_at":"…","updated_at":"…","version":"1.3.2"
    }

### 1.7 Embedding Chunk (RAG)
    {
      "id": "emb_8s…",
      "kb_id": "kb_BeGoDeMaster_wiring_v1",
      "chunk_ix": 3,
      "text": "To access controller…",
      "vector_1536": "base64-encoded or provider-native ref",
      "model": "text-embedding-3-large",
      "dims": 3072,
      "provenance": {"kb_version":"1.3.2","chunker":"v2","hash":"…"},
      "pii_scrubbed": true,
      "created_at":"…"
    }

---

## 2. Identity & Keys
- IDs: cli_, pev_, job_, ixn_, art_, kb_, emb_.
- Natural keys:
  - Client: email or phone_e164 (normalized).
  - PEV: (client_id, make, model, serial?) unique.
  - Knowledge scoping: pev_signature drives retrieval filters.

---

## 3. Ingestion Pipelines

### 3.1 Sources (allowlist)
- Telnyx (SMS/voice transcripts + recordings)
- OpenAI (tool results, assistant messages – content we generate)
- Manual Upload (tech portal)
- Shop (product manuals/specs)
- Public Docs (only via curated import with source URLs)

### 3.2 Stages
1) Collect → store raw in S3 (s3://omneuro-prod-raw/{source}/{date}/…), write Artifact.  
2) Extract → OCR/transcribe; produce text + pages + timespans.  
3) Normalize → to Interaction or Knowledge Item draft; attach provenance.  
4) PII Scrub → mask personal fields in text destined for embeddings.  
5) Chunk → windowed, overlap 128–256 tokens; keep citations spans where possible.  
6) Embed → OpenAI text-embedding-3-large (configurable); produce Embedding Chunk.  
7) Index → upsert in vector store (pgvector or external).  
8) Promote → draft→review→live with owner approval (unless source is allowlisted SOP).

### 3.3 Dedup
- Compute source_fingerprint = sha256(normalized_text + canonical_source_url); reject duplicates.
- If kb_id exists and hash changed, version bump and create new embeddings; keep old for historical answers until deprecated.

---

## 4. Retrieval (RAG) Contract

### 4.1 Query Envelope
    {
      "actor": "client|tech|system",
      "scope": {
        "client_id": "cli_…",
        "pev_signature": {"make":"Begode","model":"Master","year":null,"variant":"*"},
        "job_id": "job_…"
      },
      "question": "How do I diagnose overheat cutouts on a Begode Master?",
      "top_k": 8,
      "filters": {"kind": ["howto","known_issue"], "status": "live"},
      "must_cite": true,
      "safety": {"no_pii_leak": true}
    }

### 4.2 Answer Envelope
    {
      "answer_md": "…",
      "citations": [
        {"kb_id":"kb_…","title":"…","source":{"type":"manual","url":"…"},"chunk_ix":3,"score":0.82}
      ],
      "used_embeddings_model": "text-embedding-3-large",
      "guardrails": {"pii_check": "passed","scope_check":"ok"},
      "latency_ms": 430
    }

### 4.3 Guardrails
- Scope enforcement: If actor=client, exclude internal notes unless explicitly whitelisted (status=client_safe).
- PII scrub: Ensure returned snippets do not include other clients’ PII.
- PEV routing: Prefer documents matching (make, model); soft-boost by year, variant.

---

## 5. Permissions & Visibility
- Roles: owner, lead-tech, tech, csr, client, system.
- Visibility tags: internal, client_safe, billing, legal_hold.
- Row-level rules:
  - Client sees only (client_id=self) + client_safe knowledge.
  - Tech sees all live, drafts if owner/lead-tech or author.
  - Voice/SMS transcripts default internal until reviewed.

---

## 6. PII/Retention
- PII tags: email, phone, address, payment, voiceprint, plate?, serial?.
- Embedding scrub: Replace PII with semantic placeholders before vectorization.
- Retention:
  - interaction.audio: 12 months (configurable).
  - billing: per tax requirements.
  - legal_hold: indefinite until cleared.

---

## 7. Storage Layout (AWS)
- S3 buckets:
  - omneuro-prod-artifacts (public: false)
    - /raw/{source}/YYYY/MM/DD/{uuid}.{ext}
    - /derived/{artifact_id}/text.json
    - /kb/{kb_id}/v{semver}/{files}
- SSM Parameters (SecureString):
  - /omneuro/openai/api_key
  - /omneuro/google/api_key
  - /omneuro/telnyx/api_key
  - /omneuro/vector/pg_url (if using RDS + pgvector)
- KMS: CMK for SSM + S3 SSE-KMS; role OmneuroSSMRole allowed kms:Decrypt.

---

## 8. Indexing & Vector Store
- Option A (preferred): Postgres + pgvector
  - Table embeddings(id, kb_id, chunk_ix, text, vector, dims, pii_scrubbed, created_at)
  - HNSW index or IVF on vector
- Option B: Managed vector (e.g., Elastic, Pinecone); keep id alignment and provenance.

---

## 9. APIs (tech-gateway ↔ brain-api)

### 9.1 Ingestion
POST /v1/kb/ingest
    {
      "source": "manual|tech-note|transcript",
      "pev_signature": {"make":"Begode","model":"Master"},
      "title": "Controller thermal limits",
      "body_md": "…",
      "artifacts": ["art_…"],
      "allowlist_auto_live": false
    }
Response ⇒ { "kb_id":"kb_…", "version":"1.0.0" }

### 9.2 Query
POST /v1/kb/query accepts the Query Envelope above.

### 9.3 Link PEV to Knowledge
POST /v1/pev/{pev_id}/link-kb ⇒ { "kb_id":"kb_…" }

### 9.4 Interaction Log
POST /v1/interaction with the Interaction contract.

---

## 10. Events & Webhooks
- Events: job.status_changed, pev.added, kb.promoted, invoice.paid, call.transcribed.
- Webhook format:
    {
      "id":"evt_…",
      "type":"kb.promoted",
      "ts":"…",
      "data":{"kb_id":"kb_…","version":"1.3.2"},
      "signature":"hmac-sha256(base64)"
    }

---

## 11. Observability & QA
- Logs: Structured JSON with req_id, actor, entity, action, status, latency_ms.
- Metrics: kb_ingest_latency, kb_chunks, kb_dedup_hits, rag_hit_rate, guardrail_blocks.
- Health checks: /healthz (brain-api, tech-gateway), /api/kb/health returns index status.
- Canary queries: Nightly: 10 representative (make,model) prompts; alert on retrieval regressions.

---

## 12. Versioning & Deprecation
- Semantic versions on Knowledge Item.
- Promotion rules:
  - draft → review (owner/lead-tech)
  - review → live (owner)
  - live → deprecated (superseded or unsafe)
- Never hard-delete knowledge; tombstone with status:"deprecated" and replaced_by.

---

## 13. Client Garage Hooks
- When client adds a PEV:
  - Create pev record
  - Emit pev.added → trigger knowledge.prefetch for (make,model)
  - Prefetch artifacts (manuals/specs), create initial kb entries (status=review)
- When job created/updated:
  - Index diagnostic notes as tech-note (internal by default)
  - Promote resolved steps that are generalizable to howto after review

---

## 14. Security Notes
- No secrets in git; read via SSM in runtime.
- Signed webhooks (HMAC with SSM-stored secret).
- Role separation: owner can promote/deprecate; tech cannot publish live.

---

## 15. Minimal Seed Taxonomy (PEV)
    {
      "makes": ["Begode","Inmotion","Leaperkim","King Song","Segway-Ninebot","Specialized","Trek","Other"],
      "models": {
        "Begode": ["Master","T4","EX30","RS","Other"],
        "Inmotion": ["V11","V12","V13","S1","Other"],
        "Leaperkim": ["Sherman","Patton","Abrams","Other"]
      },
      "categories": ["EUC","E-Bike","E-Scooter","Other"]
    }

---

## 16. Open Questions (track via ADR)
- Attach confidence & safety signals to answers and expose to UI?
- Multi-tenant future: namespace all IDs by org_id?
- Client-initiated data deletion + vector reindexing strategy (GDPR-like erasure)?

---

## 17. Quick Contracts Summary (for implementers)
- Create KB: POST /v1/kb/ingest → kb_id
- Promote KB: POST /v1/kb/{kb_id}/promote body {to:"review|live|deprecated"}
- Query KB: POST /v1/kb/query → {answer_md, citations[]}
- Log Interaction: POST /v1/interaction
- Add PEV (Garage): POST /v1/pev → emits pev.added (triggers prefetch)

---

## 18. Changelog
- 2025-09-01: Initial KB schema aligned with PEV (no VIN), omnichannel intake, RAG with citations, SSM-backed secrets, and client garage hooks.