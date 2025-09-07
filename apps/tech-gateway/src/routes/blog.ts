// apps/tech-gateway/src/routes/blog.ts
import { Router, type Request, type Response } from "express";
import cookieParser from "cookie-parser";
import { requireAuth } from "../auth.js";
import {
  createDraft,
  listDrafts,
  listPublished,
  getBySlug,
  publishByIdOrSlug
} from "../lib/blog.js";

const router = Router();
router.use(cookieParser());
router.use(requireAuth);

router.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, service: "blog" });
});

function toStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v.map(x => String(x)).filter(Boolean);
}

router.post("/drafts", (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const { title, html } = body;
    const keywords = toStringArray(body.keywords);
    const links = toStringArray(body.links);
    const user = (req as any).user || {};

    // Build payload and OMIT author_email when not present (exactOptionalPropertyTypes-safe)
    const payload: {
      title: string;
      html: string;
      keywords?: string[];
      links?: string[];
      author_email?: string;
    } = {
      title: String(title || ""),
      html: String(html || ""),
      ...(keywords ? { keywords } : {}),
      ...(links ? { links } : {})
    };
    if (user?.email) payload.author_email = String(user.email);

    const row = createDraft(payload);
    res.json({ ok: true, post: row });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e?.message || "bad_request" });
  }
});

router.get("/drafts", (_req, res) => res.json({ ok: true, items: listDrafts() }));
router.get("/posts", (_req, res) => res.json({ ok: true, items: listPublished() }));

router.get("/posts/:slug", (req, res) => {
  const p = getBySlug(String(req.params.slug));
  if (!p) return res.status(404).json({ ok: false, error: "not_found" });
  res.json({ ok: true, post: p });
});

router.post("/publish", async (req: Request, res: Response) => {
  try {
    const { id, slug } = req.body || {};
    if (!id && !slug) return res.status(400).json({ ok: false, error: "id_or_slug_required" });
    const updated = await publishByIdOrSlug({ id, slug });
    res.json({ ok: true, post: updated });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e?.message || "publish_failed" });
  }
});

export default router;