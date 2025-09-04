// apps/tech-gateway/src/routes/garage.ts
import { Router, Request, Response } from "express";
import db from "../db.js";
import { appendVehicleRow } from "../lib/sheets.js";

const router = Router();

// health
router.get("/health", (_req: Request, res: Response) => res.json({ ok: true, service: "garage" }));

// create vehicle
router.post("/vehicles", async (req: Request, res: Response) => {
  const { owner_email, make, model, nickname, notes } = req.body || {};
  if (!owner_email || !make || !model) return res.status(400).json({ error: "missing fields" });

  const stmt = db.prepare(`
    INSERT INTO vehicles (owner_email, make, model, nickname, notes, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `);
  const info = stmt.run(owner_email.trim().toLowerCase(), make, model, nickname ?? null, notes ?? null);

  const row = db.prepare(`
    SELECT id, owner_email, make, model, nickname, notes, created_at
    FROM vehicles WHERE id = ?
  `).get(info.lastInsertRowid as number);

  // best-effort Sheets logging
  try { await appendVehicleRow(row); } catch (e:any) { console.error("[garage] sheets append failed:", e?.message || String(e)); }

  res.json({ ok: true, vehicle: row });
});

// list vehicles for owner
router.get("/vehicles", (req: Request, res: Response) => {
  const email = String(req.query.owner_email || "").trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: "owner_email invalid" });
  }
  const rows = db.prepare(`
    SELECT id, owner_email, make, model, nickname, notes, created_at
    FROM vehicles
    WHERE owner_email = ?
    ORDER BY created_at DESC
  `).all(email);

  res.json({ ok: true, items: rows });
});

export default router;