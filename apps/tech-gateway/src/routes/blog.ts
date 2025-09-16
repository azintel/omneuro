// apps/tech-gateway/src/routes/blog.ts
// Admin blog API: mutations rely on server-level Basic Auth (see server.ts).
// Public reads remain open so the website/UI can fetch posts.

import { Router, type Request, type Response } from "express";
import {
  createDraft,
  listDrafts,
  listPublished,
  getBySlug,
  publishByIdOrSlug
} from "../lib/blog.js";

const router = Router();

router.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, service: "blog" });
});

// -------- Reads (public) --------
router.get("/posts", (_req, res) => {
  const items = listPublished();
  res.json({ ok: true, items });
});

router.get("/posts/:slug", (req, res) => {
  const p = getBySlug(String(req.params.slug || ""));
  if (!p) return res.status(404).json({ ok: false, error: "not_found" });
  res.json({ ok: true, post: p });
});

// -------- Helpers --------
function toStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v.map(x => String(x)).filter(Boolean);
}

// -------- Mutations (admin; gated by Basic Auth at /api/*) --------
router.post("/drafts", (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const { title, html, slug } = body;
    const keywords = toStringArray(body.keywords);
    const links = toStringArray(body.links);

    const row = createDraft({
      title: String(title || ""),
      html: String(html || ""),
      // lib/blog.ts auto-slugs by title; passing a slug is optional
      ...(keywords ? { keywords } : {}),
      ...(links ? { links } : {})
    });

    // If caller supplied a slug in the JSON, they probably want that exact slug;
    // your lib doesn’t accept slug override, so we just return the created row.
    res.json({ ok: true, post: row });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e?.message || "bad_request" });
  }
});

router.post("/publish", async (req: Request, res: Response) => {
  try {
    const { id, slug } = req.body || {};
    if (!id && !slug) {
      return res.status(400).json({ ok: false, error: "id_or_slug_required" });
    }
    const updated = await publishByIdOrSlug({ id, slug });
    res.json({ ok: true, post: updated });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e?.message || "publish_failed" });
  }
});

export default router;