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

// health
router.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, service: "garage" });
});

router.post("/vehicles", express.json(), async (req: Request, res: Response) => {
  try {
    const { owner_email, name, phone, make, model, nickname, notes } = (req.body || {});
    if (!owner_email || !isEmail(owner_email)) return res.status(400).json({ error: "owner_email invalid" });
    if (!make || !model) return res.status(400).json({ error: "make and model required" });

    // DB (in-memory / sqlite impl behind lib/db.ts)
    upsertOwner({ email: owner_email, name, phone });
    const vehicle = addVehicle({ owner_email, make, model, nickname, notes });

    // Sheets (best-effort)
    const now = new Date().toISOString();
    await appendRow("Vehicles!A:Z", [
      now, owner_email, name || "", phone || "", make, model, nickname || "", notes || "", vehicle.id ?? ""
    ]);

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