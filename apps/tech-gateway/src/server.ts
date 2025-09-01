// apps/tech-gateway/src/server.ts
import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

import techRouter from "./routes/tech.js";
import chatRouter from "./routes/chat.js";
import garageRouter from "./routes/garage.js";
import { appRouter } from "./routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// 1) Body parser + CORS (ensure preflights pass)
app.use(express.json({ limit: "5mb" }));
app.use(cors());

// 2) Req ID injection
app.use((req, res, next) => {
  const hdr = (req.headers["x-request-id"] as string) || "";
  const rid = hdr || randomUUID();
  (req as any).req_id = rid;
  res.setHeader("x-request-id", rid);
  next();
});

// 3) Health endpoints (public)
app.get("/healthz", (_req, res) => res.json({ ok: true }));
app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.get("/api/tech/health", (_req, res) => res.json({ ok: true }));

app.get("/admin/diag", (req, res) => {
  const key = process.env.DIAG_KEY || "";
  if (key && req.query.key !== key) return res.status(403).json({ error: "forbidden" });
  const tryRead = (p: string, n = 200) => {
    try { return fs.readFileSync(p, "utf8").trim().split("\n").slice(-n); }
    catch { return null; }
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

// 4) Client Garage API (public)
app.use("/api/garage", garageRouter);

// 5) Basic Auth guard
const BASIC_USER = process.env.BASIC_AUTH_USER || "";
const BASIC_PASS = process.env.BASIC_AUTH_PASS || "";
const authEnabled = Boolean(BASIC_USER && BASIC_PASS);

const API_PUBLIC_PATHS = new Set([
  "/health",
  "/tech/health",
  "/garage/vehicles",
]);

function requireBasicAuthForApi(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!authEnabled) return next();
  if (req.method === "OPTIONS") return next();
  if (API_PUBLIC_PATHS.has(req.path)) return next();

  const hdr = req.headers.authorization || "";
  if (!hdr.startsWith("Basic ")) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Restricted"');
    return res.status(401).send("Authentication required");
  }

  const [u, p] = Buffer.from(hdr.split(" ")[1], "base64").toString().split(":", 2);
  if (u === BASIC_USER && p === BASIC_PASS) return next();

  res.setHeader("WWW-Authenticate", 'Basic realm="Restricted"');
  return res.status(401).send("Invalid credentials");
}

app.use("/api", requireBasicAuthForApi);

// 6) Auth-protected routers
app.use("/api", chatRouter);
app.use("/api/tech", techRouter);
app.use("/v1", appRouter);

// 7) Static assets
app.use("/", express.static(path.join(__dirname, "public")));
app.get("/", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

const port = Number(process.env.PORT || 8092);
app.listen(port, () => process.stdout.write(String(port)));