# HEALTH.md

## Purpose
This document consolidates all **health checks** used in Omneuro.  
Health checks are canonical — if they fail, the service is not considered deployed.  

---

## Homepage (juicejunkiez.com)

- **HTTP**  
  - `http://juicejunkiez.com/nginx-health` → `200 OK` (redirects to HTTPS)  
- **HTTPS**  
  - `https://juicejunkiez.com/nginx-health` → `200 OK`  

Confirms Nginx is up, TLS is valid, and homepage static root is served.  

---

## Tech Gateway (tech.juicejunkiez.com)

- **Local (Node)**  
  - `http://127.0.0.1:8092/healthz` → `{"ok":true}`  
- **Public (through Nginx)**  
  - `https://tech.juicejunkiez.com/healthz` → `{"ok":true}`  
  - `https://tech.juicejunkiez.com/api/health` → `{"ok":true}`  
- **Chat API Smoke**  
  - `curl -sS https://tech.juicejunkiez.com/api/chat -H "content-type: application/json" -d '{"messages":[{"role":"user","content":"ping"}]}'`  
  → must return JSON with `"reply"`  

---

## Brain API

- **Local (Node)**  
  - `http://127.0.0.1:8081/healthz` → `{"ok":true}`  
- **Public** (if proxied in future) TBD  

---

## Certbot (TLS renewal)

- **Renewal test**  
  - `sudo certbot renew --dry-run` → must succeed without error  
- Certificates stored at:  
  - `/etc/letsencrypt/live/juicejunkiez.com/fullchain.pem`  
  - `/etc/letsencrypt/live/juicejunkiez.com/privkey.pem`  

---

## Ops Integration

- All redeploy scripts must verify these endpoints at the end.  
- Failures must block deploy until fixed.  
- When adding new subdomains (e.g., `shop.juicejunkiez.com`), update this file immediately.  

---

✅ Health checks are **non-optional**. If not documented here, they do not exist.  