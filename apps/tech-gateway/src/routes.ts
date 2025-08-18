cat > apps/tech-gateway/src/routes.ts <<'TS'
import { Router } from "express";
import { z } from "zod";

export const appRouter = Router();

// POST /v1/msg  -> accept a message from a tech client
appRouter.post("/msg", (req, res) => {
  const schema = z.object({
    phone: z.string().min(1),
    body: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: parsed.error.flatten() });
  }
  // TODO: enqueue to Omneuro / log to DB
  res.json({ ok: true });
});

// GET /v1/stream -> SSE stream to tech client
appRouter.get("/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  // minimal heartbeat
  res.write(`data: ${JSON.stringify({ items: [{ body: "connected", dir: "out" }] })}\n\n`);

  // keepalive ping
  const t = setInterval(() => res.write(`event: ping\ndata: {}\n\n`), 25000);
  req.on("close", () => clearInterval(t));
});

// POST /v1/reply -> accept bot/system replies
appRouter.post("/reply", (req, res) => {
  const schema = z.object({
    phone: z.string().min(1),
    body: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: parsed.error.flatten() });
  }
  // TODO: persist reply / fan-out to SSE listeners
  res.json({ ok: true });
});
TS