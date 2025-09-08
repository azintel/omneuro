// apps/tech-gateway/src/auth.ts

import { Router } from "express";
import cookieParser from "cookie-parser";
import crypto from "node:crypto";
import { db } from "./db.js";
import { sendMagicLinkEmail } from "./lib/mailer.js";

const router = Router();
router.use(cookieParser());

const COOKIE_NAME = "jjz_garage_sid";

// Attach req.user from session (if any)
router.use((req, _res, next) => {
  try {
    const cookies = (req as any).cookies as Record<string, string> | undefined;
    const sid = cookies?.[COOKIE_NAME];
    if (sid) {
      const row = db
        .prepare(
          `
          SELECT u.email
          FROM sessions s
          JOIN users u ON u.id = s.user_id
          WHERE s.id = ?
        `
        )
        .get(sid) as { email: string } | undefined;
      if (row?.email) (req as any).user = { email: row.email };
    }
  } catch {}
  next();
});

// Exported middleware to require a signed-in user (used by blog/admin APIs)
export function requireAuth(req: any, res: any, next: any) {
  if (req?.user?.email) return next();
  res.status(401).json({ ok: false, error: "unauthorized" });
}

// ---- Magic-link endpoints ----

// request a login link
router.post("/auth/request", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
    return res.status(400).json({ error: "invalid email" });
  }

  // ensure user
  db.prepare(`INSERT INTO users (email) VALUES (?) ON CONFLICT(email) DO NOTHING`).run(email);
  const user = db.prepare(`SELECT id FROM users WHERE email=?`).get(email) as { id: string };

  // create token
  const token = crypto.randomBytes(16).toString("hex");
  const expires = new Date(Date.now() + 15 * 60_000).toISOString().replace("T", " ").split(".")[0];

  db.prepare(`INSERT INTO login_tokens (user_id, token, expires_at) VALUES (?,?,?)`).run(
    user.id,
    token,
    expires
  );

  const base = process.env.PUBLIC_TECH_BASE_URL || "https://tech.juicejunkiez.com";
  const magicLink = `${base}/api/garage/auth/verify?token=${token}`;

  try {
    await sendMagicLinkEmail(email, magicLink);
  } catch (e: any) {
    // Don't leak send errors to the client; log and still respond generic
    console.error("[auth] email send failed:", e?.message || e);
  }

  return res.json({
    ok: true,
    // always generic to avoid email enumeration
    message: "If this email exists, a sign-in link has been sent.",
  });
});

// verify a token and set session cookie
router.get("/auth/verify", (req, res) => {
  const token = String(req.query?.token || "");
  if (!token) return res.status(400).send("missing token");

  const row = db
    .prepare(
      `
      SELECT t.user_id
      FROM login_tokens t
      WHERE t.token = ? AND t.expires_at > datetime('now')`
    )
    .get(token) as { user_id: string } | undefined;

  if (!row) return res.status(400).send("invalid or expired token");

  // consume token
  db.prepare(`DELETE FROM login_tokens WHERE token=?`).run(token);

  const sid = crypto.randomBytes(16).toString("hex");
  db.prepare(`INSERT INTO sessions (id, user_id, created_at, last_seen) VALUES (?, ?, datetime('now'), datetime('now'))`)
    .run(sid, row.user_id);

  res.cookie(COOKIE_NAME, sid, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30d
  });

  // send them back to the garage
  res.redirect("/garage/");
});

// logout
router.post("/auth/logout", (req, res) => {
  const cookies = (req as any).cookies as Record<string, string> | undefined;
  const sid = cookies?.[COOKIE_NAME];
  if (sid) {
    db.prepare(`DELETE FROM sessions WHERE id = ?`).run(sid);
    res.clearCookie(COOKIE_NAME);
  }
  res.json({ ok: true });
});

export default router;