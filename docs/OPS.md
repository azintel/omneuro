# OPS.md

## Omneuro Operations Overview

This file captures the high-level operational state of our production environment.  
It is designed to prevent context loss: all essential non-secret infrastructure details live here.

---

### 1. Instance & Network

- **EC2 Instance ID:** `i-011c79fffa7af9e27`
- **Elastic IP:** (document with `aws ec2 describe-addresses`)
- **VPC:** `vpc-026919db421d655fd`
- **Subnet:** `subnet-023d240d009ed3787`
- **Security Groups:**  
  - `sg-0de027ba0663a9c57` (ingress: 80/443 from 0.0.0.0/0; 22 from restricted sources)

> **Note:** All operational commands on this instance must be executed as the `ubuntu` user with `sudo`.  
> SSM sessions default to `ssm-user`; switch to `ubuntu` before running scripts.

---

### 2. DNS

- Hosted zone: Route53 for `juicejunkiez.com`
- Records (to be captured via `aws route53 list-resource-record-sets`):  
  - `A`/`AAAA` → apex (`juicejunkiez.com`)  
  - `A` → `api.juicejunkiez.com` → Elastic IP  
  - `A` → `tech.juicejunkiez.com` → Elastic IP  
  - `CNAME` → `www` → apex

---

### 3. TLS

- Issuer: Let’s Encrypt (DNS/HTTP challenge)
- Cert path: `/etc/letsencrypt/live/juicejunkiez.com/`
- Renewal: `certbot.timer` via systemd  
- Renewal logs: `journalctl -u certbot`

---

### 4. Nginx

- Version: (capture via `nginx -v`)
- Config root: `/etc/nginx`
- Server blocks: `/etc/nginx/sites-available/`, symlinked into `/etc/nginx/sites-enabled/`
- Key features: gzip, HSTS (to be enabled after preload), proxy timeouts, upstreams to:
  - brain-api (`localhost:8081`)
  - tech-gateway (`localhost:8092`)

---

### 5. Process Manager

- PM2 managed apps:
  - `brain-api` (port 8081)
  - `tech-gateway` (port 8092)
- Health endpoints:
  - brain-api → `GET /healthz`
  - tech-gateway → `GET /healthz`, `GET /api/tech/health`
- Logs: PM2 logs located in `/home/ubuntu/.pm2/logs/`

---

### 6. Monitoring & Logs

- **Nginx logs**: `/var/log/nginx/access.log`, `/var/log/nginx/error.log`
- **PM2 logs**: `/home/ubuntu/.pm2/logs/`
- **Rotation**: logrotate / pm2-logrotate

---

### 7. Runbook Links

- [RUNBOOK.md](RUNBOOK.md) → step-by-step deploy, restart, renew certs, rollbacks.
- [OBSERVABILITY.md](OBSERVABILITY.md) → monitoring and log collection.
- [CHECKLISTS.md](CHECKLISTS.md) → pre/post-deploy, incident response.
- [ENVIRONMENTS.md](ENVIRONMENTS.md) → prod/staging environment mapping.

---