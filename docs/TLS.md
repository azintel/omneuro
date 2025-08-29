# TLS.md

## Let’s Encrypt

- **Issued for:** `tech.juicejunkiez.com`
- **Issuer:** Let’s Encrypt
- **Certificate path:** `/etc/letsencrypt/live/tech.juicejunkiez.com/fullchain.pem`
- **Private key path:** `/etc/letsencrypt/live/tech.juicejunkiez.com/privkey.pem`
- **Expires:** 2025-11-27 (auto-renew enabled via `certbot.timer`)
- **Renewal service:** `systemctl status certbot.timer`
- **Renewal logs:** `journalctl -u certbot`

### Verify certificate & health

```bash
# Check HTTPS response headers (should be 200 from healthz)
curl -I https://tech.juicejunkiez.com/healthz

# Optional: show certificate chain details
echo | openssl s_client -servername tech.juicejunkiez.com -connect tech.juicejunkiez.com:443 2>/dev/null | openssl x509 -noout -issuer -subject -dates

Notes
	•	Nginx listens on port 80 for ACME HTTP challenges and general redirects; TLS termination is on 443.
	•	Certificates are stored under /etc/letsencrypt/live/; do not commit or copy keys into the repo.
	•	If renewal fails, check DNS records and ensure port 80 is reachable from the internet.