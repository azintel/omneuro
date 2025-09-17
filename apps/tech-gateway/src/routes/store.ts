// apps/tech-gateway/src/routes/store.ts
import express from "express";
import type { Request, Response } from "express";

// ---- Stripe + config (from PM2 env) ----
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_SUCCESS_URL = process.env.STORE_SUCCESS_URL || "https://juicejunkiez.com/store/?status=success";
const STRIPE_CANCEL_URL  = process.env.STORE_CANCEL_URL  || "https://juicejunkiez.com/store/?status=cancel";
const ADMIN_TOKEN        = process.env.TECH_GATEWAY_ACCESS_TOKEN || ""; // optional: guard admin routes

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

// ---- Catalog model (in-memory for now) ----
type Product = {
  id: string;                // our internal ID (used by storefront/cart)
  name: string;
  description: string;
  price: number;             // display only (cents)
  currency: "usd";
  image: string;             // /store/images/...
  priceId: string;           // Stripe Price ID used at checkout
  active: boolean;
  stock?: number | null;     // optional stock
};

const PRODUCTS: Product[] = [
  {
    id: "jj-3dp-mount-small",
    name: "3D Printed Scooter Phone Mount (Small)",
    description: "Durable PETG phone mount sized for smaller handlebars.",
    price: 1999, currency: "usd",
    image: "/store/images/phone-mount-small.jpg",
    priceId: "price_XXX_REPLACE_ME_SMALL",
    active: true,
  },
  {
    id: "jj-3dp-mount-large",
    name: "3D Printed Scooter Phone Mount (Large)",
    description: "PETG mount for thicker bars. Includes rubber shim.",
    price: 2299, currency: "usd",
    image: "/store/images/phone-mount-large.jpg",
    priceId: "price_XXX_REPLACE_ME_LARGE",
    active: true,
  },
  {
    id: "jj-3dp-battery-bracket",
    name: "E-Bike Battery Bracket",
    description: "Custom bracket for common down-tube battery packs.",
    price: 3499, currency: "usd",
    image: "/store/images/battery-bracket.jpg",
    priceId: "price_XXX_REPLACE_ME_BRACKET",
    active: true,
  },
];

// ---- Health (kept public but returns config state) ----
router.get("/health", async (_req: Request, res: Response) => {
  const s = Boolean(STRIPE_SECRET_KEY);
  res.json({
    ok: true,
    service: "store",
    stripe: s ? "configured" : "missing_key",
  });
});

// ---- Public: list products (hide priceId) ----
router.get("/products", (_req: Request, res: Response) => {
  const items = PRODUCTS.filter(p => p.active).map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    price: p.price,
    currency: p.currency,
    image: p.image,
    stock: p.stock ?? null,
  }));
  res.json({ ok: true, products: items });
});

// ---- Public: checkout from cart ----
// body: { items: [{ id: string, quantity: number }, ...] }
router.post("/checkout", express.json(), async (req: Request, res: Response) => {
  try {
    const stripe = await getStripe();
    if (!stripe) return res.status(500).json({ ok: false, error: "stripe_not_configured" });

    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) return res.status(400).json({ ok: false, error: "empty_cart" });

    const line_items: Array<{ price: string; quantity: number }> = [];
    for (const it of items) {
      const qty = Math.max(1, Number(it?.quantity || 0));
      const product = PRODUCTS.find(p => p.id === String(it?.id) && p.active);
      if (!product || !product.priceId) {
        return res.status(400).json({ ok: false, error: `invalid_item:${it?.id}` });
      }
      line_items.push({ price: product.priceId, quantity: qty });
    }

    const session = await stripe.checkout.sessions.create({
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

// ---- Admin guard (optional X-Access-Token) ----
function requireAdmin(req: Request) {
  if (!ADMIN_TOKEN) return; // if not set, skip (already behind Basic Auth at /api/*)
  const t = (req.header("x-access-token") || "").trim();
  if (t !== ADMIN_TOKEN) {
    const e: any = new Error("unauthorized");
    e.status = 401;
    throw e;
  }
}

// ---- Admin: upsert product, auto-create Stripe Product/Price if missing ----
// Accepts either:
//   A) Provide existing Stripe priceId
//      { id, name, description, price, currency, image, priceId, active, stock? }
//   B) Ask us to create Stripe product/price:
//      { id, name, description, price, currency, image, active, stock?,
//        stripe: { productId? , images?: string[], metadata?: Record<string,string> } }
//      - If stripe.productId omitted, we create Product.
//      - We always create a Price from provided `price` (cents) & `currency` and attach to product.
router.post("/admin/products", express.json(), async (req: Request, res: Response) => {
  try {
    requireAdmin(req);

    const {
      id,
      name,
      description,
      price,
      currency = "usd",
      image,
      active = true,
      stock = null,
      priceId,       // if present, we won't create a new Stripe Price
      stripe: stripeOpts = {},
    } = (req.body || {}) as any;

    if (!id || !name || !description || !image) {
      return res.status(400).json({ ok: false, error: "missing_fields" });
    }
    if (typeof price !== "number" || price <= 0) {
      return res.status(400).json({ ok: false, error: "invalid_price" });
    }

    let finalPriceId = String(priceId || "");
    // If no priceId provided, create in Stripe
    if (!finalPriceId) {
      const s = await getStripe();
      if (!s) return res.status(500).json({ ok: false, error: "stripe_not_configured" });

      // Ensure a Stripe Product exists (use provided productId or create one)
      let productId = String(stripeOpts.productId || "");
      if (!productId) {
        const createdProduct = await s.products.create({
          name,
          description,
          images: stripeOpts.images?.length ? stripeOpts.images : [image],
          metadata: stripeOpts.metadata || {},
        });
        productId = createdProduct.id;
      }

      // Create a Price tied to that product
      const createdPrice = await s.prices.create({
        unit_amount: price,
        currency,
        product: productId,
      });
      finalPriceId = createdPrice.id;
    }

    // Upsert into our in-memory catalog
    const idx = PRODUCTS.findIndex(p => p.id === id);
    const record: Product = {
      id, name, description,
      price, currency,
      image,
      priceId: finalPriceId,
      active: !!active,
      stock: typeof stock === "number" ? stock : null,
    };
    if (idx >= 0) PRODUCTS[idx] = record;
    else PRODUCTS.push(record);

    return res.status(200).json({ ok: true, product: record });
  } catch (err: any) {
    const status = err?.status || 500;
    console.error("[store/admin/products] error:", err?.message || err);
    res.status(status).json({ ok: false, error: err?.message || "admin_upsert_failed" });
  }
});

// ---- Admin: list raw catalog (to verify upserts) ----
router.get("/admin/products", (req: Request, res: Response) => {
  try {
    requireAdmin(req);
    res.json({ ok: true, products: PRODUCTS });
  } catch (err: any) {
    const status = err?.status || 500;
    res.status(status).json({ ok: false, error: err?.message || "unauthorized" });
  }
});

export default router;