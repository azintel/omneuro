import techRouter from "./routes/tech.js";
import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { appRouter } from "./routes.js";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "5mb" }));
app.use("/api/tech", techRouter);
app.use(cors());

app.use(express.json());
app.get("/healthz", (_req, res) => res.json({ ok: true }));
app.get("/admin/diag", (req, res) => {
  const key = process.env.DIAG_KEY || "";
  if (key && req.query.key !== key) {
    return res.status(403).json({ error: "forbidden" });
  }
  const tryRead = (p: string, n = 200) => {
    try {
      const s = fs.readFileSync(p, "utf8");
      const lines = s.trim().split("\n");
      return lines.slice(-n);
    } catch {
      return null;
    }
  };
  const outTail = tryRead("/home/ubuntu/.pm2/logs/tech-gateway-out.log");
  const errTail = tryRead("/home/ubuntu/.pm2/logs/tech-gateway-error.log");
  res.json({
    ok: true,
    pid: process.pid,
    cwd: process.cwd(),
    publicIndexExists: fs.existsSync(path.join(__dirname, "public", "index.html")),
    pm2: {
      outTail,
      errTail,
    },
  });
});
app.use("/v1", appRouter);
app.use("/", express.static(path.join(__dirname, "public")));
app.get("/", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

const port = Number(process.env.PORT || 8092);
app.listen(port, () => process.stdout.write(String(port)));