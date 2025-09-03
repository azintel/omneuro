# CHECKLISTS.md

## Purpose
Step-by-step sanity checks for Omneuro / JuiceJunkiez operations.  
These lists exist because skipping them cost us hours.  
Every deploy and debug must follow them.  

---

## Deploy Checklist

1. **Git sync**
   - `git fetch origin main`
   - `git reset --hard origin/main`
   - Ensure `scripts/*.sh` are executable (`chmod +x scripts/*.sh`).

2. **Redeploy**
   - Run `./scripts/04-redeploy.sh`.
   - PM2 must restart `brain-api` and `tech-gateway`.
   - Verify logs show no errors.

3. **Static homepage**
   - Repo path: `apps/homepage/public/index.html`
   - Deployed to: `/var/www/juicejunkiez.com`
   - Ensure files owned by `www-data:www-data`.

4. **Nginx config**
   - `/etc/nginx/sites-available/juicejunkiez.com` → `sites-enabled/juicejunkiez.com`
   - `/etc/nginx/sites-available/tech.juicejunkiez.com` → `sites-enabled/tech.juicejunkiez.com`
   - Run `sudo nginx -t && sudo systemctl reload nginx`.

5. **TLS**
   - DNS A record for `juicejunkiez.com` + `www.juicejunkiez.com` points to EC2 Elastic IP.
   - Certbot: `sudo certbot --nginx -d juicejunkiez.com -d www.juicejunkiez.com`
   - Verify expiry: `certbot certificates`
   - Dry-run renew: `certbot renew --dry-run`.

6. **Health checks**
   - `curl -fsS http://127.0.0.1:8081/healthz` – brain-api local
   - `curl -fsS http://127.0.0.1:8092/healthz` – tech-gateway local
   - `curl -fsS https://tech.juicejunkiez.com/healthz` – public tech portal
   - `curl -fsS https://juicejunkiez.com/nginx-health` – public homepage
   - Expect `200 OK` JSON or plain response.

7. **Smoke tests**
   - Chat: POST `https://tech.juicejunkiez.com/api/chat` with `{"messages":[{"role":"user","content":"ping"}]}`
   - Homepage: `curl -I https://juicejunkiez.com/` returns `200 OK`, no `WWW-Authenticate`.

---

## Debug Checklist

1. **IAM & region**
   - `aws sts get-caller-identity`
   - `aws configure get region`
   - Ensure `AWS_REGION=us-east-2`.

2. **Secrets**
   - Confirm parameter name: `/omneuro/openai/api_key`
   - `aws ssm get-parameter --name "/omneuro/openai/api_key" --with-decryption`

3. **PM2**
   - `pm2 list`
   - `pm2 logs <app> --lines 200 --nostream`

4. **Nginx**
   - `nginx -t`
   - `sudo systemctl reload nginx`
   - Check site configs for conflicts.

5. **Permissions**
   - Homepage root: `/var/www/juicejunkiez.com`
   - `www-data:www-data` ownership
   - `755` dirs, `644` files

6. **Curl endpoints**
   - Always `curl` local and public endpoints before touching code.

---

## Retro Discipline

- Every sprint ends with lessons added here.  
- If a checklist item is skipped and failure results, add a new line.  
- No deploy without running this list.  

---

✅ These checklists are the operational spine.  
Follow them, or burn cycles we already paid for.  