import { Router } from "express";

export const techRouter = Router();

techRouter.post("/repairbot/message", async (req, res) => {
  const payload = req.body ?? {};
  // TODO: call internal repairbot handler; for now echo
  res.json({ ok: true, echo: payload });
});

techRouter.patch("/jobs/:id/status", async (req, res) => {
  const id = req.params.id;
  const payload = req.body ?? {};
  // TODO: persist status; for now echo
  res.json({ ok: true, id, status: payload });
});