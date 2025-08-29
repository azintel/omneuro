# OPS.md

## Omneuro Operations Overview

This file captures the high-level operational state of our production environment.  
It is designed to prevent context loss: all essential non-secret infrastructure details live here.

---

### 1. Instance, User & Repo

- **EC2 Instance ID:** `i-011c79fffa7af9e27`  
- **Primary user context:** **All operational commands run as `ubuntu`** using `sudo -u ubuntu -- bash -lc '…'` in SSM.  
- **Repo location (server):** `/home/ubuntu/omneuro` (equivalently `~/omneuro` for user `ubuntu`).  
- **Security Groups:** `sg-0de027ba0663a9c57` (80/443 open; admin ports to restricted IPs)

---

### 2. DNS (juicejunkiez.com)

- **HostedZoneId:** `Z07470533F6JKXTF8S7GO`  
- **Elastic IP:** `3.16.53.108` (us-east-2)  
- **Records**
  | Name                    | Type | TTL | Target        | Notes                         |
  |-------------------------|------|-----|---------------|-------------------------------|
  | `tech.juicejunkiez.com` | A    | 60  | `3.16.53.108` | Tech portal (nginx → gateway) |

- **Registrar nameservers**
  - `ns-1046.awsdns-02.org`
  - `ns-2021.awsdns-60.co.uk`
  - `ns-350.awsdns-43.com`
  - `ns-670.awsdns-19.net`

---

### 3. TLS

- **Issuer:** Let’s Encrypt  
- **Cert path:** `/etc/letsencrypt/live/tech.juicejunkiez.com/fullchain.pem`  
- **Key path:** `/etc/letsencrypt/live/tech.juicejunkiez.com/privkey.pem`  
- **Renewal:** `certbot.timer` (systemd)

---

### 4. Nginx

- **Enabled site:** `/etc/nginx/sites-enabled/tech.juicejunkiez.com`  
- **Upstream:** `http://127.0.0.1:8092` (tech-gateway)  
- **Local health endpoint:** `/nginx-health` → 200

---

### 5. Services (Ports & Health)

- **tech-gateway**
  - Port: `8092`
  - Health: `GET /healthz`, `GET /api/tech/health`
  - Public: `https://tech.juicejunkiez.com` (nginx → gateway)

- **brain-api**
  - Port: `8081`
  - Health: `GET /healthz`
  - Access: internal (gateway → brain-api)

---

### 6. Process Manager

- **PM2 HOME (target):** `/home/ubuntu/.pm2` (owned by `ubuntu:ubuntu`)  
- **Discovery:**
  ```bash
  sudo -u ubuntu -- bash -lc 'PM2_HOME=/home/ubuntu/.pm2 pm2 jlist'
  ```

---

### 7. Logs

- **Nginx:** `/var/log/nginx/access.log`, `/var/log/nginx/error.log`  
- **PM2:** `/home/ubuntu/.pm2/logs/`  
- **Rotation:** logrotate / pm2-logrotate

---

### 8. Runbook Links

- `RUNBOOK.md` → deploy/restart/rollback steps  
- `OBSERVABILITY.md` → monitoring + metrics  
- `CHECKLISTS.md` → pre-/post-deploy, incident response  
- `deploy-ops.md` → SSM patterns and redeploy script usage  

---