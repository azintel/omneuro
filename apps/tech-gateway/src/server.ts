// apps/tech-gateway/src/server.ts

import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

// Routers (ESM/NodeNext: use .js in source imports so dist keeps working)
import techRouter from "./routes/tech.js";
import garageRouter from "./routes/garage.js";
import chatRouter from "./routes/chat.js";
import catalogRouter from "./routes/catalog.js";
import quotesRouter from "./routes/quotes.js";
import schedulerRouter from "./routes/scheduler.js";
import blogRouter from "./routes/blog.js"; // ⬅ NEW

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Core middleware
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// -----------------------------
// Auth config (scoped to /api/*)
// -----------------------------
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

  // Basic auth check
  const header = req.headers["authorization"] || "";
  if (!header.startsWith("Basic ")) {
    res.setHeader("WWW-Authenticate", "Basic realm=\"tech-gateway\"");
    return res.status(401).end("Unauthorized");
  }
  const creds = Buffer.from(header.slice(6), "base64").toString("utf8");
  const [u, p] = creds.split(":", 2);
  if (u === BASIC_USER && p === BASIC_PASS) return next();

  res.setHeader("WWW-Authenticate", "Basic realm=\"tech-gateway\"");
  return res.status(401).end("Unauthorized");
}

// -----------------------------
// Canonical health
// -----------------------------
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// -----------------------------
// API Routes (order matters)
// -----------------------------

// First gate: apply Basic auth to /api/* except public paths above
app.use("/api", (req, res, next) => {
  if (API_PUBLIC_PATHS.has(req.path)) return next();
  return requireBasicAuthForApi(req, res, next);
});

// PUBLIC (no Basic) endpoints declared above must be mounted under the exact paths:
app.use("/api/garage", garageRouter);          // vehicles, etc.
app.use("/api/garage/quotes", quotesRouter);   // quote preview/accept
app.use("/api/scheduler", schedulerRouter);    // public appointment booking + health

// Chat + Tech + Catalog (Basic)
app.use("/api/chat", chatRouter);
app.use("/api/tech", techRouter);
app.use("/api/catalog", catalogRouter);

// Blog (mounted under /api/garage to use session cookie auth inside the subrouter)
app.use("/api/garage/blog", blogRouter);

// -----------------------------
// Static files
// -----------------------------
// Serve Tech Portal (garage)
app.use("/garage", express.static(path.join(__dirname, "public/garage")));
// Root static
app.use("/", express.static(path.join(__dirname, "public")));

// -----------------------------
// Start
// -----------------------------
const port = +(process.env.PORT || 8080);
app.listen(port, () => {
  console.log(`[tech-gateway] listening on :${port}`);
});