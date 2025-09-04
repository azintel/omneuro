// apps/tech-gateway/src/routes/garage.ts

import { Router } from "express";
import type { Request, Response } from "express";
import db, { addVehicle, upsertOwner, listVehiclesByOwner } from "../lib/db.js";
import { appendVehicleRow } from "../lib/sheets.js";

const router = Router();

router.get("/health", (_req: Request, res: Response) => res.json({ ok: true, service: "garage" }));

// Add a vehicle (public)
router.post("/vehicles", async (req: Request, res: Response) => {
  try {
    const owner_email = String(req.body?.owner_email || "").trim().toLowerCase();
    const make = String(req.body?.make || "").trim();
    const model = String(req.body?.model || "").trim();
    const nickname = (req.body?.nickname ?? "").toString().trim() || undefined;
    const notes = (req.body?.notes ?? "").toString().trim() || undefined;

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(owner_email)) {
      return res.status(400).json({ error: "owner_email invalid" });
    }
    if (!make || !model) return res.status(400).json({ error: "make/model required" });

    // owner upsert (optional name/phone)
    const name = (req.body?.name ?? "").toString().trim() || undefined;
    const phone = (req.body?.phone ?? "").toString().trim() || undefined;
    upsertOwner({ email: owner_email, name, phone });

    const vehicle = addVehicle({ owner_email, make, model, nickname, notes });

    // Dual-write to Sheets (best effort)
    try {
      await appendVehicleRow(vehicle);
    } catch (e: any) {
      console.error("[sheets] vehicle append failed:", e?.message || e);
    }

    res.json({ ok: true, vehicle });
  } catch (err: any) {
    console.error("[garage] error:", err?.message || err);
    res.status(500).json({ error: "internal_error" });
  }
});

// List vehicles for a specific owner (public)
router.get("/vehicles", (req: Request, res: Response) => {
  const email = String(req.query?.owner_email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: "owner_email invalid" });
  }
  const items = listVehiclesByOwner(email);
  res.json({ ok: true, items });
});

export default router;