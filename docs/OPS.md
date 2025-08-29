# OPS.md

## Omneuro Operations Overview

This file captures the high-level operational state of our production environment.  
It is designed to prevent context loss: all essential non-secret infrastructure details live here.

---

### 1. Instance & Network

- **EC2 Instance ID:** `i-011c79fffa7af9e27`
- **Elastic IP:** `3.16.53.108` (us-east-2)
- **VPC:** `vpc-026919db421d655fd`
- **Subnet:** `subnet-023d240d009ed3787`
- **Security Groups:**  
  - **GroupId:** `sg-0de027ba0663a9c57` (us-east-2)  
  - **Ingress:**  
    - TCP 80 → `0.0.0.0/0`  
    - TCP 443 → `0.0.0.0/0`  
    - (Admin IPs for 22/8080/8081/etc. as previously listed)

---

### 2. DNS

- **Hosted Zone (Route53):** `juicejunkiez.com`  
- **HostedZoneId:** `Z07470533F6JKXTF8S7GO`
- **Elastic IP (EC2):** `3.16.53.108` (us-east-2)

#### Records
| Name                    | Type | TTL | Target        | Notes                         |
|-------------------------|------|-----|---------------|-------------------------------|
| `juicejunkiez.com`      | A    | —   | `3.16.53.108` | Apex domain                   |
| `api.juicejunkiez.com`  | A    | —   | `3.16.53.108` | API endpoint                  |
| `tech.juicejunkiez.com` | A    | 60  | `3.16.53.108` | Subdomain for tech portal     |
| `www.juicejunkiez.com`  | CNAME| —   | `juicejunkiez.com` | Web alias                  |

#### Registrar Delegation
Nameservers set at registrar (Route 53 Domains):
- `ns-1046.awsdns-02.org`
- `ns-2021.awsdns-60.co.uk`
- `ns-350.awsdns-43.com`
- `ns-670.awsdns-19.net`

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
- Enabled site for tech portal: `/etc/nginx/sites-enabled/tech.juicejunkiez.com`
- Upstream: `http://127.0.0.1:8092`
- Key features: gzip, HSTS (to be enabled after preload), proxy timeouts, upstreams to:
  - brain-api (`localhost:8081`)
  - tech-gateway (`localhost:8092`)

**Sample Config:**
```nginx
# HTTP (Let’s Encrypt handled redirect on cert issue)
server {
  listen 80;
  server_name tech.juicejunkiez.com;

  location = /nginx-health { return 200; }

  location / {
    proxy_pass http://127.0.0.1:8092;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_http_version 1.1;
    proxy_read_timeout 60s;
    proxy_connect_timeout 15s;
    proxy_send_timeout 60s;
  }
}
```

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

### 6. Ports in Use

- `tech-gateway`: 8092 (HTTP)
- `brain-api`: 8081 (HTTP)

---

### 7. Monitoring & Logs

- **Nginx logs**: `/var/log/nginx/access.log`, `/var/log/nginx/error.log`
- **PM2 logs**: `/home/ubuntu/.pm2/logs/`
- **Rotation**: logrotate / pm2-logrotate

---

### 8. Runbook Links

- [RUNBOOK.md](RUNBOOK.md) → step-by-step deploy, restart, renew certs, rollbacks.
- [OBSERVABILITY.md](OBSERVABILITY.md) → monitoring and log collection.
- [CHECKLISTS.md](CHECKLISTS.md) → pre/post-deploy, incident response.
- [ENVIRONMENTS.md](ENVIRONMENTS.md) → prod/staging environment mapping.

---