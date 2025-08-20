import express from "express";
import { techRouter } from "./routes/tech.js";

const app = express();
const port = Number(process.env.PORT || 8081);

app.use(express.json({ limit: "5mb" }));
app.get("/healthz", (_req, res) => res.json({ ok: true }));

// Mount at /v1 so the gateway’s forwards match
app.use("/v1", techRouter);

app.listen(port, () => {
  process.stdout.write(`brain-api:${port}`);
});