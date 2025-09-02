// apps/tech-gateway/src/server.ts

import techRouter from "./routes/tech.js";
import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { appRouter } from "./routes.js";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import chatRouter from "./routes/chat.js";
import garageRouter from "./routes/garage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// -----------------------------
// Auth config (scoped to /api/*)
// -----------------------------
const BASIC_USER = process.env.BASIC_AUTH_USER || "";
const BASIC_PASS = process.env.BASIC_AUTH_PASS || "";
const authEnabled = Boolean(BASIC_USER && BASIC_PASS);

// Paths under /api/* that should remain public (health checks, etc.)
const API_PUBLIC_PATHS = new Set<string>([
  "/health",
  "/tech/health",
  "/garage/health",
]);

function requireBasicAuthForApi(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!authEnabled) return next();
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

// -----------------------------
// Routers
// -----------------------------
app.use("/api", requireBasicAuthForApi);

// chat first
app.use("/api", chatRouter);

// body + cors
app.use(express.json({ limit: "5mb" }));
app.use(cors());

// req_id middleware
app.use((req, res, next) => {
  const hdr = req.headers["x-request-id"];
  const rid = (Array.isArray(hdr) ? hdr[0] : hdr) || randomUUID();
  (req as any).req_id = rid;
  res.setHeader("x-request-id", rid);
  next();
});

// health
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

// app routers
app.use("/api/tech", techRouter);
app.use("/api/garage", garageRouter);
app.use("/v1", appRouter);

// static (public homepage + assets)
app.use("/", express.static(path.join(__dirname, "public")));
app.get("/", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

const port = Number(process.env.PORT || 8092);
app.listen(port, () => process.stdout.write(String(port)));