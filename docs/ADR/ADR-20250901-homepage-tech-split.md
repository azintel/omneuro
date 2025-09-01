# ADR-20250901-homepage-tech-split.md

## Title
Separate Homepage (juicejunkiez.com) and Tech Portal (tech.juicejunkiez.com)

## Status
Accepted

## Context
Originally, both the **public homepage** and the **tech portal** were being served through the same `index.html` under `apps/tech-gateway/public`.  
This caused two issues:  
1. **Password prompt on homepage** – The entire site was gated by the tech portal’s basic auth, blocking clients.  
2. **Context confusion** – Public vs internal traffic was not clearly separated in nginx or in the repo structure.  

During deployment, the homepage was expected at `juicejunkiez.com` (public) while the password-protected tech portal was expected at `tech.juicejunkiez.com`. Mixing them caused failures and wasted cycles.  

## Decision
- **Homepage** (`juicejunkiez.com`):  
  - Served directly by nginx.  
  - Static files live under `/var/www/juicejunkiez.com`.  
  - Branding: black + gold, Juice Junkiez logo.  
  - Public links: Shop, Client Garage, Tech Portal.  
  - No authentication required.  

- **Tech Portal** (`tech.juicejunkiez.com`):  
  - Served by `apps/tech-gateway` (Node/Express).  
  - Protected with password auth.  
  - Contains internal tools: Repairbot chat, job tracking, diagnostics.  
  - API access remains under `/api/*`.  

- **nginx split**:  
  - `juicejunkiez.com` → static root at `/var/www/juicejunkiez.com`.  
  - `tech.juicejunkiez.com` → proxied to Node app on port 8092.  
  - Health endpoints exist for both domains.  

## Consequences
- Clients and partners access a clean, public-facing homepage without being blocked by authentication.  
- Techs continue to log in through `tech.juicejunkiez.com`.  
- Code and infrastructure are cleaner:  
  - `apps/homepage/` for static site.  
  - `apps/tech-gateway/` for tech tools + APIs.  
- TLS certificates managed separately but via a unified certbot process.  
- Deploy script (`scripts/04-redeploy.sh`) updated to sync both homepage and tech portal.  

## Cross-References
- `ROADMAP.md` – Lists homepage and tech portal milestones.  
- `RULES.md` – Rule: “No phantom endpoints; homepage and tech portal must not overlap.”  
- `OPS.md` – nginx + certbot deployment steps.  
- `RUNBOOK.md` – Recovery path if homepage accidentally password-protected.  