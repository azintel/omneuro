// src/mw/reqId.ts
import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";

export function reqId(req: Request, res: Response, next: NextFunction) {
  const id =
    (req.headers["x-request-id"] as string | undefined) ||
    randomUUID();

  // propagate to downstream and expose to client
  req.headers["x-request-id"] = id;
  res.setHeader("x-request-id", id);

  // convenience for handlers
  (req as any).reqId = id;
  next();
}

export default reqId;