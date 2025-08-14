import express from 'express';
import { exec } from 'child_process';

const adminRoutes = express.Router();

import fs from 'fs';
import { execSync } from 'child_process';

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
function requireAdmin(req, res) {
  const auth = req.headers.authorization || '';
  const tok = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!ADMIN_TOKEN || tok !== ADMIN_TOKEN) {
    res.status(401).json({ ok: false, error: 'Unauthorized' });
    return false;
  }
  return true;
}

function sh(cmd) {
  try { return execSync(cmd, { encoding: 'utf8' }); }
  catch (e) { return (e?.stdout || '') + (e?.stderr || e.message); }
}

// GET /v1/admin/status
// Lightweight snapshot so we can see process + git + listeners without SSH.
router.get('/status', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const port = process.env.PORT || '8081';
  const now = new Date().toISOString();

  const pm2 = sh('pm2 jlist | head -c 20000'); // cap output
  const git = sh('bash -lc "cd ~/omneuro; git rev-parse --short HEAD; git --no-pager log -1 --oneline"');
  const listeners = sh(`ss -ltnp | grep ":${port} " || true`);

  res.json({
    ok: true,
    now,
    env: { PORT: port },
    pm2: pm2.trim(),
    git: git.trim(),
    listeners: listeners.trim(),
  });
});

// GET /v1/admin/logs?lines=200&src=app|err|nginx
// src=app -> pm2 out, src=err -> pm2 error, src=nginx -> nginx error
router.get('/logs', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const lines = Math.max(1, Math.min(1000, parseInt(req.query.lines, 10) || 200));
  const src = String(req.query.src || 'app');

  const PATHS = {
    app: '/home/ubuntu/.pm2/logs/brain-api-out.log',
    err: '/home/ubuntu/.pm2/logs/brain-api-error.log',
    nginx: '/var/log/nginx/error.log',
  };
  const file = PATHS[src] || PATHS.app;

  let content = '';
  if (fs.existsSync(file)) {
    content = sh(`tail -n ${lines} ${file}`);
  } else {
    content = `Missing log file: ${file}`;
  }

  res.json({ ok: true, src, lines, file, content });
});

// Tiny bearer auth helper
function requireAdmin(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  next();
}

// Health
adminRoutes.get('/ping', requireAdmin, (req, res) => {
  res.json({ ok: true, feature: 'admin' });
});

// Trigger deploy on the box
adminRoutes.post('/deploy', requireAdmin, (req, res) => {
  // adjust commands here as needed
  const cmd = `
    set -e
    cd ~/omneuro
    git fetch origin
    git reset --hard origin/main
    cd ~/omneuro/apps/brain-api
    pm2 restart brain-api --update-env
    pm2 save
  `.trim();

  exec(cmd, { shell: '/bin/bash' }, (err, stdout, stderr) => {
    if (err) {
      return res.status(500).json({ ok: false, error: err.message, stderr });
    }
    res.json({ ok: true, ran: cmd.split('\n')[0] + ' ...', stdout });
  });
});

export default adminRoutes;