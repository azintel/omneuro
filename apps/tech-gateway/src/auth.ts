// apps/tech-gateway/src/auth.ts
import type { Request, Response, NextFunction, RequestHandler } from "express";
import { Router } from "express";
import crypto from "crypto";
import cookieParser from "cookie-parser";
import db from "./db.js";

/**
 * We keep auth types local (no global augmentation) to avoid ripple errors.
 */
export type AuthedUser = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  session_id: string;
};
export type ReqWithAuth = Request & {
  cookies?: Record<string, string>;
  user?: AuthedUser;
};

export const COOKIE_NAME = "jj_sess";
export const router = Router();

// allow attaching cookie parser just for this router if needed externally
router.use(cookieParser());

// ---------- helpers ----------
function nowPlusMinutes(m: number) {
  return new Date(Date.now() + m * 60_000).toISOString().replace("T", " ").split(".")[0];
}
function randId(n = 32) {
  return crypto.randomBytes(n).toString("hex");
}

// ---------- middleware ----------
export const requireAuth: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const sid = (req as ReqWithAuth).cookies?.[COOKIE_NAME];
  if (!sid) return res.status(401).json({ error: "unauthenticated" });

  const row = db
    .prepare(
      `
      SELECT s.id AS sid, s.user_id, u.email, u.name, u.phone
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = ?
    `
    )
    .get(sid) as
    | { sid: string; user_id: string; email: string; name: string | null; phone: string | null }
    | undefined;

  if (!row) return res.status(401).json({ error: "unauthenticated" });

  // touch last_seen
  db.prepare(`UPDATE sessions SET last_seen = datetime('now') WHERE id = ?`).run(sid);

  (req as ReqWithAuth).user = {
    id: row.user_id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    session_id: row.sid,
  };
  next();
};

// ---------- magic-link endpoints ----------
router.post("/auth/request", (req: Request, res: Response) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) return res.status(400).json({ error: "invalid email" });

  db.prepare(`INSERT INTO users (email) VALUES (?) ON CONFLICT(email) DO NOTHING`).run(email);
  const user = db.prepare(`SELECT id FROM users WHERE email=?`).get(email) as { id: string };
  const token = randId(16);
  const expires = nowPlusMinutes(15);
  db.prepare(`INSERT INTO login_tokens (user_id, token, expires_at) VALUES (?,?,?)`).run(user.id, token, expires);

  const base = process.env.PUBLIC_TECH_BASE_URL || "https://tech.juicejunkiez.com";
  const magicLink = `${base}/api/garage/auth/verify?token=${token}`;

  // In production you'd email this. For now we return it for dev UX.
  return res.json({
    ok: true,
    message: "If this email exists, a sign-in link has been sent.",
    dev_link: process.env.NODE_ENV !== "production" ? magicLink : undefined,
  });
});

router.get("/auth/verify", (req: Request, res: Response) => {
  const token = String(req.query.token || "");
  if (!token) return res.status(400).send("Missing token");

  const row = db
    .prepare(
      `SELECT lt.user_id, u.email FROM login_tokens lt
       JOIN users u ON u.id = lt.user_id
       WHERE lt.token = ? AND lt.expires_at >= datetime('now')`
    )
    .get(token) as { user_id: string; email: string } | undefined;

  if (!row) return res.status(400).send("Invalid or expired token");

  const sid = randId(24);
  db.prepare(`INSERT INTO sessions (id, user_id, created_at, last_seen) VALUES (?,?,datetime('now'),datetime('now'))`)
    .run(sid, row.user_id);
  db.prepare(`DELETE FROM login_tokens WHERE token = ?`).run(token);

  res.cookie(COOKIE_NAME, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });

  // go to the client page
  const redirectTo = "/garage/";
  res.redirect(302, redirectTo);
});

router.post("/auth/logout", (req: Request, res: Response) => {
  const sid = (req as ReqWithAuth).cookies?.[COOKIE_NAME];
  if (sid) {
    db.prepare(`DELETE FROM sessions WHERE id = ?`).run(sid);
    res.clearCookie(COOKIE_NAME, { path: "/" });
  }
  res.json({ ok: true });
});

export default router;