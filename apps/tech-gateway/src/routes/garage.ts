// apps/tech-gateway/src/routes/garage.ts
// Client Garage API
//  - POST /api/garage/vehicles  { owner_email, name?, phone?, make, model, nickname?, notes? }
//  - GET  /api/garage/vehicles?owner_email=...

import express from "express";
import type { Request, Response } from "express";
import { upsertOwner, addVehicle, listVehiclesByOwner } from "../lib/db.js";
import { appendRow } from "../lib/sheets.js";

const router = express.Router();

function isEmail(s: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }

router.post("/vehicles", express.json(), async (req: Request, res: Response) => {
  try {
    const { owner_email, name, phone, make, model, nickname, notes } = (req.body || {});

    if (!owner_email || !isEmail(owner_email)) return res.status(400).json({ error: "owner_email invalid" });
    if (!make || !model) return res.status(400).json({ error: "make and model required" });

    // 1) DB
    upsertOwner({ email: owner_email, name, phone });
    const vehicle = addVehicle({ owner_email, make, model, nickname, notes });

    // 2) Sheets (best-effort)
    const now = new Date().toISOString();
    await appendRow("Vehicles!A:Z", [
      now, owner_email, name || "", phone || "", make, model, nickname || "", notes || "", vehicle.id ?? ""
    ]);

    // 3) (Optional) emit ingest signal for Repairbot KB (stub for now)
    // TODO: when brain-api ingestion contract is finalized, send event here.

    res.status(201).json({ ok: true, vehicle });
  } catch (err: any) {
    console.error("[garage] POST /vehicles error:", err?.message || err);
    res.status(500).json({ error: "server_error" });
  }
});

router.get("/vehicles", async (req: Request, res: Response) => {
  try {
    const owner_email = String(req.query.owner_email || "");
    if (!owner_email || !isEmail(owner_email)) return res.status(400).json({ error: "owner_email invalid" });
    const items = listVehiclesByOwner(owner_email);
    res.json({ ok: true, items });
  } catch (err: any) {
    console.error("[garage] GET /vehicles error:", err?.message || err);
    res.status(500).json({ error: "server_error" });
  }
});

export default router;