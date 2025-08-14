import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import bodyParser from 'body-parser';
import docsRoutes from './docs.js';
import sheetsRoutes from './sheets.js';
import googleRoutes from './google.js';
import batteryRoutes from './battery.js';
import adminRoutes from './admin.js';

const PORT = parseInt(process.env.PORT || '8081', 10);
const app = express();

app.use(cors());
app.use(morgan('dev'));
app.use(bodyParser.json({ limit: '2mb' }));

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/v1/google/sheets', sheetsRoutes);
app.use('/v1/google/docs', docsRoutes);
app.use('/v1/google', googleRoutes);
app.use('/v1/battery', batteryRoutes);
app.use('/v1/admin', adminRoutes);

import crypto from 'crypto';

const ADMIN_TOKEN = (process.env.ADMIN_TOKEN || '').trim();

function bearer(req) {
  const h = req.headers['authorization'] || '';
  return h.startsWith('Bearer ') ? h.slice(7) : '';
}

app.post('/v1/admin/notify/day', async (req, res) => {
  if (!ADMIN_TOKEN || bearer(req) !== ADMIN_TOKEN) return res.status(401).json({ ok: false, error: 'unauthorized' });
  const { dry_run = true, recipients = [], template = 'Appt reminder for {name} at {time}' } = req.body || {};
  const telnyxReady = !!(process.env.TELNYX_API_KEY && process.env.TELNYX_FROM);
  const preview = (recipients || []).slice(0, 10).map(r => ({
    id: crypto.randomUUID(),
    to: r.phone || '',
    text: template
      .replace('{name}', r.name || '')
      .replace('{time}', r.time || '')
  }));
  if (dry_run || !telnyxReady) return res.json({ ok: true, dry_run: true, telnyx_ready: telnyxReady, count: recipients.length, preview });
  return res.json({ ok: true, enqueued: recipients.length, telnyx_ready: telnyxReady });
});

console.log('ADMIN_MOUNTED');

function listAppRoutes(router) {
  const out = [];
  (router.stack || []).forEach(layer => {
    if (layer.route) {
      out.push({ path: layer.route.path, methods: Object.keys(layer.route.methods || {}) });
    } else if (layer.name === 'router' && layer.handle?.stack) {
      const nested = [];
      layer.handle.stack.forEach(r => {
        if (r.route) nested.push({ path: r.route.path, methods: Object.keys(r.route.methods || {}) });
      });
      out.push({ nested });
    }
  });
  return out;
}

app.get('/__routes', (req, res) => {
  res.json({ ok: true, routes: listAppRoutes(app._router) });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`brain-api listening on :${PORT}`);
});
server.on('error', (e) => {
  console.error(e);
  process.exit(1);
});