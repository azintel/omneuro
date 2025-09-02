// apps/tech-gateway/src/routes/garage.ts
// Client Garage API
//  - GET  /api/garage/health
//  - POST /api/garage/vehicles  { owner_email, name?, phone?, make, model, nickname?, notes? }
//  - GET  /api/garage/vehicles?owner_email=...

import express from "express";
import type { Request, Response } from "express";
import { upsertOwner, addVehicle, listVehiclesByOwner } from "../lib/db.js";
import { appendRow } from "../lib/sheets.js";

const router = express.Router();

router.get("/health", (_req, res) => {
  res.json({ ok: true, service: "garage" });
});

function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

router.post("/vehicles", async (req: Request, res: Response) => {
  try {
    const body = (req.body || {}) as Record<string, string | undefined>;
    const owner_email = (body.owner_email || "").trim();
    const name = (body.name || "").trim();
    const phone = (body.phone || "").trim();
    const make = (body.make || "").trim();
    const model = (body.model || "").trim();
    const nickname = (body.nickname || "").trim();
    const notes = (body.notes || "").trim();

    if (!owner_email || !isEmail(owner_email)) {
      return res.status(400).json({ error: "owner_email invalid" });
    }
    if (!make || !model) {
      return res.status(400).json({ error: "make and model required" });
    }

    // 1) DB
    upsertOwner({ email: owner_email, name, phone });
    const vehicle = addVehicle({ owner_email, make, model, nickname, notes });

    // 2) Sheets (best-effort)
    const now = new Date().toISOString();
    await appendRow("Vehicles!A:Z", [
      now, owner_email, name || "", phone || "", make, model, nickname || "", notes || "", vehicle.id ?? ""
    ]);

    // 3) (Future) emit ingest signal for Repairbot KB

    res.status(201).json({ ok: true, vehicle });
  } catch (err: any) {
    console.error("[garage] POST /vehicles error:", err?.message || err);
    res.status(500).json({ error: "server_error" });
  }
});

router.get("/vehicles", async (req: Request, res: Response) => {
  try {
    const owner_email = String(req.query.owner_email || "").trim();
    if (!owner_email || !isEmail(owner_email)) {
      return res.status(400).json({ error: "owner_email invalid" });
    }
    const items = listVehiclesByOwner(owner_email);
    res.json({ ok: true, items });
  } catch (err: any) {
    console.error("[garage] GET /vehicles error:", err?.message || err);
    res.status(500).json({ error: "server_error" });
  }
});

export default router;