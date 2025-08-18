import { Router } from 'express';
import { db, nid } from './db.js';
import { z } from 'zod';
const router = Router();
const inSchema = z.object({ phone: z.string().min(7), name: z.string().optional(), body: z.string().min(1) });
const replySchema = z.object({ tech_id: z.string().min(6), body: z.string().min(1) });
router.post('/msg', (req, res) => {
    const p = inSchema.parse(req.body);
    let tech = db.prepare('SELECT * FROM technicians WHERE phone=?').get(p.phone);
    if (!tech) {
        const id = nid();
        db.prepare('INSERT INTO technicians(id,phone,name) VALUES(?,?,?)').run(id, p.phone, p.name || null);
        tech = db.prepare('SELECT * FROM technicians WHERE id=?').get(id);
    }
    const mid = nid();
    db.prepare('INSERT INTO messages(id,tech_id,dir,body) VALUES(?,?,?,?)').run(mid, tech.id, 'in', p.body);
    res.json({ ok: true, tech_id: tech.id, message_id: mid });
});
router.get('/stream', (req, res) => {
    const techId = String(req.query.tech_id || '');
    if (!techId) {
        res.status(400).end();
        return;
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
    const rows = db.prepare('SELECT * FROM messages WHERE tech_id=? ORDER BY created_at ASC').all(techId);
    send({ type: 'bootstrap', items: rows });
    const stmt = db.prepare('SELECT * FROM messages WHERE tech_id=? AND created_at>datetime(?) ORDER BY created_at ASC');
    let since = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const timer = setInterval(() => {
        const items = stmt.all(techId, since);
        if (items.length) {
            since = items[items.length - 1].created_at.replace('T', ' ');
            send({ type: 'append', items });
        }
    }, 1000);
    req.on('close', () => clearInterval(timer));
});
router.post('/reply', (req, res) => {
    const p = replySchema.parse(req.body);
    const tech = db.prepare('SELECT * FROM technicians WHERE id=?').get(p.tech_id);
    if (!tech) {
        res.status(404).json({ ok: false });
        return;
    }
    const mid = nid();
    db.prepare('INSERT INTO messages(id,tech_id,dir,body) VALUES(?,?,?,?)').run(mid, tech.id, 'out', p.body);
    res.json({ ok: true, message_id: mid });
});
export const router = router;
//# sourceMappingURL=routes.js.map