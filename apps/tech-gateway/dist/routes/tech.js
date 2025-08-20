import { Router } from "express";
const router = Router();
// health
router.get("/health", (_req, res) => res.json({ ok: true }));
// chat -> forward to brain-api/repairbot
router.post("/message", async (req, res) => {
    try {
        const brainUrl = process.env.BRAIN_API_URL || "http://localhost:8081";
        const r = await global.fetch(brainUrl + "/v1/repairbot/message", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(req.body || {})
        });
        const data = await r.json().catch(() => ({}));
        res.status(r.status).json(data);
    }
    catch (e) {
        res.status(502).json({ ok: false, error: "repairbot_forward_failed", detail: String(e?.message || e) });
    }
});
// job status update -> forward to brain-api
router.patch("/jobs/:id/status", async (req, res) => {
    try {
        const brainUrl = process.env.BRAIN_API_URL || "http://localhost:8081";
        const r = await global.fetch(`${brainUrl}/v1/jobs/${encodeURIComponent(req.params.id)}/status`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(req.body || {})
        });
        const data = await r.json().catch(() => ({}));
        res.status(r.status).json(data);
    }
    catch (e) {
        res.status(502).json({ ok: false, error: "job_status_forward_failed", detail: String(e?.message || e) });
    }
});
export default router;
//# sourceMappingURL=tech.js.map