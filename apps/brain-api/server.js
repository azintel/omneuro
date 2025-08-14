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
app.use('/v1/google/sheets', sheetsRoutes);
app.get('/health', (req, res) => res.json({ ok: true }));
app.use('/v1/google/docs', docsRoutes);
app.use('/v1/google', googleRoutes);
app.use('/v1/battery', batteryRoutes);
app.use('/v1/admin', adminRoutes);
console.log('ADMIN_MOUNTED');
function listAppRoutes(router) {
  const out = [];
  (router.stack || []).forEach(layer => {
    if (layer.route) {
      out.push({ path: layer.route?.path, methods: Object.keys(layer.route?.methods || {}) });
    } else if (layer.name === 'router' && layer.handle?.stack) {
      const base = layer.regexp?.fast_slash ? '' : (layer.regexp?.toString() || '');
      const nested = [];
      layer.handle.stack.forEach(r => {
        if (r.route) nested.push({ path: r.route.path, methods: Object.keys(r.route.methods || {}) });
      });
      out.push({ router: base, nested });
    }
  });
  return out;
}
app.get('/__routes', (req, res) => {
  res.json({ ok: true, routes: listAppRoutes(app._router) });
});

// --- /api/deploy (fixed) ---
import fs from 'fs';
import { execSync } from 'child_process';

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const DEPLOY_LOG = '/home/ubuntu/omneuro/apps/brain-api/deploy.log';
const PROJECT_DIR = '/home/ubuntu/omneuro';
const HEALTH_URL = 'http://127.0.0.1:8081/health';

async function waitForHealthy(timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs;
  let lastErr = '';
  while (Date.now() < deadline) {
    try {
      execSync(`curl -fsS ${HEALTH_URL} >/dev/null`, { stdio: 'ignore' });
      return { healthy: true, lastErr: '' };
    } catch (e) {
      lastErr = e?.message || String(e);
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  return { healthy: false, lastErr };
}

app.post(['/api/deploy', '/deploy'], express.json(), async (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    const { reason = 'manual', sha = '', actor = '', repo = '' } = req.body || {};
    const ts = new Date().toISOString();
    const line = `[${ts}] actor=${actor} repo=${repo} sha=${sha} reason="${reason}"\n`;
    try { fs.appendFileSync(DEPLOY_LOG, line); } catch {}

    // pull & restart
    execSync(
      `bash -lc 'set -e; cd ${PROJECT_DIR}; git fetch origin; git reset --hard origin/main; cd apps/brain-api; pm2 restart brain-api; pm2 save'`,
      { stdio: 'inherit' }
    );

    const { healthy, lastErr } = await waitForHealthy(25000);
    const resultLine = `[${new Date().toISOString()}] deploy_result healthy=${healthy} lastErr="${lastErr}"\n`;
    try { fs.appendFileSync(DEPLOY_LOG, resultLine); } catch {}

    if (!healthy) {
      return res.status(500).json({ ok: false, error: `Health check failed: ${lastErr}` });
    }

    return res.json({ ok: true, deployed: true, sha, actor, repo });
  } catch (err) {
    const msg = err?.message || String(err);
    try { fs.appendFileSync(DEPLOY_LOG, `[${new Date().toISOString()}] deploy_error "${msg}"\n`); } catch {}
    return res.status(500).json({ ok: false, error: msg });
  }
});
// single listen only (env-driven)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`brain-api listening on :${PORT}`);
});
