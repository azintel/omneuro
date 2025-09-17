// ////apps/tech-gateway/src/routes/store.ts
import express from "express";
import type { Request, Response } from "express";
import {
  storeAllProductsPublic,
  storeGetProduct,
  storeUpsertProduct,
  storeSetStripeIds,
  storeGetStripeIds,   // <- use this (replaces storeFindStripeIds)
  storeTouchSeenStripe,
  storeListCompat,
  storeAddCompat,
} from "../db.js";
import type { StoreProduct, StripeIds } from "../db.js";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_SUCCESS_URL =
  process.env.STORE_SUCCESS_URL || "https://juicejunkiez.com/store/success.html";
const STRIPE_CANCEL_URL =
  process.env.STORE_CANCEL_URL || "https://juicejunkiez.com/store/cancel.html";
const ADMIN_TOKEN = process.env.TECH_GATEWAY_ACCESS_TOKEN || "";

let stripe: any = null;
async function getStripe() {
  if (!STRIPE_SECRET_KEY) return null;
  if (!stripe) {
    const Stripe = (await import("stripe")).default;
    stripe = new Stripe(STRIPE_SECRET_KEY);
  }
  return stripe;
}

const router = express.Router();

// ---------- health ----------
router.get("/health", (_req, res) =>
  res.json({ ok: true, service: "store", stripe: STRIPE_SECRET_KEY ? "configured" : "missing_key" })
);

// ---------- public: list products ----------
router.get("/products", (_req: Request, res: Response) => {
  const items = storeAllProductsPublic();
  res.json({ ok: true, products: items });
});

// ---------- public: checkout ----------
router.post("/checkout", express.json(), async (req: Request, res: Response) => {
  try {
    const s = await getStripe();
    if (!s) return res.status(500).json({ ok: false, error: "stripe_not_configured" });

    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) return res.status(400).json({ ok: false, error: "empty_cart" });

    const line_items: Array<{ price: string; quantity: number }> = [];
    for (const it of items) {
      const pid = String(it?.id || "");
      const qty = Math.max(1, Number(it?.quantity || 0));
      if (!pid || !qty) return res.status(400).json({ ok: false, error: "bad_item" });

      const ids = storeGetStripeIds(pid);
      if (!ids?.stripe_price_id) {
        return res.status(400).json({ ok: false, error: `missing_price:${pid}` });
      }
      line_items.push({ price: ids.stripe_price_id, quantity: qty });
    }

    const session = await s.checkout.sessions.create({
      mode: "payment",
      success_url: STRIPE_SUCCESS_URL,
      cancel_url: STRIPE_CANCEL_URL,
      line_items,
      billing_address_collection: "auto",
      shipping_address_collection: { allowed_countries: ["US", "CA"] },
      allow_promotion_codes: true,
    });

    res.json({ ok: true, sessionId: session.id, url: session.url });
  } catch (err: any) {
    console.error("[store/checkout] error:", err?.message || err);
    res.status(500).json({ ok: false, error: "checkout_failed" });
  }
});

// ---------- admin guard ----------
function requireAdmin(req: Request) {
  if (!ADMIN_TOKEN) return;
  const t = (req.header("x-access-token") || "").trim();
  if (t !== ADMIN_TOKEN) {
    const e: any = new Error("unauthorized");
    e.status = 401;
    throw e;
  }
}

