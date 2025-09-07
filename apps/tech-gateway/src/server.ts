// apps/tech-gateway/src/server.ts

import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

// Routers (ESM/NodeNext: keep .js so dist keeps working)
import techRouter from "./routes/tech.js";
import garageRouter from "./routes/garage.js";
import chatRouter from "./routes/chat.js";
import catalogRouter from "./routes/catalog.js";
import quotesRouter from "./routes/quotes.js";
import schedulerRouter from "./routes/scheduler.js";
import blogRouter from "./routes/blog.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Core middleware
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// ---------------------------------
// Auth config (scoped to /api/*)
// ---------------------------------
const BASIC_USER = process.env.BASIC_AUTH_USER || "";
const BASIC_PASS = process.env.BASIC_AUTH_PASS || "";
const authEnabled = Boolean(BASIC_USER && BASIC_PASS);

// Paths under /api/* that remain public (exact matches)
const API_PUBLIC_PATHS = new Set<string>([
  "/health",
  "/tech/health",
  "/garage/health",
  // garage – allow public add/list vehicles + quote actions shown in UI
  "/garage/vehicles",
  "/garage/quotes",
  "/garage/quotes/preview",
  "/garage/quotes/accept",
  // scheduler – allow public booking + health
  "/scheduler/health",
  "/scheduler/appointments",
  // blog health (metadata endpoints are session-protected)
  "/garage/blog/health",
]);

function requireBasicAuthForApi(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  if (!authEnabled) return next();
  if (API_PUBLIC_PATHS.has(req.path)) return next();

  const header = req.headers["authorization"] || "";
  if (!header.startsWith("Basic ")) {
    res.setHeader("WWW-Authenticate", 'Basic realm="tech-gateway"');
    return res.status(401).end("Unauthorized");
  }
  const creds = Buffer.from(header.slice(6), "base64").toString("utf8");
  const [u, p] = creds.split(":", 2);
  if (u === BASIC_USER && p === BASIC_PASS) return next();

  res.setHeader("WWW-Authenticate", 'Basic realm="tech-gateway"');
  return res.status(401).end("Unauthorized");
}

// ---------------------------------
// Health
// ---------------------------------
app.get("/healthz", (_req, res) => res.json({ ok: true })); // <- restored for redeploy probes
app.get("/api/health", (_req, res) => res.json({ ok: true })); // canonical API health

// ---------------------------------
// Simple request id for tracing
// ---------------------------------
app.use((req, res, next) => {
  const hdr = req.headers["x-request-id"];
  const rid = (Array.isArray(hdr) ? hdr[0] : hdr) || randomUUID();
  (req as any).req_id = rid;
  res.setHeader("x-request-id", rid);
  next();
});

// ---------------------------------
// Admin diag (optional)
// ---------------------------------
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

// ---------------------------------
// API Routes (order matters)
// ---------------------------------

// Gate: apply Basic auth to /api/* except public paths above
app.use("/api", (req, res, next) => {
  if (API_PUBLIC_PATHS.has(req.path)) return next();
  return requireBasicAuthForApi(req, res, next);
});

// PUBLIC endpoints mounted under exact paths:
app.use("/api/garage", garageRouter);          // vehicles, etc.
app.use("/api/garage/quotes", quotesRouter);   // quote preview/accept
app.use("/api/scheduler", schedulerRouter);    // booking + health

// Basic-protected
app.use("/api/chat", chatRouter);
app.use("/api/tech", techRouter);
app.use("/api/catalog", catalogRouter);

// ---------------------------------
// Static (public) assets
// ---------------------------------
app.get("/garage", (_req, res) => res.redirect(301, "/garage/"));
app.use("/garage", express.static(path.join(__dirname, "public", "garage")));
app.get("/garage/", (_req, res) => res.sendFile(path.join(__dirname, "public", "garage", "index.html")));

// Blog (static pages if any) – optional
app.use("/garage/blog", blogRouter);

// Root site (homepage + shared assets)
app.use("/", express.static(path.join(__dirname, "public")));
app.get("/", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

const port = Number(process.env.PORT || 8092);
app.listen(port, () => process.stdout.write(String(port)));