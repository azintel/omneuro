// apps/brain-api/src/server.ts
import express from "express";
import { techRouter } from "./routes/tech.js";  // ← .js extension is REQUIRED

const app = express();
const port = process.env.PORT || 8081;

app.use(express.json({ limit: "5mb" }));

// mount our tech API
app.use("/v1", techRouter);

// simple health endpoint
app.get("/healthz", (_req, res) => {
  res.send("brain-api OK");
});

app.listen(port, () => {
  console.log(`brain-api listening on port ${port}`);
});