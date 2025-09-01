// apps/tech-gateway/src/server.ts

import cors from "cors";
import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

import techRouter from "./routes/tech.js";
import chatRouter from "./routes/chat.js";
import garageRouter from "./routes/garage.js"; // NEW
import { appRouter } from "./routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// ----------------------------------------------------
// Core app middleware (apply early)
// ----------------------------------------------------
app.use(express.json({ limit: "5mb" }));
app.use(cors());

// Request ID (propagate/correlate)
app.use((req, res, next) => {
  const hdr = req.headers["x-request-id"];
  const rid = (Array.isArray(hdr) ? hdr[0] : hdr) || randomUUID();
  (req as any).req_id = rid;
  res.setHeader("x-request-id", rid);
  next();
});

// ----------------------------------------------------
// Health + diagnostics (public)
// ----------------------------------------------------
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

// ----------------------------------------------------
// Public Client Garage API (no Basic auth)
//   - POST /api/garage/vehicles
//   - GET  /api/garage/vehicles?owner_email=...
// ----------------------------------------------------
app.use("/api/garage", garageRouter);

// ----------------------------------------------------
// Basic auth for the rest of /api/* (except the public ones above)
// ----------------------------------------------------
const BASIC_USER = process.env.BASIC_AUTH_USER || "";
const BASIC_PASS = process.env.BASIC_AUTH_PASS || "";
const authEnabled = Boolean(BASIC_USER && BASIC_PASS);

// Paths under /api/* that remain public even if auth is enabled.
// NOTE: Because we mounted /api/garage above (before auth), it is already public.
// We keep these here for explicit clarity & future additions.
const API_PUBLIC_PATHS = new Set<string>([
  "/health",
  "/tech/health",
]);

function requireBasicAuthForApi(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  if (!authEnabled) return next();

  // When mounted at /api, req.path is the part AFTER "/api"
  if (API_PUBLIC_PATHS.has(req.path)) return next();

  const hdr = req.headers.authorization || "";
  if (!hdr.startsWith("Basic ")) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Restricted"');
    return res.status(401).send("Authentication required");
  }
  const b64 = hdr.slice("Basic ".length).trim();
  const [u, p] = Buffer.from(b64, "base64").toString().split(":", 2);
  if (u === BASIC_USER && p === BASIC_PASS) return next();

  res.setHeader("WWW-Authenticate", 'Basic realm="Restricted"');
  return res.status(401).send("Invalid credentials");
}

// Attach the Basic-auth gate for all remaining /api/* routes
app.use("/api", requireBasicAuthForApi);

// Auth-protected routers
app.use("/api", chatRouter);
app.use("/api/tech", techRouter);

// Legacy / misc app router (v1 namespace kept)
app.use("/v1", appRouter);

// ----------------------------------------------------
// Static site (tech portal UI served by this service)
// NOTE: Public homepage is served by nginx separately.
// ----------------------------------------------------
app.use("/", express.static(path.join(__dirname, "public")));
app.get("/", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

const port = Number(process.env.PORT || 8092);
app.listen(port, () => process.stdout.write(String(port)));