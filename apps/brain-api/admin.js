// apps/brain-api/admin.js
import express from 'express';
import crypto from 'crypto';
import { exec } from 'child_process';
import util from 'util';

const router = express.Router();
const sh = util.promisify(exec);

// --- config via env (set on EC2 via PM2 ecosystem) ---
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || '';

// simple bearer token guard
function requireAdmin(req, res, next) {
  const hdr = req.get('X-Admin-Token') || req.get('Authorization') || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : hdr;
  if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  next();
}

// health / whoami / env sanity (no secrets echoed)
router.get('/ping', requireAdmin, (req, res) => {
  res.json({
    ok: true,
    service: 'admin',
    node: process.version,
    pid: process.pid,
    cwd: process.cwd(),
    haveSecrets: {
      ADMIN_TOKEN: !!ADMIN_TOKEN,
      GITHUB_WEBHOOK_SECRET: !!GITHUB_WEBHOOK_SECRET,
    },
  });
});

// deploy = git pull + pm2 restart (idempotent, short output)
router.post('/deploy', requireAdmin, async (req, res) => {
  try {
    const { stdout: s1, stderr: e1 } = await sh('git fetch origin && git reset --hard origin/main', { cwd: process.cwd() });
    const { stdout: s2, stderr: e2 } = await sh('pm2 restart brain-api', { cwd: process.cwd() });
    res.json({ ok: true, fetch: (s1+e1).trim().slice(-4000), restart: (s2+e2).trim().slice(-4000) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message, out: err.stdout, err: err.stderr });
  }
});

// pm2 restart only
router.post('/pm2/restart', requireAdmin, async (req, res) => {
  try {
    const { stdout, stderr } = await sh('pm2 restart brain-api');
    res.json({ ok: true, out: (stdout+stderr).trim().slice(-4000) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message, out: err.stdout, err: err.stderr });
  }
});

// tail logs
router.get('/logs/tail', requireAdmin, async (req, res) => {
  const n = Math.min(Math.max(parseInt(req.query.lines || '200', 10) || 200, 50), 2000);
  try {
    const { stdout, stderr } = await sh(`tail -n ${n} /home/ubuntu/.pm2/logs/brain-api-out-*.log /home/ubuntu/.pm2/logs/brain-api-error-*.log || true`);
    res.type('text/plain').send((stdout || stderr || '').slice(-20000));
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- GitHub webhook (push) -> git pull + pm2 restart ---
function verifyGitHub(req) {
  const sig = req.get('X-Hub-Signature-256') || '';
  const body = JSON.stringify(req.body || {});
  const mac = 'sha256=' + crypto.createHmac('sha256', GITHUB_WEBHOOK_SECRET).update(body).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(mac));
  } catch {
    return false;
  }
}

router.post('/webhook/github', express.json({ type: '*/*' }), async (req, res) => {
  if (!GITHUB_WEBHOOK_SECRET) return res.status(400).json({ ok: false, error: 'no secret configured' });
  if (!verifyGitHub(req))   return res.status(401).json({ ok: false, error: 'bad signature' });

  const event = req.get('X-GitHub-Event') || '';
  const ref   = (req.body && req.body.ref) || '';
  // only care about push to main
  if (event !== 'push' || ref !== 'refs/heads/main') {
    return res.json({ ok: true, skipped: true, event, ref });
  }

  try {
    const { stdout: s1, stderr: e1 } = await sh('git fetch origin && git reset --hard origin/main', { cwd: process.cwd() });
    const { stdout: s2, stderr: e2 } = await sh('pm2 restart brain-api', { cwd: process.cwd() });
    res.json({ ok: true, fetch: (s1+e1).trim().slice(-4000), restart: (s2+e2).trim().slice(-4000) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message, out: err.stdout, err: err.stderr });
  }
});

export default router;