// ////apps/tech-gateway/src/routes/store.ts
import express from "express";
import type { Request, Response } from "express";
import db from "../db.js";

// Stripe env
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_SUCCESS_URL =
  process.env.STORE_SUCCESS_URL || "https://juicejunkiez.com/store/?status=success";
const STRIPE_CANCEL_URL =
  process.env.STORE_CANCEL_URL || "https://juicejunkiez.com/store/?status=cancel";

// Lazy Stripe import so build doesn’t choke if key is missing
let stripe: any = null;
async function getStripe() {
  if (!stripe && STRIPE_SECRET_KEY) {
    const Stripe = (await import("stripe")).default;
    stripe = new Stripe(STRIPE_SECRET_KEY);
  }
  return stripe;
}

const router = express.Router();

// ---------- DB bootstrap ----------
db.exec(`
CREATE TABLE IF NOT EXISTS store_products (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL,
  price_cents   INTEGER NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'usd',
  image         TEXT NOT NULL,
  price_id      TEXT,            -- Stripe Price ID
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_store_products_active ON store_products(active);
`);

// Seed once if empty (migrates from old in-file examples)
(function seedIfEmpty() {
  const row = db.prepare(`SELECT COUNT(*) AS n FROM store_products`).get() as any;
  if (row?.n > 0) return;
  const seed = [
    {
      id: "jj-3dp-mount-small", name: "3D Printed Scooter Phone Mount (Small)",
      description: "Durable PETG phone mount sized for smaller handlebars.",
      price_cents: 1999, currency: "usd",
      image: "/store/images/phone-mount-small.jpg",
      price_id: "price_XXX_REPLACE_ME_SMALL", active: 1,
    },
    {
      id: "jj-3dp-mount-large", name: "3D Printed Scooter Phone Mount (Large)",
      description: "PETG mount for thicker bars. Includes rubber shim.",
      price_cents: 2299, currency: "usd",
      image: "/store/images/phone-mount-large.jpg",
      price_id: "price_XXX_REPLACE_ME_LARGE", active: 1,
    },
    {
      id: "jj-3dp-battery-bracket", name: "E-Bike Battery Bracket",
      description: "Custom bracket for common down-tube battery packs.",
      price_cents: 3499, currency: "usd",
      image: "/store/images/battery-bracket.jpg",
      price_id: "price_XXX_REPLACE_ME_BRACKET", active: 1,
    },
  ];
  const ins = db.prepare(`
    INSERT INTO store_products (id, name, description, price_cents, currency, image, price_id, active)
    VALUES (?,?,?,?,?,?,?,?)
  `);
  const tx = db.transaction((items: any[]) => {
    for (const p of items) ins.run(p.id, p.name, p.description, p.price_cents, p.currency, p.image, p.price_id, p.active);
  });
  tx(seed);
})();

// Helpers
function pubProduct(p: any) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    price: p.price_cents,
    currency: p.currency,
    image: p.image,
  };
}

// ---------- Health ----------
router.get("/health", async (_req: Request, res: Response) => {
  const s = !!STRIPE_SECRET_KEY;
  // basic DB read
  let dbOk = true;
  try { db.prepare(`SELECT 1 FROM store_products LIMIT 1`).get(); } catch { dbOk = false; }
  res.json({ ok: true, stripeConfigured: s, db: dbOk });
});

// ---------- Public: products ----------
router.get("/products", (_req: Request, res: Response) => {
  const rows = db.prepare(`SELECT * FROM store_products WHERE active=1 ORDER BY created_at DESC`).all() as any[];
  res.json({ ok: true, products: rows.map(pubProduct) });
});

// ---------- Public: checkout ----------
router.post("/checkout", express.json(), async (req: Request, res: Response) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) return res.status(400).json({ ok: false, error: "empty_cart" });

    const client = await getStripe();
    if (!client) return res.status(500).json({ ok: false, error: "stripe_not_configured" });

    const line_items: Array<{ price: string; quantity: number }> = [];
    for (const it of items) {
      const id = String(it?.id || "");
      const qty = Math.max(1, Number(it?.quantity || 0));
      const p = db.prepare(`SELECT price_id FROM store_products WHERE id=? AND active=1`).get(id) as any;
      if (!p?.price_id) return res.status(400).json({ ok: false, error: `invalid_item:${id}` });
      line_items.push({ price: p.price_id, quantity: qty });
    }

    const session = await client.checkout.sessions.create({
      mode: "payment",
      success_url: STRIPE_SUCCESS_URL,
      cancel_url: STRIPE_CANCEL_URL,
      line_items,
      billing_address_collection: "auto",
      shipping_address_collection: { allowed_countries: ["US", "CA"] },
      allow_promotion_codes: true,
    });

    res.status(200).json({ ok: true, sessionId: session.id, url: session.url });
  } catch (err: any) {
    console.error("[store/checkout] error:", err?.message || err);
    res.status(500).json({ ok: false, error: "checkout_failed" });
  }
});

// ---------- Admin: list (full), upsert, delete ----------
// NOTE: These endpoints are under /api/store/* and are therefore behind Basic Auth.

router.get("/admin/products", (_req: Request, res: Response) => {
  const rows = db.prepare(`SELECT * FROM store_products ORDER BY created_at DESC`).all() as any[];
  res.json({ ok: true, products: rows });
});

router.post("/admin/products", express.json(), (req: Request, res: Response) => {
  const b = req.body || {};
  const id = String(b.id || "").trim();
  const name = String(b.name || "").trim();
  const description = String(b.description || "").trim();
  const price_cents = Number(b.price_cents || b.price || 0) | 0;
  const currency = (String(b.currency || "usd").trim() || "usd").toLowerCase();
  const image = String(b.image || "").trim();
  const price_id = String(b.price_id || "").trim();
  const active = b.active === 0 || b.active === false ? 0 : 1;

  if (!id || !name || !description || !price_cents || !image) {
    return res.status(400).json({ ok: false, error: "missing_fields" });
  }

  const exists = db.prepare(`SELECT 1 FROM store_products WHERE id=?`).get(id);
  if (exists) {
    db.prepare(`
      UPDATE store_products
      SET name=?, description=?, price_cents=?, currency=?, image=?, price_id=?, active=?, updated_at=datetime('now')
      WHERE id=?
    `).run(name, description, price_cents, currency, image, price_id || null, active, id);
  } else {
    db.prepare(`
      INSERT INTO store_products (id, name, description, price_cents, currency, image, price_id, active)
      VALUES (?,?,?,?,?,?,?,?)
    `).run(id, name, description, price_cents, currency, image, price_id || null, active);
  }

  const row = db.prepare(`SELECT * FROM store_products WHERE id=?`).get(id);
  res.json({ ok: true, product: row });
});

router.delete("/admin/products/:id", (req: Request, res: Response) => {
  const id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ ok: false, error: "missing_id" });
  db.prepare(`DELETE FROM store_products WHERE id=?`).run(id);
  res.json({ ok: true, id });
});

export default router;