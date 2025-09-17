////apps/tech-gateway/src/server.ts
import techRouter from "./routes/tech.js";
import garageRouter from "./routes/garage.js";
import chatRouter from "./routes/chat.js";
import catalogRouter from "./routes/catalog.js";
import quotesRouter from "./routes/quotes.js";
import schedulerRouter from "./routes/scheduler.js";
import blogRouter from "./routes/blog.js";
import authRouter from "./auth.js";
import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// -----------------------------
// Auth config (scoped to /api/*)
// -----------------------------
const BASIC_USER = process.env.BASIC_AUTH_USER || "";
const BASIC_PASS = process.env.BASIC_AUTH_PASS || "";
const authEnabled = Boolean(BASIC_USER && BASIC_PASS);

// Public API endpoints that should bypass Basic Auth
const API_PUBLIC_PATHS = new Set<string>([
  "/health",
  "/tech/health",
  "/garage/health",
  "/scheduler/health",
  // public client magic-link endpoints
  "/garage/auth/request",
  "/garage/auth/verify",
  // allow the tech chat UI + POST to be reachable without nginx/basic auth
  "/chat",
]);

function requireBasicAuthForApi(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  if (!authEnabled) return next();
  // allow exact public paths (e.g., /api/chat, /api/health, etc.)
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
// Middlewares
// -----------------------------
app.use(express.json({ limit: "5mb" }));
app.use(cors());

// request id
app.use((req, res, next) => {
  const hdr = req.headers["x-request-id"];
  const rid = (Array.isArray(hdr) ? hdr[0] : hdr) || randomUUID();
  (req as any).req_id = rid;
  res.setHeader("x-request-id", rid);
  next();
});

// -----------------------------
// Health + diag
// -----------------------------
app.get("/healthz", (_req, res) => res.json({ ok: true }));
app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.get("/api/tech/health", (_req, res) => res.json({ ok: true }));

// -----------------------------
// Static site (homepage + any static assets under /public)
// -----------------------------
app.use("/", express.static(path.join(__dirname, "public"), { fallthrough: true }));

// -----------------------------
// API (Basic Auth protected except API_PUBLIC_PATHS)
// -----------------------------
app.use("/api", requireBasicAuthForApi);

// Mount garage auth (client magic-link)
app.use("/api/garage", authRouter);

// Mount app slices
app.use("/api/tech", techRouter);
app.use("/api/catalog", catalogRouter);
app.use("/api/garage", garageRouter);
app.use("/api/garage/quotes", quotesRouter);
app.use("/api/scheduler", schedulerRouter);
app.use("/api/blog", blogRouter);

// IMPORTANT: Mount chat router at /api so that its "/" handlers appear at /api/chat
app.use("/api", chatRouter);

// -----------------------------
// 404 for API
// -----------------------------
app.use("/api", (_req, res) => res.status(404).json({ ok: false, error: "not_found" }));

// -----------------------------
// Server
// -----------------------------
const PORT = Number(process.env.PORT || 8080);
app.listen(PORT, () => {
  console.log(`[tech-gateway] listening on :${PORT}`);
});