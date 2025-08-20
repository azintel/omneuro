import { Router } from "express";

const router = Router();
const brainBase = process.env.BRAIN_API_URL || "http://localhost:8081";

router.get("/health", (_req, res) => res.json({ ok: true }));

router.post("/message", async (req, res) => {
  try {
    const rid = (req as any).req_id || (req.headers["x-request-id"] as string) || "";
    const r = await fetch(`${brainBase}/v1/repairbot/message`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(rid ? { "x-request-id": rid } : {}),
      },
      body: JSON.stringify(req.body || {}),
    });
    const bodyText = await r.text();
    try {
      res.status(r.status).json(JSON.parse(bodyText));
    } catch {
      res.status(r.status).send(bodyText);
    }
  } catch (e: any) {
    res.status(502).json({ ok: false, error: "repairbot_forward_failed", detail: String(e?.message || e) });
  }
});

router.patch("/jobs/:id/status", async (req, res) => {
  try {
    const rid = (req as any).req_id || (req.headers["x-request-id"] as string) || "";
    const r = await fetch(`${brainBase}/v1/jobs/${encodeURIComponent(req.params.id)}/status`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        ...(rid ? { "x-request-id": rid } : {}),
      },
      body: JSON.stringify(req.body || {}),
    });
    const bodyText = await r.text();
    try {
      res.status(r.status).json(JSON.parse(bodyText));
    } catch {
      res.status(r.status).send(bodyText);
    }
  } catch (e: any) {
    res.status(502).json({ ok: false, error: "job_status_forward_failed", detail: String(e?.message || e) });
  }
});

export default router;