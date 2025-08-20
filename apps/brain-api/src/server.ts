import express from "express";
import { techRouter } from "./routes/tech.js";

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 8081;

app.use(express.json({ limit: "5mb" }));

app.get("/healthz", (_req, res) => {
  res.json({ ok: true, service: "brain-api" });
});

app.use("/v1", techRouter);

app.use((req, res) => {
  res.status(404).json({ ok: false, error: `Unknown route: ${req.method} ${req.path}` });
});

app.listen(port, () => {
  console.log(`brain-api listening on port ${port}`);
});