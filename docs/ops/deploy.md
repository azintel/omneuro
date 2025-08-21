# Deploy Workflow (Scripts)

## Scripts (in repo)
- `scripts/deploy/01-build.sh` — git sync + build both services
- `scripts/deploy/02-restart.sh` — restart PM2 processes
- `scripts/deploy/03-sanity.sh` — health checks via curl

## Steps
1. Connect to the server via SSM (see `ssm.md`).
   ```
   aws ssm start-session --region us-east-2 --target <instance-id>
   ```

2. One-time setup (only needed the first time, or after adding new scripts):
   ```
   sudo -iu ubuntu bash -lc 'chmod +x /home/ubuntu/omneuro/scripts/deploy/*.sh'
   ```

3. Build apps:
   ```
   sudo -iu ubuntu /home/ubuntu/omneuro/scripts/deploy/01-build.sh
   ```

4. Restart PM2 processes:
   ```
   sudo -iu ubuntu /home/ubuntu/omneuro/scripts/deploy/02-restart.sh
   ```

5. Run sanity checks:
   ```
   sudo -iu ubuntu /home/ubuntu/omneuro/scripts/deploy/03-sanity.sh
   ```

6. Verify PM2 status:
   ```
   sudo -iu ubuntu bash -lc 'pm2 status'
   ```

### Expected
- `brain-api` → `online`
- `tech-gateway` → `online`