// apps/brain-api/src/routes/tech.ts
import { Router } from "express";
export const techRouter = Router();

techRouter.post("/repairbot/message", async (req, res) => {
  const rid = (req.header("x-request-id") || "").toString();
  const payload = req.body ?? {};
  res.json({ ok: true, route: "repairbot_message", rid, received: payload });
});

techRouter.patch("/jobs/:id/status", async (req, res) => {
  const rid = (req.header("x-request-id") || "").toString();
  const id = req.params.id;
  const payload = req.body ?? {};
  res.json({ ok: true, route: "job_status", rid, id, received: payload });
});