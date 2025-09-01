# Omneuro — App Entrypoints

---
### apps/brain-api/dist/server.js
```js
import express from "express";
import { techRouter } from "./routes/tech.js";
const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 8081;
app.use(express.json({ limit: "5mb" }));
app.get("/healthz", (_req, res) => {
    res.json({ ok: true, service: "brain-api" });
});
app.use("/v1", techRouter);
app.use((req, res) => {
    res.status(404).json({ ok: false, error: `Unknown route: ${req.method} ${req.path}` });
});
app.listen(port, () => {
    console.log(`brain-api listening on port ${port}`);
});

```

---
### apps/brain-api/server.js
```js
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
```

---
### apps/tech-gateway/dist/routes.js
```js
import express, { Router } from 'express';
import { z } from 'zod';
import { logMessage, recentMessages } from './db.js';
export const appRouter = Router();
appRouter.post('/msg', (req, res) => {
    const schema = z.object({ phone: z.string().min(1), body: z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const { phone, body } = parsed.data;
    const row = logMessage(phone, body, 'in');
    res.json({ ok: true, message: row });
});
appRouter.get('/stream', (req, res) => {
    const techId = String(req.query.tech_id || '');
    if (!techId)
        return res.status(400).end();
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    const phone = `local-${techId}`;
    const items = recentMessages(phone);
    res.write(`data: ${JSON.stringify({ items })}\n\n`);
    const interval = setInterval(() => {
        res.write(`event: ping\ndata: {}\n\n`);
    }, 25000);
    req.on('close', () => clearInterval(interval));
});
appRouter.post('/reply', (req, res) => {
    const schema = z.object({ phone: z.string().min(1), body: z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const { phone, body } = parsed.data;
    const row = logMessage(phone, body, 'out');
    res.json({ ok: true, message: row });
});
//# sourceMappingURL=routes.js.map
```

---
### apps/tech-gateway/dist/server.js
```js
import techRouter from "./routes/tech.js";
import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { appRouter } from "./routes.js";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import chatRouter from "./routes/chat.js";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
//chatrouter
app.use("/api", chatRouter);
// body + cors
app.use(express.json({ limit: "5mb" }));
app.use(cors());
// req_id middleware (forwardable header)
app.use((req, res, next) => {
    const hdr = req.headers["x-request-id"];
    const rid = (Array.isArray(hdr) ? hdr[0] : hdr) || randomUUID();
    req.req_id = rid;
    res.setHeader("x-request-id", rid);
    next();
});
// basic health + diag
app.get("/healthz", (_req, res) => res.json({ ok: true }));
app.get("/api/health", (_req, res) => res.json({ ok: true })); // alias for /api/health
app.get("/api/tech/health", (_req, res) => res.json({ ok: true })); // alias for /api/tech/health
app.get("/admin/diag", (req, res) => {
    const key = process.env.DIAG_KEY || "";
    if (key && req.query.key !== key)
        return res.status(403).json({ error: "forbidden" });
    const tryRead = (p, n = 200) => {
        try {
            const s = fs.readFileSync(p, "utf8");
            const lines = s.trim().split("\n");
            return lines.slice(-n);
        }
        catch {
            return null;
        }
    };
    res.json({
        ok: true,
        pid: process.pid,
        cwd: process.cwd(),
        publicIndexExists: fs.existsSync(path.join(__dirname, "public", "index.html")),
        pm2: {
            outTail: tryRead("/home/ubuntu/.pm2/logs/tech-gateway-out.log"),
            errTail: tryRead("/home/ubuntu/.pm2/logs/tech-gateway-error.log"),
        },
    });
});
// app routers
app.use("/api/tech", techRouter);
app.use("/v1", appRouter);
// static
app.use("/", express.static(path.join(__dirname, "public")));
app.get("/", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
const port = Number(process.env.PORT || 8092);
app.listen(port, () => process.stdout.write(String(port)));
//# sourceMappingURL=server.js.map
```
