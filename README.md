# omneuro monorepo

This repo hosts your automation brain and (later) the web portal.

## Layout
- apps/brain-api — Node API (central brain)
- apps/web-portal — Next.js site (client portal) [todo]
- packages/core — shared logic (slotting, templating) [todo]
- packages/connectors — Google, Telnyx, Stripe SDK wrappers [todo]
- configs/juice-junkiez — business configuration (JSON)
- infra/docker — Docker Compose for deployment

## Quick start
1) cd apps/brain-api && cp .env.example .env && npm i
2) From repo root: docker compose -f infra/docker/docker-compose.yml up -d --build
3) Visit http://localhost:8080/health

