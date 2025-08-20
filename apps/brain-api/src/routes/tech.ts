import { Router, type Request, type Response } from "express";

export const techRouter = Router();

techRouter.post("/repairbot/message", (req: Request, res: Response) => {
  const rid = (req.header("x-request-id") ?? "").toString();
  const payload = req.body ?? {};
  res.json({ ok: true, route: "repairbot_message", rid, received: payload });
});

techRouter.patch("/jobs/:id/status", (req: Request, res: Response) => {
  const rid = (req.header("x-request-id") ?? "").toString();
  const id = req.params.id;
  const payload = req.body ?? {};
  res.json({ ok: true, route: "job_status", rid, id, received: payload });
});