# ROADMAP.md

## Vision
Omneuro powers **Juice Junkiez** with a fully automated backend.  
The end-state is a cloud-hosted knowledge base + automation system that manages:  
- Client intake and scheduling  
- Tech job tracking and diagnostics  
- Payment and invoicing  
- Shop operations and product catalog  
- AI-powered knowledge ingestion, indexing, and retrieval  

---

## Milestones

### ✅ Completed
- **Core repo + docs foundation** – All services documented with RULES, OPS, RUNBOOK, CHECKLISTS.  
- **SSM integration** – Secrets (OpenAI, Google, etc.) stored in AWS SSM, pulled securely.  
- **Repairbot chat route** – First API call made successfully using OpenAI via secure key retrieval.  
- **Tech Portal live** – Password-protected portal at https://tech.juicejunkiez.com.  
- **Homepage live** – Public site at https://juicejunkiez.com with branding, TLS via certbot, nginx health check.  

### 🔜 In Progress
- **Client Garage MVP** –  
  - Add/manage vehicles (make/model dropdown + “other” input).  
  - Schedule repairs + services.  
  - Track job status + notifications.  
  - View/pay invoices (Stripe integration).  

- **Shop MVP** –  
  - Stripe product catalog + checkout.  
  - Link from homepage.  
  - AI assistant support for shop inquiries (products, orders).  

### 📅 Planned
- **Omneuro v2.0 (cloud-hosted KB)** –  
  - Automated ingestion + indexing of tech docs, calls, SMS, and client/job data.  
  - Knowledge graph linking clients, vehicles, jobs, and parts.  

- **Voice + SMS integration (Telnyx)** –  
  - Automated receptionist.  
  - Call/SMS logging into Omneuro KB.  
  - Intake + scheduling via phone.  

- **Full business automation** –  
  - AI-driven scheduling optimization.  
  - Predictive parts stocking.  
  - Automated follow-ups and client lifecycle management.  

---

## Retro Notes

- **Docs discipline** – Context drift wasted cycles; solved by enforcing *single-block outputs*.  
- **Secrets path confusion** – Resolved by confirming `/omneuro/openai/api_key` is canonical. IAM perms validated.  
- **TLS friction** – Certbot failed until DNS was updated in Route53. Rule added: check DNS before certbot.  
- **Index.html split** – Homepage and tech portal must stay separate to avoid password lock on public page. Documented via ADR.  

---

## References
- `RULES.md` – Development and ops discipline.  
- `OPS.md` – System-wide operational procedures.  
- `RUNBOOK.md` – Failure recovery paths.  
- `ADR/ADR-20250901-homepage-tech-split.md` – Homepage vs Tech Portal decision.  