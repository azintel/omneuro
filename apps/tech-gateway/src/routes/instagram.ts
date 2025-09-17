// apps/tech-gateway/src/routes/instagram.ts
import express from "express";
import type { Request, Response } from "express";

/**
 * Minimal Instagram feed proxy.
 * - Reads INSTAGRAM_ACCESS_TOKEN from env (injected by redeploy via SSM).
 * - Returns the most recent media (images/reels) with a small payload for the homepage strip.
 * - If no token is present, returns { ok:true, items: [] } so the UI hides the section.
 *
 * NOTE: Use a long-lived token for reliability.
 * Docs: https://developers.facebook.com/docs/instagram-basic-display-api/reference/user/media
 */
const INSTAGRAM_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN || "";

const router = express.Router();

type IgItem = {
  id: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM" | string;
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  caption?: string;
  timestamp?: string;
};

router.get("/feed", async (req: Request, res: Response) => {
  try {
    if (!INSTAGRAM_ACCESS_TOKEN) {
      return res.json({ ok: true, items: [] });
    }

    const limit = Math.min(20, Math.max(1, Number(req.query.limit || 8)));
    const fields = [
      "id",
      "caption",
      "media_type",
      "media_url",
      "thumbnail_url",
      "permalink",
      "timestamp",
    ].join(",");

    const url =
      `https://graph.instagram.com/me/media?fields=${encodeURIComponent(fields)}` +
      `&access_token=${encodeURIComponent(INSTAGRAM_ACCESS_TOKEN)}&limit=${limit}`;

    const resp = await fetch(url, { method: "GET" });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return res.status(502).json({ ok: false, error: "instagram_bad_gateway", detail: text.slice(0, 500) });
    }
    const json = (await resp.json()) as { data?: IgItem[] };

    const items = (json?.data || []).map((m) => {
      // prefer media_url; fall back to thumbnail_url (for VIDEO)
      const image = m.media_url || m.thumbnail_url || "";
      return {
        id: m.id,
        image,
        permalink: m.permalink,
        caption: m.caption || "",
        timestamp: m.timestamp || "",
        type: m.media_type || "",
      };
    }).filter(x => x.image && x.permalink);

    res.json({ ok: true, items });
  } catch (err: any) {
    console.error("[instagram/feed] error:", err?.message || err);
    res.status(500).json({ ok: false, error: "instagram_error" });
  }
});

export default router;