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

function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

// Health
router.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, service: "garage" });
});

// Create (vehicle)
router.post("/vehicles", async (req: Request, res: Response) => {
  try {
    const { owner_email, name, phone, make, model, nickname, notes } = (req.body || {}) as Record<string, any>;

    if (!owner_email || !isEmail(owner_email)) return res.status(400).json({ error: "owner_email invalid" });
    if (!make || !model) return res.status(400).json({ error: "make and model required" });

    // 1) DB (local/simple persistence)
    upsertOwner({ email: owner_email, name, phone });
    const vehicle = addVehicle({ owner_email, make, model, nickname, notes });

    // 2) Sheets (best-effort; no-op if not configured)
    const now = new Date().toISOString();
    await appendRow("Vehicles!A:Z", [
      now,
      owner_email,
      name || "",
      phone || "",
      make,
      model,
      nickname || "",
      notes || "",
      vehicle.id ?? ""
    ]);

    // 3) Future: emit KB ingest signal → brain-api (stub)

    return res.status(201).json({ ok: true, vehicle });
  } catch (err: any) {
    console.error("[garage] POST /vehicles error:", err?.message || err);
    return res.status(500).json({ error: "server_error" });
  }
});

// Read (by owner)
router.get("/vehicles", (req: Request, res: Response) => {
  try {
    const owner_email = String(req.query.owner_email || "");
    if (!owner_email || !isEmail(owner_email)) return res.status(400).json({ error: "owner_email invalid" });
    const items = listVehiclesByOwner(owner_email);
    return res.json({ ok: true, items });
  } catch (err: any) {
    console.error("[garage] GET /vehicles error:", err?.message || err);
    return res.status(500).json({ error: "server_error" });
  }
});

export default router;