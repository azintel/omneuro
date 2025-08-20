import { customAlphabet } from "nanoid";
import { Request, Response, NextFunction } from "express";

const nano = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 12);

export function reqId() {
  return function (req: Request, res: Response, next: NextFunction) {
    const incoming = (req.headers["x-request-id"] || "").toString().trim();
    const id = incoming || "rg_" + nano();
    (req as any).req_id = id;
    res.setHeader("x-request-id", id);
    next();
  };
}