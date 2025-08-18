import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { logMessage, recentMessages } from './db.js';

export const appRouter = Router();

appRouter.post('/msg', (req: Request, res: Response) => {
  const schema = z.object({ phone: z.string().min(1), body: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { phone, body } = parsed.data;
  const row = logMessage(phone, body, 'in');
  res.json({ ok: true, message: row });
});

appRouter.get('/stream', (req: Request, res: Response) => {
  const techId = String(req.query.tech_id || '');
  if (!techId) return res.status(400).end();
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

appRouter.post('/reply', (req: Request, res: Response) => {
  const schema = z.object({ phone: z.string().min(1), body: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { phone, body } = parsed.data;
  const row = logMessage(phone, body, 'out');
  res.json({ ok: true, message: row });
});