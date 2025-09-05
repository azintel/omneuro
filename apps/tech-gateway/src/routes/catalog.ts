// apps/tech-gateway/src/routes/catalog.ts
import { Router, type Request, type Response } from "express";
import {
  createService, updateService, listServices, getServiceByKey,
  createFee, updateFee, listFees, getFeeByKey, logEvent,
} from "../lib/db.js";

const router = Router();

// ---- Services ----
router.get("/services", (_req: Request, res: Response) => {
  res.json({ ok: true, items: listServices() });
});

router.post("/services", (req: Request, res: Response) => {
  const { key, name, description, base_price } = req.body || {};
  if (!key || !name || base_price == null) {
    return res.status(400).json({ error: "key, name, base_price required" });
  }
  const svc = createService({ key: String(key), name: String(name), description, base_price: Number(base_price) });
  logEvent({ actor: "tech-portal", type: "service.create", json: svc });
  res.json({ ok: true, service: svc });
});

router.patch("/services/:key", (req: Request, res: Response) => {
  const key = String(req.params.key);
  const patch: any = {};
  if ("name" in req.body) patch.name = req.body.name;
  if ("description" in req.body) patch.description = req.body.description;
  if ("base_price" in req.body) patch.base_price = Number(req.body.base_price);

  const updated = updateService(key, patch);
  if (!updated) return res.status(404).json({ error: "service_not_found" });
  logEvent({ actor: "tech-portal", type: "service.update", json: { key, patch } });
  res.json({ ok: true, service: updated });
});

router.get("/services/:key", (req: Request, res: Response) => {
  const svc = getServiceByKey(String(req.params.key));
  if (!svc) return res.status(404).json({ error: "service_not_found" });
  res.json({ ok: true, service: svc });
});

// ---- Fees ----
router.get("/fees", (_req: Request, res: Response) => {
  res.json({ ok: true, items: listFees() });
});

router.post("/fees", (req: Request, res: Response) => {
  const { key, name, description, unit_price } = req.body || {};
  if (!key || !name || unit_price == null) {
    return res.status(400).json({ error: "key, name, unit_price required" });
  }
  const fee = createFee({ key: String(key), name: String(name), description, unit_price: Number(unit_price) });
  logEvent({ actor: "tech-portal", type: "fee.create", json: fee });
  res.json({ ok: true, fee });
});

router.patch("/fees/:key", (req: Request, res: Response) => {
  const key = String(req.params.key);
  const patch: any = {};
  if ("name" in req.body) patch.name = req.body.name;
  if ("description" in req.body) patch.description = req.body.description;
  if ("unit_price" in req.body) patch.unit_price = Number(req.body.unit_price);

  const updated = updateFee(key, patch);
  if (!updated) return res.status(404).json({ error: "fee_not_found" });
  logEvent({ actor: "tech-portal", type: "fee.update", json: { key, patch } });
  res.json({ ok: true, fee: updated });
});

router.get("/fees/:key", (req: Request, res: Response) => {
  const fee = getFeeByKey(String(req.params.key));
  if (!fee) return res.status(404).json({ error: "fee_not_found" });
  res.json({ ok: true, fee });
});

export default router;