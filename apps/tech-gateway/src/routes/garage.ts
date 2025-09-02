// Client Garage API
//  - GET  /api/garage/health
//  - POST /api/garage/vehicles                  body: { owner_email, name?, phone?, make, model, nickname?, notes? }
//  - GET  /api/garage/vehicles?owner_email=...

import express, { type Request, type Response } from "express";
// Import as any to avoid TS signature mismatches across refactors
import * as _db from "../lib/db.js";
import { appendRow } from "../lib/sheets.js";

const { upsertOwner, addVehicle, listVehiclesByOwner } = _db as any;
const router = express.Router();

router.get("/health", (_req: Request, res: Response) => res.json({ ok: true }));

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isEmail = (s: string) => emailRe.test(String(s || "").trim());

router.post("/vehicles", express.json(), async (req: Request, res: Response) => {
  try {
    const { owner_email, name, phone, make, model, nickname, notes } =
      (req.body ?? {}) as Record<string, string | undefined>;

    if (!owner_email || !isEmail(owner_email)) {
      return res.status(400).json({ error: "owner_email invalid" });
    }
    if (!make || !model) {
      return res.status(400).json({ error: "make and model required" });
    }

    // 1) DB: upsert owner (email is canonical)
    try {
      upsertOwner({ email: owner_email, name, phone });
    } catch (e) {
      console.warn("[garage] upsertOwner failed (continuing):", (e as any)?.message || e);
    }

    // 2) DB: add vehicle — support multiple historical signatures
    let vehicle: any = null;
    const candidates = [
      // snake_case shape
      { owner_email, make, model, nickname, notes },
      // camelCase shape
      { ownerEmail: owner_email, make, model, nickname, notes },
    ] as const;

    for (const payload of candidates) {
      try {
        vehicle = (addVehicle as any)(payload);
        if (vehicle) break;
      } catch {
        // try next signature
      }
    }
    // Last resort: positional (owner_email, make, model, opts)
    if (!vehicle) {
      try {
        vehicle = (addVehicle as any)(owner_email, make, model, { nickname, notes });
      } catch (e) {
        console.error("[garage] addVehicle failed:", (e as any)?.message || e);
        return res.status(500).json({ error: "db_error" });
      }
    }

    // 3) Sheets (best-effort dual-write)
    try {
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
        vehicle?.id || "",
      ]);
    } catch (e) {
      console.warn("[garage] sheets append failed (non-fatal):", (e as any)?.message || e);
    }

    // 4) Future: emit event → brain-api to prefetch KB

    return res.status(201).json({ ok: true, vehicle });
  } catch (err: any) {
    console.error("[garage] POST /vehicles error:", err?.message || err);
    return res.status(500).json({ error: "server_error" });
  }
});

router.get("/vehicles", async (req: Request, res: Response) => {
  try {
    const owner_email = String(req.query.owner_email || "");
    if (!owner_email || !isEmail(owner_email)) {
      return res.status(400).json({ error: "owner_email invalid" });
    }

    // Support both shapes for compatibility
    let items: any[] = [];
    try {
      items = (listVehiclesByOwner as any)(owner_email);
    } catch {
      try {
        items = (listVehiclesByOwner as any)({ owner_email });
      } catch {
        items = (listVehiclesByOwner as any)({ ownerEmail: owner_email });
      }
    }

    return res.json({ ok: true, items });
  } catch (err: any) {
    console.error("[garage] GET /vehicles error:", err?.message || err);
    return res.status(500).json({ error: "server_error" });
  }
});

export default router;