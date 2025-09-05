// apps/tech-gateway/src/routes/garage.ts
import { Router, type Request, type Response } from "express";
import { upsertOwner, addVehicle, listVehiclesByOwner } from "../lib/db.js";

const router = Router();

router.post("/vehicles", (req: Request, res: Response) => {
  try {
    const body = req.body as {
      owner_email: string; make: string; model: string;
      nickname?: string; notes?: string;
      owner_name?: string; owner_phone?: string;
    };

    // keep owners table fresh
    upsertOwner({ email: body.owner_email, name: body.owner_name ?? null, phone: body.owner_phone ?? null });

    const v = addVehicle({
      owner_email: body.owner_email,
      make: body.make,
      model: body.model,
      nickname: body.nickname ?? null,
      notes: body.notes ?? null,
    });

    res.json({ ok: true, vehicle: v });
  } catch (e: any) {
    res.status(400).json({ error: e?.message || String(e) });
  }
});

router.get("/vehicles", (req: Request, res: Response) => {
  const email = String(req.query.owner_email || "").trim().toLowerCase();
  if (!email) return res.status(400).json({ error: "owner_email required" });
  res.json({ ok: true, items: listVehiclesByOwner(email) });
});

export default router;