// ---------- admin: upsert product (Option A or B) ----------
router.post("/admin/products", express.json(), async (req: Request, res: Response) => {
  try {
    requireAdmin(req);

    const b = (req.body || {}) as any;

    // Normalize input fields
    const id = String(b.id || b.product_id || "").trim();
    const name = String(b.name || "").trim();
    const description = String(b.description || "").trim();
    const priceDollars = Number(b.price ?? b.price_dollars ?? NaN);
    const display_price_cents =
      Number.isFinite(priceDollars) && priceDollars > 0
        ? Math.round(priceDollars * 100)
        : Number(b.display_price_cents ?? NaN);
    const currency = (b.currency || "usd").toLowerCase();
    const images: string[] = Array.isArray(b.images) ? b.images : (b.image ? [String(b.image)] : []);
    const active = b.active !== false;
    const stock = typeof b.stock === "number" ? b.stock : null;
    const sort = typeof b.sort === "number" ? b.sort : null;
    const brand = b.brand ? String(b.brand) : null;
    const model = b.model ? String(b.model) : null;
    const universal = !!b.universal;

    if (!id || !name || !description || !Number.isFinite(display_price_cents) || !images.length) {
      return res.status(400).json({ ok: false, error: "missing_fields" });
    }

    // If Option A, caller passes existing Stripe price ID (and optionally product id)
    const stripe_price_id: string | undefined = b.priceId || b.stripe_price_id;
    const stripe_product_id: string | undefined = b.stripe?.productId || b.stripe_product_id;

    // If Option B, we will create in Stripe using provided details
    const wantAutoStripe = !stripe_price_id;

    // 1) upsert local product
    const saved: StoreProduct = storeUpsertProduct({
      id,
      name,
      description,
      display_price_cents,
      currency,
      images,
      active,
      stock,
      sort,
      brand,
      model,
      universal,
    });

    // 2) ensure stripe ids
    let finalStripeProductId: string | null = stripe_product_id || null;
    let finalStripePriceId: string | null = stripe_price_id || null;

    if (wantAutoStripe) {
      const s = await getStripe();
      if (!s) return res.status(500).json({ ok: false, error: "stripe_not_configured" });

      // create product (or reuse)
      if (!finalStripeProductId) {
        const createdP = await s.products.create({
          name: saved.name,
          description: saved.description,
          images,
          metadata: { local_product_id: saved.id },
        });
        finalStripeProductId = createdP.id;
      }

      // create price
      const createdPrice = await s.prices.create({
        unit_amount: saved.display_price_cents,
        currency: saved.currency,
        product: finalStripeProductId,
      });
      finalStripePriceId = createdPrice.id;
    } else {
      // Option A: touch Stripe (best effort), persist link
      const s = await getStripe();
      if (s && finalStripePriceId) {
        try {
          const pr = await s.prices.retrieve(finalStripePriceId);
          const pid = typeof (pr as any).product === "string" ? (pr as any).product : pr.product?.id;
          finalStripeProductId = finalStripeProductId || pid || null;
          storeTouchSeenStripe(saved.id);
        } catch {/* ignore */}
      }
    }

    // 3) persist stripe id mapping
    storeSetStripeIds(saved.id, finalStripeProductId, finalStripePriceId);

    // Return current local view
    res.json({ ok: true, product: storeGetProduct(saved.id) });
  } catch (err: any) {
    const status = err?.status || 500;
    console.error("[store/admin/products] error:", err?.message || err);
    res.status(status).json({ ok: false, error: err?.message || "admin_upsert_failed" });
  }
});

// ---------- admin: list raw ----------
router.get("/admin/products", (req: Request, res: Response) => {
  try {
    requireAdmin(req);
    // raw list for admins = use public + ids from stripe table if needed
    const rows = storeAllProductsPublic();
    res.json({ ok: true, products: rows });
  } catch (err: any) {
    const status = err?.status || 500;
    res.status(status).json({ ok: false, error: err?.message || "unauthorized" });
  }
});

// ---------- public: compatibility search ----------
router.get("/compat", (req: Request, res: Response) => {
  const brand = String(req.query.brand || "").trim();
  const model = String(req.query.model || "").trim();
  if (!brand || !model) return res.status(400).json({ ok: false, error: "missing_params" });

  const rows = storeListCompat(brand, model);
  const out = rows.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    price: Math.round(p.display_price_cents) / 100,
    currency: p.currency,
    image: (p.images && p.images[0]) || "",
    stock: p.stock ?? null,
  }));
  res.json({ ok: true, products: out });
});

// ---------- admin: add compatibility row ----------
router.post("/admin/compat", express.json(), (req: Request, res: Response) => {
  try {
    requireAdmin(req);
    const { product_id, vehicle_brand, vehicle_model, note } = req.body || {};
    if (!product_id || !vehicle_brand || !vehicle_model) {
      return res.status(400).json({ ok: false, error: "missing_fields" });
    }
    storeAddCompat(String(product_id), String(vehicle_brand), String(vehicle_model), note ? String(note) : undefined);
    res.json({ ok: true });
  } catch (err: any) {
    const status = err?.status || 500;
    res.status(status).json({ ok: false, error: err?.message || "admin_add_compat_failed" });
  }
});

export default router;