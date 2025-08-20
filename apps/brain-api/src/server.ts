import express from "express";
import { techRouter } from "./routes/tech.js";

const app = express();
const port = Number(process.env.PORT || 8081);

app.use(express.json({ limit: "5mb" }));

// health
app.get("/healthz", (_req, res) => res.json({ ok: true }));

// v1 routes
app.use("/v1", techRouter);

app.listen(port, () => {
  console.log(`brain-api listening on ${port}`);
});