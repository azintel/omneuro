// apps/tech-gateway/src/routes/quotes.ts
//
// Client-facing quote endpoints mounted at /api/garage/quotes
// - POST /preview : returns a priced preview (does not persist)
// - POST /accept  : persists a quote (simple log for now; extend later)

import { Router, type Request, type Response } from "express";
import { nid } from "../lib/db.js";

type LineKind = "service" | "part" | "fee";

type QuoteLine = {
  kind: LineKind;
  key: string;           // e.g., "brake_job_front"
  description: string;   // human readable
  qty: number;           // units/hours/etc
  unit_price: number;    // in dollars for now
};

type QuotePreviewRequest = {
  owner_email: string;
  vehicle_id?: number;
  lines: Array<{
    kind: string;        // we’ll normalize/validate into LineKind
    key: string;
    description: string;
    qty: number;
    unit_price: number;
  }>;
};

type QuotePreview = {
  quote_id: string;
  subtotal: number;
  tax: number;
  total: number;
  lines: Array<QuoteLine & { line_total: number }>;
};

const TAX_RATE = Number(process.env.TAX_RATE || 0);

function toKind(x: string): LineKind | null {
  const v = String(x || "").toLowerCase();
  if (v === "service" || v === "part" || v === "fee") return v;
  return null;
}

function compute(lines: QuoteLine[]): QuotePreview {
  const enriched = lines.map(l => ({ ...l, line_total: +(l.qty * l.unit_price).toFixed(2) }));
  const subtotal = +enriched.reduce((s, l) => s + l.line_total, 0).toFixed(2);
  const tax = +((subtotal * TAX_RATE) || 0).toFixed(2);
  const total = +(subtotal + tax).toFixed(2);
  return {
    quote_id: nid(),
    subtotal,
    tax,
    total,
    lines: enriched,
  };
}

const router = Router();

/** Quick health for this slice (optional but handy) */
router.get("/health", (_req: Request, res: Response) => res.json({ ok: true, service: "quotes" }));

/** POST /preview -> compute totals, no persistence */
router.post("/preview", (req: Request, res: Response) => {
  const body = req.body as QuotePreviewRequest;

  if (!body?.owner_email || !Array.isArray(body?.lines)) {
    return res.status(400).json({ error: "owner_email and lines[] required" });
  }

  const lines: QuoteLine[] = [];
  for (const raw of body.lines) {
    const kind = toKind(raw.kind);
    if (!kind) return res.status(400).json({ error: `invalid line.kind: ${raw.kind}` });

    const qty = Number(raw.qty);
    const unit_price = Number(raw.unit_price);
    if (!Number.isFinite(qty) || !Number.isFinite(unit_price)) {
      return res.status(400).json({ error: "qty and unit_price must be numbers" });
    }

    lines.push({
      kind,
      key: String(raw.key || "").trim(),
      description: String(raw.description || "").trim(),
      qty,
      unit_price,
    });
  }

  const preview = compute(lines);
  res.json({ ok: true, quote: preview });
});

/** POST /accept -> placeholder persist hook (extend later) */
router.post("/accept", (req: Request, res: Response) => {
  // In Phase 3 we’ll: write to DB (quotes, quote_lines),
  // optionally invoice via Stripe, and notify via SMS/Email.
  const { quote } = req.body || {};
  if (!quote?.quote_id) return res.status(400).json({ error: "quote.quote_id required" });

  console.log("[quotes] accept", { quote_id: quote.quote_id, email: quote?.owner_email });
  res.json({ ok: true, quote_id: quote.quote_id });
});

export default router;