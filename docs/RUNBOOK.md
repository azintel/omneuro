# RUNBOOK.md

> **Purpose**  
> Fast, repeatable recovery for common failures in the Omneuro stack.  
> This runbook is **procedural**. Copy/paste-able steps. Minimal guesswork.  
> If anything here proves incomplete, fix the doc **immediately** after resolving.

---

## Quick Index

- [0. Golden Checks (always run first)](#0-golden-checks-always-run-first)
- [1. Homepage (apex) shows password prompt or tech chat](#1-homepage-apex-shows-password-prompt-or-tech-chat)
- [2. Homepage 404 / health fails](#2-homepage-404--health-fails)
- [3. Certbot fails (DNS/NXDOMAIN/No A record)](#3-certbot-fails-dnsnxdomainno-a-record)
- [4. Chat API errors (Missing OMNEURO\_OPENAI\_API\_KEY\_PARAM / ParameterNotFound)](#4-chat-api-errors-missing-omneuro_openai_api_key_param--parameternotfound)
- [5. SSM access denied / wrong region / bad path](#5-ssm-access-denied--wrong-region--bad-path)
- [6. PM2 not picking up env / “chat error” with valid config](#6-pm2-not-picking-up-env--chat-error-with-valid-config)
- [7. Port 8092 not listening (tech-gateway down)](#7-port-8092-not-listening-tech-gateway-down)
- [8. Build-time module issues (@aws-sdk/client-ssm not found)](#8-build-time-module-issues-aws_sdkclient-ssm-not-found)
- [9. Git sync blocked by local changes](#9-git-sync-blocked-by-local-changes)
- [10. Nginx server_name conflicts for WWW](#10-nginx-server_name-conflicts-for-www)
- [11. Redeploy: full-cycle steps](#11-redeploy-full-cycle-steps)
- [12. Health checks (canonical)](#12-health-checks-canonical)
- [Appendix A. IAM policy (least-priv) for SSM param](#appendix-a-iam-policy-least-priv-for-ssm-param)
- [Appendix B. OpenAI key sanity (without printing secret)](#appendix-b-openai-key-sanity-without-printing-secret)

---

## 0. Golden Checks (always run first)

- **User/role/region reality check (on EC2 over SSM):**

    1. Confirm the instance role & caller:
    
        ```
        aws sts get-caller-identity
        ```
    
    2. Confirm region (IMDSv2 + env):
    
        ```
        TOKEN=$(curl -sS -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
        curl -fsS -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/dynamic/instance-identity/document | jq -r .region
        echo ${AWS_REGION:-<no AWS_REGION>}
        ```
    
    3. We use **us-east-2** for runtime unless explicitly stated.

- **Logs before code:** check PM2 app logs before changing anything:

    ```
    pm2 logs tech-gateway --lines 200 --nostream || true
    pm2 logs brain-api --lines 200 --nostream || true
    ```

---

## 1. Homepage (apex) shows password prompt or tech chat

**Symptoms**
- Visiting `https://juicejunkiez.com/` requests a password or renders the tech chat page.
- Expected: **public static homepage** (no auth), served by Nginx from static root.

**Likely Cause**
- Nginx apex site is proxying to Node instead of serving static `root`.
- Apex and tech portal configs mixed.

**Fix**
1. Inspect active apex config:

    ```
    nl -ba /etc/nginx/sites-enabled/juicejunkiez.com | sed -n '1,160p'
    ```

   Expect HTTPS server with:
   - `root /var/www/juicejunkiez.com`
   - `index index.html`
   - A `location / { try_files $uri $uri/ =404; }`
   - **No** auth on apex.

2. Ensure static files present and owned by `www-data`:

    ```
    sudo mkdir -p /var/www/juicejunkiez.com
    sudo rsync -av --delete /home/ubuntu/omneuro/apps/homepage/public/ /var/www/juicejunkiez.com/
    sudo chown -R www-data:www-data /var/www/juicejunkiez.com
    sudo find /var/www/juicejunkiez.com -type d -exec chmod 755 {} \;
    sudo find /var/www/juicejunkiez.com -type f -exec chmod 644 {} \;
    ```

3. Test + reload Nginx:

    ```
    sudo nginx -t && sudo systemctl reload nginx
    ```

4. Sanity:

    ```
    curl -I https://juicejunkiez.com/
    curl -I https://juicejunkiez.com/nginx-health
    ```

---

## 2. Homepage 404 / health fails

**Symptoms**
- `https://juicejunkiez.com/` -> 404
- `https://juicejunkiez.com/nginx-health` -> non-200

**Likely Causes**
- Site not enabled, wrong `root`, missing files, or permissions.

**Fix**
1. Sites:

    ```
    ls -l /etc/nginx/sites-enabled/
    ```

   Ensure `juicejunkiez.com` symlinks to `/etc/nginx/sites-available/juicejunkiez.com`.

2. Root path exists and has `index.html` (see Section 1).

3. Nginx config has `location = /nginx-health { return 200; }` for apex.

4. Test + reload:

    ```
    sudo nginx -t && sudo systemctl reload nginx
    ```

---

## 3. Certbot fails (DNS/NXDOMAIN/No A record)

**Symptoms**
- Certbot says no valid A/AAAA or NXDOMAIN for apex or `www.`

**Fix (Route53)**
1. Create/verify A records for apex and `www` to EC2 public IP:

    ```
    HZID="<your-hosted-zone-id>"
    cat >/tmp/jjz-dns.json <<'JSON'
    {
      "Comment": "Apex + WWW A records",
      "Changes": [
        {
          "Action": "UPSERT",
          "ResourceRecordSet": {
            "Name": "juicejunkiez.com",
            "Type": "A",
            "TTL": 60,
            "ResourceRecords": [ { "Value": "YOUR.EC2.IP" } ]
          }
        },
        {
          "Action": "UPSERT",
          "ResourceRecordSet": {
            "Name": "www.juicejunkiez.com",
            "Type": "A",
            "TTL": 60,
            "ResourceRecords": [ { "Value": "YOUR.EC2.IP" } ]
          }
        }
      ]
    }
    JSON

    CHANGE_ID=$(aws route53 change-resource-record-sets \
      --hosted-zone-id "$HZID" \
      --change-batch file:///tmp/jjz-dns.json \
      --query 'ChangeInfo.Id' --output text)

    while true; do
      STATUS=$(aws route53 get-change --id "$CHANGE_ID" --query 'ChangeInfo.Status' --output text)
      echo "Route53 status: $STATUS"; [ "$STATUS" = "INSYNC" ] && break; sleep 10
    done
    ```

2. Verify:

    ```
    dig +short juicejunkiez.com A
    dig +short www.juicejunkiez.com A
    ```

3. Issue/renew cert:

    ```
    sudo certbot --nginx -d juicejunkiez.com -d www.juicejunkiez.com
    ```

---

## 4. Chat API errors (Missing OMNEURO_OPENAI_API_KEY_PARAM / ParameterNotFound)

**Symptoms**
- PM2 log: `Missing OMNEURO_OPENAI_API_KEY_PARAM env` **or**
- `get-parameter failed ... ParameterNotFound`

**Likely Causes**
- Env var not present in PM2 env.
- Wrong SSM path/region.

**Fix**
1. Our canonical SSM path (current):  
   `/omneuro/openai/api_key` in `us-east-2`.

2. Ensure **ecosystem.config.cjs** for `tech-gateway` includes:

    ```
    env: {
      PORT: 8092,
      NODE_ENV: 'production',
      BRAIN_API_URL: 'http://localhost:8081',
      AWS_REGION: 'us-east-2',
      OMNEURO_OPENAI_API_KEY_PARAM: '/omneuro/openai/api_key'
    },
    ```

3. Reload with env applied:

    ```
    pm2 reload ecosystem.config.cjs --only tech-gateway --update-env || \
    pm2 start ecosystem.config.cjs --only tech-gateway --update-env
    pm2 save || true
    ```

4. Sanity call:

    ```
    curl -fsS https://tech.juicejunkiez.com/healthz
    curl -sS https://tech.juicejunkiez.com/api/chat \
      -H "content-type: application/json" \
      -d '{"messages":[{"role":"user","content":"Say hello, Repairbot."}]}'
    ```

If `ParameterNotFound`, see Section 5 to confirm SSM.

---

## 5. SSM access denied / wrong region / bad path

**Symptoms**
- `AccessDeniedException` for SSM operations.
- `ParameterNotFound`.

**Fix**
1. Confirm caller and region (see Section 0).

2. List parameters you expect (run from **laptop with admin creds** or EC2 if IAM allows):

    ```
    export AWS_REGION=us-east-2
    aws ssm get-parameters-by-path \
      --path "/omneuro" --recursive \
      --query "Parameters[].{Name:Name,Type:Type,Version:Version}" \
      --max-items 100
    ```

3. Read the exact parameter (on EC2 role after permissions are correct):

    ```
    aws ssm get-parameter --name "/omneuro/openai/api_key" --with-decryption --query "Parameter.Name"
    ```

4. If AccessDenied: attach/merge policy on the instance role allowing:
   - `ssm:GetParameter`
   - (Optional for listing) `ssm:DescribeParameters`, `ssm:GetParametersByPath`
   - If encrypted with CMK: `kms:Decrypt` on that key  
   (See **Appendix A** for example policy.)

---

## 6. PM2 not picking up env / “chat error” with valid config

**Symptoms**
- Env present in ecosystem file, but app still complains missing env.

**Fix**
- PM2 only reads env at (re)start/reload with `--update-env`:
  pm2 reload ecosystem.config.cjs –only tech-gateway –update-env || 
pm2 start ecosystem.config.cjs –only tech-gateway –update-env
pm2 save || true
pm2 describe tech-gateway
- If still stale, delete then start:
pm2 delete tech-gateway || true
pm2 start ecosystem.config.cjs –only tech-gateway –update-env
pm2 save || true
---

## 7. Port 8092 not listening (tech-gateway down)

**Symptoms**
- Health fails; `curl http://127.0.0.1:8092/healthz` connection refused.

**Fix**
1. Confirm PM2 status:

  ```
  pm2 list
  pm2 logs tech-gateway --lines 200 --nostream
  ```

2. Check listening socket:

  ```
  ss -ltnp | grep -E ":8092\b" || sudo lsof -iTCP:8092 -sTCP:LISTEN || true
  ```

3. If not up, restart via PM2 (Section 6) or redeploy (Section 11).

---

## 8. Build-time module issues (@aws-sdk/client-ssm not found)

**Symptoms**
- `tech-gateway` fails `tsc` or runtime cannot import `@aws-sdk/client-ssm`.

**Fix**
- Ensure dependency installed in **apps/tech-gateway**:
cd /home/ubuntu/omneuro/apps/tech-gateway
npm ci || npm i
npm i @aws-sdk/client-ssm
npm run build
- Redeploy (Section 11).

---

## 9. Git sync blocked by local changes

**Symptoms**
- `git pull --ff-only` fails due to local modified files (e.g., scripts permissions drift).

**Fix**
- Backup and hard reset:

  ```
  cd /home/ubuntu/omneuro
  BK="/home/ubuntu/_backup_scripts_$(date +%F_%H%M%S)"
  mkdir -p "$BK"
  cp -a scripts/*.sh "$BK/" || true
  git fetch origin main
  git reset --hard origin/main
  chmod +x scripts/*.sh
  ```

---

## 10. Nginx server_name conflicts for WWW

**Symptoms**
- Nginx warns: *conflicting server name "www.juicejunkiez.com" … ignored*

**Cause**
- Two site configs both declare `server_name www.juicejunkiez.com`.

**Fix**
- We use a **single** apex site that serves both apex and `www` (plus optional dedicated `www` redirect site).  
If you see duplicates, disable the extra one:

  ```
  ls -l /etc/nginx/sites-enabled/
  # Remove duplicate or the old redirect if its names overlap incorrectly:
  sudo rm -f /etc/nginx/sites-enabled/juicejunkiez-www-redirect || true

  sudo nginx -t && sudo systemctl reload nginx
  ```

- Our canonical apex site includes **both** names:

  ```
  server_name juicejunkiez.com www.juicejunkiez.com;
  ```

---

## 11. Redeploy: full-cycle steps

**When to run**
- After pushing to `main`, or when infra/app drift is suspected.

**Steps (SSM shell, as ubuntu)**
1. Sync + build + restart:

  ```
  cd /home/ubuntu/omneuro
  git fetch origin main
  git reset --hard origin/main
  chmod +x scripts/*.sh
  ./scripts/04-redeploy.sh
  ```

2. Ensure PM2 picks up env:

  ```
  pm2 reload ecosystem.config.cjs --only tech-gateway --update-env || \
  pm2 start ecosystem.config.cjs --only tech-gateway --update-env
  pm2 save || true
  ```

3. Health checks (Section 12).

---

## 12. Health checks (canonical)

- **Apex (Nginx static):**

  ```
  curl -I https://juicejunkiez.com/
  curl -I https://juicejunkiez.com/nginx-health
  ```

- **Tech portal (Node via Nginx):**

  ```
  curl -fsS https://tech.juicejunkiez.com/healthz
  curl -fsS https://tech.juicejunkiez.com/api/health
  ```

- **Chat smoke (costs minimal tokens):**

  ```
  curl -sS https://tech.juicejunkiez.com/api/chat \
    -H "content-type: application/json" \
    -d '{"messages":[{"role":"user","content":"Say hello, Repairbot."}]}'
  ```

- **Brain API (direct, if exposed internally):**

  ```
  curl -fsS http://127.0.0.1:8081/healthz || true
  ```

---

## Appendix A. IAM policy (least-priv) for SSM param

> Attach as **inline policy** to the EC2 instance role (e.g., `OmneuroSSMRole`).  
> Scope paths/keys to **exact** parameters you need.
{
“Version”: “2012-10-17”,
“Statement”: [
{
“Sid”: “ReadOpenAIKey”,
“Effect”: “Allow”,
“Action”: [“ssm:GetParameter”],
“Resource”: “arn:aws:ssm:us-east-2:ACCOUNT_ID:parameter/omneuro/openai/api_key”
},
{
“Sid”: “OptionalListOmneuro”,
“Effect”: “Allow”,
“Action”: [“ssm:GetParametersByPath”,“ssm:DescribeParameters”],
“Resource”: “arn:aws:ssm:us-east-2:ACCOUNT_ID:parameter/omneuro”
}
/* If the parameter is encrypted with a CMK, also allow:
{
“Sid”: “KMSDecryptForParams”,
“Effect”: “Allow”,
“Action”: [“kms:Decrypt”,“kms:DescribeKey”],
“Resource”: “arn:aws:kms:us-east-2:ACCOUNT_ID:key/YOUR-KMS-KEY-ID”
}
*/
]
}
**Apply from laptop/admin:**

- To **merge** (not wipe) inline policy, get the existing JSON, add statements, then:

    ```
    aws iam put-role-policy \
      --role-name OmneuroSSMRole \
      --policy-name Omneuro-SSM-Read \
      --policy-document file:///path/to/merged.json
    ```

---

## Appendix B. OpenAI key sanity (without printing secret)

**On EC2 (as ubuntu) with correct IAM perms:**

1. Confirm parameter exists:

    ```
    aws ssm get-parameter --name "/omneuro/openai/api_key" --query "Parameter.Name"
    ```

2. Check decrypted length only (no value printed):

    ```
    aws ssm get-parameter \
      --name "/omneuro/openai/api_key" \
      --with-decryption \
      --query "length(Parameter.Value)"
    ```

3. Live auth test (HTTP code only + trimmed error):

    ```
    HTTP_CODE=$(
      curl -sS -o /tmp/openai_models.json -w "%{http_code}" \
        -H "Authorization: Bearer $(aws ssm get-parameter --name "/omneuro/openai/api_key" --with-decryption --query Parameter.Value --output text)" \
        https://api.openai.com/v1/models
    )
    echo "OpenAI /v1/models HTTP: $HTTP_CODE"
    if [ "$HTTP_CODE" != "200" ]; then
      sed -e 's/[A-Za-z0-9_\-]\{20,\}/[REDACTED]/g' </tmp/openai_models.json | head -c 400; echo
    fi
    ```

4. If rotating key:

    ```
    read -r -p "Update OpenAI key now? (y/N) " YN || true
    if [ "${YN:-N}" = "y" ]; then
      echo -n "Paste NEW key (hidden): "; stty -echo; read -r NEWKEY; stty echo; echo
      aws ssm put-parameter --name "/omneuro/openai/api_key" --type SecureString --value "$NEWKEY" --overwrite
      echo "SSM updated."
      pm2 reload ecosystem.config.cjs --only tech-gateway --update-env || \
      pm2 start ecosystem.config.cjs --only tech-gateway --update-env
      pm2 save || true
    fi
    ```

---

## Notes & Discipline

- **No hacks.** Apex is static via Nginx; tech portal is Node behind Nginx. Keep concerns separate.
- **Single source of truth:**  
  - Paths/ports/sites live in this runbook + Nginx configs in `/etc/nginx/sites-*`.  
  - Secrets live in SSM. No secrets in Git.
- **After every incident:** update this runbook with the exact successful steps.
- **When in doubt:** run the **Golden Checks** (Section 0) and collect logs **before** changing code.
