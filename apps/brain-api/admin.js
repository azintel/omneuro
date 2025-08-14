import express from 'express';
import { exec } from 'child_process';

const adminRoutes = express.Router();

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