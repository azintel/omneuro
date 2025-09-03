// apps/tech-gateway/src/auth.ts
import express from "express";
import type { RequestHandler } from "express";
import crypto from "crypto";
import cookieParser from "cookie-parser";
import db from "./db.js";
export const COOKIE_NAME = "jj_sess";

const router = express.Router();

// make sure whoever mounts this also uses cookieParser
router.use(cookieParser());

type SessionRow = {
  id: string;
  user_id: string;
  email: string;
  name: string | null;
  phone: string | null;
};

// Require an authenticated session; attaches req.user
export const requireAuth: RequestHandler = (req, res, next) => {
  const cookies = (req as any).cookies as Record<string, string> | undefined;
  const sid = cookies?.[COOKIE_NAME];
  if (!sid) return res.status(401).json({ error: "unauthenticated" });

  const row = db
    .prepare(
      `
      SELECT s.id, s.user_id, u.email, u.name, u.phone
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = ?`
    )
    .get(sid) as SessionRow | undefined;

  if (!row) return res.status(401).json({ error: "unauthenticated" });

  // touch last_seen
  db.prepare(`UPDATE sessions SET last_seen = datetime('now') WHERE id = ?`).run(sid);

  (req as any).user = {
    id: row.user_id,
    email: row.email,
    name: row.name ?? "",
    phone: row.phone ?? "",
    session_id: row.id,
  };

  next();
};

// ---- Magic-link endpoints (same behavior as before) ----

// request a login link
router.post("/auth/request", (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
    return res.status(400).json({ error: "invalid email" });
  }

  db.prepare(`INSERT INTO users (email) VALUES (?) ON CONFLICT(email) DO NOTHING`).run(email);
  const user = db.prepare(`SELECT id FROM users WHERE email=?`).get(email) as { id: string };

  const token = crypto.randomBytes(16).toString("hex");
  const expires = new Date(Date.now() + 15 * 60_000).toISOString().replace("T", " ").split(".")[0];

  db.prepare(`INSERT INTO login_tokens (user_id, token, expires_at) VALUES (?,?,?)`).run(
    user.id,
    token,
    expires
  );

  const base = process.env.PUBLIC_TECH_BASE_URL || "https://tech.juicejunkiez.com";
  const magicLink = `${base}/api/garage/auth/verify?token=${token}`;
  console.log("[auth] magic link:", magicLink);

  return res.json({
    ok: true,
    message:
      process.env.NODE_ENV === "production"
        ? "If this email exists, a sign-in link has been sent."
        : `dev link: ${magicLink}`,
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