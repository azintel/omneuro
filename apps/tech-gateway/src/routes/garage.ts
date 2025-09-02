// apps/tech-gateway/src/routes/garage.ts
import express from "express";
import type { Request, Response } from "express";
import { upsertOwner, addVehicle, listVehiclesByOwner } from "../lib/db.js";
import { appendRow } from "../lib/sheets.js";

const router = express.Router();

router.get("/health", (req, res) => {
  const rid = (req as any).req_id || "no-rid";
  console.log(`[garage][health] rid=${rid}`);
  res.json({ ok: true, service: "garage" });
});

function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

router.post("/vehicles", async (req: Request, res: Response) => {
  const rid = (req as any).req_id || "no-rid";
  try {
    const body = (req.body || {}) as Record<string, string | undefined>;
    console.log(`[garage][POST /vehicles] rid=${rid} bodyKeys=${Object.keys(body).join(",")}`);

    const owner_email = (body.owner_email || "").trim();
    const name = (body.name || "").trim();
    const phone = (body.phone || "").trim();
    const make = (body.make || "").trim();
    const model = (body.model || "").trim();
    const nickname = (body.nickname || "").trim();
    const notes = (body.notes || "").trim();

    if (!owner_email || !isEmail(owner_email)) {
      console.warn(`[garage] rid=${rid} invalid email="${owner_email}"`);
      return res.status(400).json({ error: "owner_email invalid" });
    }
    if (!make || !model) {
      console.warn(`[garage] rid=${rid} missing make/model`);
      return res.status(400).json({ error: "make and model required" });
    }

    upsertOwner({ email: owner_email, name, phone });
    const vehicle = addVehicle({ owner_email, make, model, nickname, notes });

    const now = new Date().toISOString();
    try {
      await appendRow("Vehicles!A:Z", [
        now, owner_email, name || "", phone || "", make, model, nickname || "", notes || "", vehicle.id ?? ""
      ]);
    } catch (e: any) {
      console.error(`[sheets][append] rid=${rid} error=${e?.message || e}`);
    }

    console.log(`[garage] rid=${rid} vehicle.id=${vehicle.id}`);
    res.status(201).json({ ok: true, vehicle });
  } catch (err: any) {
    console.error(`[garage] rid=${rid} POST /vehicles error:`, err?.message || err);
    res.status(500).json({ error: "server_error" });
  }
});

router.get("/vehicles", async (req: Request, res: Response) => {
  const rid = (req as any).req_id || "no-rid";
  try {
    const owner_email = String(req.query.owner_email || "").trim();
    if (!owner_email || !isEmail(owner_email)) {
      console.warn(`[garage] rid=${rid} invalid email query="${owner_email}"`);
      return res.status(400).json({ error: "owner_email invalid" });
    }
    const items = listVehiclesByOwner(owner_email);
    console.log(`[garage] rid=${rid} list count=${items.length}`);
    res.json({ ok: true, items });
  } catch (err: any) {
    console.error(`[garage] rid=${rid} GET /vehicles error:`, err?.message || err);
    res.status(500).json({ error: "server_error" });
  }
});

export default router;