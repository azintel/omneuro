import { Router } from 'express';
import { execSync, exec } from 'child_process';

const adminRoutes = Router();

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const adminToken = process.env.ADMIN_TOKEN || '';
  if (!adminToken || token !== adminToken) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  next();
}

adminRoutes.get('/ping', requireAdmin, (req, res) => {
  res.json({ ok: true, feature: 'admin' });
});

adminRoutes.get('/status', requireAdmin, (req, res) => {
  const env = {
    PORT: process.env.PORT || '',
    GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS || '',
    ADMIN_TOKEN_SET: Boolean(process.env.ADMIN_TOKEN)
  };
  res.json({ ok: true, env });
});

adminRoutes.post('/deploy', requireAdmin, (req, res) => {
  res.status(202).json({ ok: true, accepted: true });
  const script = [
    'set -e',
    'cd ~/omneuro',
    'git fetch origin',
    'git reset --hard origin/main',
    'cd apps/brain-api',
    'pm2 restart brain-api --update-env',
    'pm2 save'
  ].join(' && ');
  exec(`nohup bash -lc "${script}" > /home/ubuntu/omneuro/apps/brain-api/deploy.out 2>&1 &`);
});

adminRoutes.post('/notify/day', requireAdmin, async (req, res) => {
  const body = req.body || {};
  const dryRun = Boolean(body.dry_run ?? true);
  const recipients = Array.isArray(body.recipients) ? body.recipients : [];
  const telnyxKey = process.env.TELNYX_API_KEY || '';
  const telnyxFrom = process.env.TELNYX_MESSAGING_PROFILE_ID || '';

  const summary = {
    dryRun,
    count: recipients.length,
    telnyxConfigured: Boolean(telnyxKey && telnyxFrom)
  };

  if (dryRun || !telnyxKey || !telnyxFrom) {
    return res.json({ ok: true, mode: 'dry_run', summary, recipients });
  }

  const results = [];
  for (const r of recipients) {
    results.push({ to: r.phone, status: 'queued' });
  }
  res.json({ ok: true, mode: 'live', summary, results });
});

export default adminRoutes;