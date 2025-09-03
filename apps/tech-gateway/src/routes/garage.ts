// apps/tech-gateway/src/routes/garage.ts

import express from "express";
import type { Request, Response } from "express";
import db from "../db.js";
import { appendRow } from "../lib/sheets.js";

const router = express.Router();

// Health
router.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, service: "garage" });
});

// Ensure table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_email TEXT NOT NULL,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    nickname TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

type VehicleInsert = {
  owner_email: string;
  make: string;
  model: string;
  nickname?: string | null;
  notes?: string | null;
};

type VehicleRow = {
  id: number;
  owner_email: string;
  make: string;
  model: string;
  nickname: string | null;
  notes: string | null;
  created_at: string;
};

// Create a vehicle
router.post("/vehicles", (req: Request, res: Response) => {
  try {
    const body = req.body as Partial<VehicleInsert> | undefined;

    const owner_email = String(body?.owner_email ?? "").trim().toLowerCase();
    const make = String(body?.make ?? "").trim();
    const model = String(body?.model ?? "").trim();
    const nickname = (body?.nickname ?? null) as string | null;
    const notes = (body?.notes ?? null) as string | null;

    if (!owner_email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(owner_email)) {
      return res.status(400).json({ error: "owner_email invalid" });
    }
    if (!make || !model) {
      return res.status(400).json({ error: "make and model are required" });
    }

    const ins = db.prepare(
      `INSERT INTO vehicles (owner_email, make, model, nickname, notes)
       VALUES (?, ?, ?, ?, ?)`
    );
    const info = ins.run(owner_email, make, model, nickname, notes);

    const row = db
      .prepare(
        `SELECT id, owner_email, make, model, nickname, notes, created_at
         FROM vehicles WHERE id = ?`
      )
      .get(info.lastInsertRowid as number) as VehicleRow | undefined;

    if (!row) {
      return res.status(500).json({ error: "insert failed" });
    }

    // Fire-and-forget write to Sheets (logs its own errors)
    void appendRow({
      owner_email: row.owner_email,
      make: row.make,
      model: row.model,
      nickname: row.nickname,
      notes: row.notes,
    });

    return res.json({ ok: true, vehicle: row });
  } catch (err: any) {
    console.error("[garage] /vehicles POST error:", err?.message || err);
    return res.status(500).json({ error: "internal" });
  }
});

// List vehicles for an owner
router.get("/vehicles", (req: Request, res: Response) => {
  const owner_email = String(req.query?.owner_email ?? "")
    .trim()
    .toLowerCase();

  if (!owner_email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(owner_email)) {
    return res.status(400).json({ error: "owner_email invalid" });
  }

  const stmt = db.prepare(
    `SELECT id, owner_email, make, model, nickname, notes, created_at
     FROM vehicles
     WHERE owner_email = ?
     ORDER BY created_at DESC`
  );
  const rows = stmt.all(owner_email) as VehicleRow[];

  res.json({ ok: true, items: rows });
});

export default router;