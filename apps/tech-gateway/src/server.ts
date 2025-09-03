// apps/tech-gateway/src/server.ts
import techRouter from "./routes/tech.js";
import garageRouter from "./routes/garage.js";
import chatRouter from "./routes/chat.js";
import authRouter, { requireAuth } from "./auth.js";

import cors from "cors";
import express from "express";
import cookieParser from "cookie-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { appRouter } from "./routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// -----------------------------
// Auth config (scoped to /api/*)
// -----------------------------
const BASIC_USER = process.env.BASIC_AUTH_USER || "";
const BASIC_PASS = process.env.BASIC_AUTH_PASS || "";
const authEnabled = Boolean(BASIC_USER && BASIC_PASS);

const API_PUBLIC_PATHS = new Set<string>([
  "/health",
  "/tech/health",
  "/garage/health",
  "/garage/vehicles", // public for client page
  "/garage/auth/request",
  "/garage/auth/verify",
]);

function requireBasicAuthForApi(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  if (!authEnabled) return next();
  if (API_PUBLIC_PATHS.has(req.path)) return next();

  const hdr = req.headers.authorization || "";
  if (!hdr.startsWith("Basic ")) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Restricted"');
    return res.status(401).send("Authentication required");
  }
  const [u, p] = Buffer.from(hdr.slice(6), "base64").toString().split(":", 2);
  if (u === BASIC_USER && p === BASIC_PASS) return next();

  res.setHeader("WWW-Authenticate", 'Basic realm="Restricted"');
  return res.status(401).send("Invalid credentials");
}

// -----------------------------
// Middlewares (order matters)
// -----------------------------
app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());
app.use(cors());

app.use((req, res, next) => {
  const hdr = req.headers["x-request-id"];
  const rid = (Array.isArray(hdr) ? hdr[0] : hdr) || randomUUID();
  (req as any).req_id = rid;
  res.setHeader("x-request-id", rid);
  next();
});

// -----------------------------
// Health + admin diag
// -----------------------------
app.get("/healthz", (_req, res) => res.json({ ok: true }));
app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.get("/api/tech/health", (_req, res) => res.json({ ok: true }));

app.get("/admin/diag", (req, res) => {
  const key = process.env.DIAG_KEY || "";
  if (key && req.query.key !== key) return res.status(403).json({ error: "forbidden" });
  const tryRead = (p: string, n = 200) => {
    try {
      const s = fs.readFileSync(p, "utf8");
      const lines = s.trim().split("\n");
      return lines.slice(-n);
    } catch {
      return null;
    }
  };
  res.json({
    ok: true,
    pid: process.pid,
    cwd: process.cwd(),
    publicIndexExists: fs.existsSync(path.join(__dirname, "public", "index.html")),
    pm2: {
      outTail: tryRead("/home/ubuntu/.pm2/logs/tech-gateway-out.log"),
      errTail: tryRead("/home/ubuntu/.pm2/logs/tech-gateway-error.log"),
    },
  });
});

// -----------------------------
// API routes (auth order matters)
// -----------------------------
app.use("/api", requireBasicAuthForApi);        // basic auth gate (skips public list)
app.use("/api/garage", authRouter);             // /auth/* endpoints live here too
app.use("/api", chatRouter);
app.use("/api/tech", techRouter);
app.use("/api/garage", garageRouter);           // vehicles, etc.
app.use("/v1", appRouter);

// static site (homepage + garage UI)
app.use("/", express.static(path.join(__dirname, "public")));
app.get("/", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

const port = Number(process.env.PORT || 8092);
app.listen(port, () => process.stdout.write(String(port)));