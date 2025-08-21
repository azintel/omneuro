omneuro/docs.ops/logs.md

```md
# logs (PM2 + CloudWatch)

## PM2 local logs
```bash
sudo -iu ubuntu bash -lc '
  pm2 logs brain-api --lines 80 --nostream || true
  pm2 logs tech-gateway --lines 80 --nostream || true
'