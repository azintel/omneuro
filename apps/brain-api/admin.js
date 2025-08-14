import express from 'express';
import fs from 'fs';
import os from 'os';
import { exec } from 'child_process';

const router = express.Router();

function getAdminToken() {
  if (process.env.ADMIN_TOKEN && process.env.ADMIN_TOKEN.trim()) return process.env.ADMIN_TOKEN.trim();
  try {
    const s = fs.readFileSync('/home/ubuntu/omneuro/.secrets/admin_token.txt', 'utf8');
    return (s || '').trim();
  } catch {
    return '';
  }
}

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const expected = getAdminToken();
  if (!expected || token !== expected) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  next();
}

import { getAppointments } from "./lib/scheduler.js";
import { sendSMS } from "./lib/sms.js";

adminRoutes.post("/notify/day", requireAdmin, async (req, res) => {
  const { date, message = "", dry_run = true } = req.body || {};
  const appts = await getAppointments(date);
  const msgs = appts.map(a => {
    const time = new Date(a.start_time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const body = message && message.length > 0
      ? message.replaceAll("{name}", a.client_name).replaceAll("{time}", time).replaceAll("{service}", a.service)
      : `Reminder: ${a.service} at ${time}. Reply if you need to reschedule.`;
    return { to: a.client_phone, body, meta: { client_id: a.client_id, appt_id: a.id } };
  });
  if (dry_run) {
    return res.json({ ok: true, count: msgs.length, preview: msgs });
  }
  const results = [];
  for (const m of msgs) {
    const r = await sendSMS({ to: m.to, body: m.body });
    results.push({ to: m.to, status: r.status, ok: r.ok });
    await new Promise(r => setTimeout(r, 100));
  }
  return res.json({ ok: true, count: msgs.length, results });
});

function listRoutes(r) {
  const out = [];
  (r.stack || []).forEach(layer => {
    if (layer.route) {
      out.push({ path: layer.route.path, methods: Object.keys(layer.route.methods || {}) });
    } else if (layer.name === 'router' && layer.handle?.stack) {
      const nested = [];
      layer.handle.stack.forEach(rr => {
        if (rr.route) nested.push({ path: rr.route.path, methods: Object.keys(rr.route.methods || {}) });
      });
      out.push({ nested });
    }
  });
  return out;
}

router.get('/ping', (req, res) => {
  res.json({ ok: true, feature: 'admin' });
});

router.get('/_routes', (req, res) => {
  res.json({ ok: true, routes: listRoutes(router) });
});

router.get('/status', requireAdmin, (req, res) => {
  res.json({
    ok: true,
    pid: process.pid,
    uptime_s: Math.floor(process.uptime()),
    memory: process.memoryUsage(),
    versions: process.versions,
    env: {
      NODE_ENV: process.env.NODE_ENV || '',
      PORT: process.env.PORT || '',
      PM2_HOME: process.env.PM2_HOME || ''
    },
    host: {
      hostname: os.hostname(),
      platform: os.platform(),
      release: os.release(),
      loadavg: os.loadavg(),
      freemem: os.freemem(),
      totalmem: os.totalmem(),
      cpus: os.cpus()?.length || 0
    }
  });
});

router.get('/logs', requireAdmin, (req, res) => {
  const base = '/home/ubuntu/omneuro/apps/brain-api';
  const name = (req.query.file || 'deploy.out').toString().replace(/[^-_.a-zA-Z0-9]/g, '');
  const p = `${base}/${name}`;
  const lines = Math.max(1, Math.min(2000, parseInt(req.query.lines || '200', 10)));
  try {
    const data = fs.readFileSync(p, 'utf8').split('\n').slice(-lines).join('\n');
    res.type('text/plain').send(data);
  } catch (e) {
    res.status(404).json({ ok: false, error: `cannot read ${name}` });
  }
});

router.post('/deploy', requireAdmin, (req, res) => {
  const baseDir = '/home/ubuntu/omneuro/apps/brain-api';
  const outFile = `${baseDir}/deploy.out`;
  const scriptFile = `${baseDir}/deploy.sh`;
  const script = [
    'set -e',
    'cd /home/ubuntu/omneuro',
    'git fetch origin',
    'git reset --hard origin/main',
    'cd apps/brain-api',
    'pm2 restart brain-api --update-env',
    'pm2 save'
  ].join('\n');
  try {
    fs.writeFileSync(scriptFile, `#!/usr/bin/env bash\n${script}\n`, { mode: 0o755 });
    if (!fs.existsSync(outFile)) fs.writeFileSync(outFile, '', { mode: 0o644 });
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'write_script_failed' });
  }
  try {
    exec(`nohup bash "${scriptFile}" >> "${outFile}" 2>&1 &`);
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'exec_failed' });
  }
  res.status(202).json({ ok: true, accepted: true });
});

export default router;