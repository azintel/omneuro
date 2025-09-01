# OPS.md

## Purpose
Operations practices for Omneuro / JuiceJunkiez.  
This file captures the lessons, defaults, and recovery patterns that keep our infra stable.  
Every section exists because we broke it once and had to fix it.  

Ops rules are not optional. They are the playbook.  

---

## Environments

- **AWS EC2**: Core services (brain-api, tech-gateway) run on a single EC2 host with PM2.  
- **Ubuntu user**: All commands run as `ubuntu` with `sudo`. Never stay as `ssm-user`.  
- **Home directory layout**:
  - `/home/ubuntu/omneuro` – Git repo root.
  - `/var/www/juicejunkiez.com` – Static homepage root.  
- **Domains**:
  - `juicejunkiez.com` – Public homepage (no password).  
  - `tech.juicejunkiez.com` – Tech portal + Repairbot (password-protected).  

---

## Deploy & Redeploy

- **Always pull fresh**: `git fetch && git reset --hard origin/main`.  
- **Scripts executable**: Redeploy script (`scripts/04-redeploy.sh`) must `chmod +x` itself after pull.  
- **PM2 reload**: Apps (`brain-api`, `tech-gateway`) are restarted via `ecosystem.config.cjs`.  
- **Static homepage**: Synced from repo (`apps/homepage/public/`) to `/var/www/juicejunkiez.com`.  
- **Health checks**: Run after every redeploy. Each service/page must pass before completion.  

---

## Health Checks

Every service and site publishes a health endpoint:

- **Brain API**: `http://localhost:8081/healthz`  
- **Tech Gateway**: `http://localhost:8092/healthz`, `/api/health`, `/api/tech/health`  
- **Nginx sites**:
  - `https://juicejunkiez.com/nginx-health` – static homepage
  - `https://tech.juicejunkiez.com/healthz` – tech portal (proxied to Node)  

Health checks are canonical. They retry with backoff. Failures block deploy.  

---

## TLS / DNS

- **Route53**: `juicejunkiez.com` + `www.juicejunkiez.com` A records point to EC2 Elastic IP.  
- **Certbot**: Certificates issued via `certbot --nginx`.  
- **Auto-renew**: Cron/systemd handles renewal. Test with `certbot renew --dry-run`.  
- **Redirects**:
  - `www.juicejunkiez.com` → `juicejunkiez.com`  
  - All HTTP → HTTPS  

---

## Permissions

- **Repo scripts**: Must stay executable (`chmod +x`).  
- **Static homepage**: Owned by `www-data:www-data`.  
- **Nginx configs**: `/etc/nginx/sites-available/*` symlinked into `/etc/nginx/sites-enabled/`.  
- **Fixes**: If perms drift, run `chown -R www-data:www-data /var/www/juicejunkiez.com` and reset.  

---

## Secrets

- **AWS SSM** is the only source of secrets (see `SECRETS.md`).  
- **OpenAI API key**: `/omneuro/openai/api_key` (SecureString).  
- **Other keys**: Google client ID/secret, Telnyx key, Stripe keys (future).  
- **Never in Git**. Never in local configs.  

---

## Debug Patterns

- **Start with IAM + region**: Most SSM issues are missing perms or wrong region.  
- **Curl the healthz**: Always test endpoint directly before assuming code broke.  
- **Logs before code**: PM2 logs are the first stop, not code edits.  
- **Check perms**: 90% of homepage/NGINX failures were file ownership or chmod.  

---

## Documentation Discipline

- **Single-block rule**: Docs must always be output in one block to avoid spill/mix.  
- **Cross-link**: OPS, RULES, OBSERVABILITY, RUNBOOK, and CHECKLISTS must point to each other.  
- **No drift**: Every new lesson goes straight into docs.  

---

## Cross-References

- **RULES.md** – Non-negotiable rules (dev + ops).  
- **OBSERVABILITY.md** – Log groups, tracing, metrics.  
- **RUNBOOK.md** – Recovery actions for failures.  
- **CHECKLISTS.md** – Step-by-step deploy/debug sanity checks.  
- **SECRETS.md** – Canonical list of SSM paths.  

---

✅ Ops are codified here so we don’t repeat mistakes.  
If it isn’t in `OPS.md`, it didn’t happen.  