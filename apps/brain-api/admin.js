import express from 'express';
import { execFile } from 'node:child_process';

const router = express.Router();

function requireAdmin(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  next();
}

router.get('/ping', requireAdmin, (req, res) => {
  res.json({ ok: true, feature: 'admin' });
});

router.get('/version', requireAdmin, (req, res) => {
  execFile('git', ['rev-parse', 'HEAD'], { cwd: '/home/ubuntu/omneuro' }, (err, stdout) => {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    res.json({ ok: true, sha: stdout.trim() });
  });
});

router.post('/sync', requireAdmin, (req, res) => {
  const cmd = `
    set -e
    git fetch origin
    git reset --hard origin/main
    pm2 restart brain-api
  `;
  execFile('/bin/bash', ['-lc', cmd], { cwd: '/home/ubuntu/omneuro' }, (err, stdout, stderr) => {
    if (err) return res.status(500).json({ ok: false, error: err.message, stderr });
    res.json({ ok: true, stdout });
  });
});

router.get('/logs', requireAdmin, (req, res) => {
  const n = String(Number(req.query.n) || 200);
  execFile('/bin/bash', ['-lc', `pm2 logs brain-api --lines ${n} --nostream`], { cwd: '/home/ubuntu' }, (err, stdout, stderr) => {
    if (err) return res.status(500).json({ ok: false, error: err.message, stderr });
    res.json({ ok: true, lines: stdout.split('\n').slice(-Number(n)) });
  });
});

export default router;