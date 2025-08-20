import { Router, type Request, type Response } from "express";

export const techRouter = Router();

techRouter.post("/repairbot/message", async (req: Request, res: Response) => {
  // TODO: call RepairBot when ready; for now echo payload for MVP
  res.json({ ok: true, echo: req.body ?? {} });
});

techRouter.patch("/jobs/:id/status", async (req: Request, res: Response) => {
  const id = req.params.id;
  res.json({ ok: true, id, status: req.body ?? {} });
});