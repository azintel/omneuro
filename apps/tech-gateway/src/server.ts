import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appRouter } from './routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());
app.get('/healthz', (_req, res) => res.json({ ok: true }));
app.use('/v1', appRouter);

// static web UI
const pubDir = path.join(__dirname, 'public');
app.use(express.static(pubDir, { index: 'index.html' }));
app.get('/', (_req, res) => res.sendFile(path.join(pubDir, 'index.html')));

const port = Number(process.env.PORT || 8092);
app.listen(port, () => process.stdout.write(String(port)));