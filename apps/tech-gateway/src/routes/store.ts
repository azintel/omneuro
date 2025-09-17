// apps/tech-gateway/src/routes/store.ts
import express from "express";
import type { Request, Response } from "express";

// ---- Config from env (injected by PM2/redeploy) ----
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_SUCCESS_URL =
  process.env.STORE_SUCCESS_URL || "https://juicejunkiez.com/store/?status=success";
const STRIPE_CANCEL_URL =
  process.env.STORE_CANCEL_URL || "https://juicejunkiez.com/store/?status=cancel";
const ADMIN_TOKEN = process.env.TECH_GATEWAY_ACCESS_TOKEN || ""; // optional extra guard

// ---- Lazy Stripe client (avoids build errors if key absent) ----
let stripeSingleton: any = null;
async function getStripe() {
  if (!STRIPE_SECRET_KEY) return null;
  if (!stripeSingleton) {
    const Stripe = (await import("stripe")).default;
    stripeSingleton = new Stripe(STRIPE_SECRET_KEY);
  }
  return stripeSingleton;
}

const router = express.Router();

// ---- Product model (in-memory catalog for now) ----
type Product = {
  id: string;          // your catalog id (string you reference from the storefront)
  name: string;
  description: string;
  price: number;       // display only, cents
  currency: "usd";
  image: string;       // public URL; if empty we'll try to read from Stripe
  priceId: string;     // Stripe Price ID used at checkout
  active: boolean;
  stock?: number | null;
};

// Seed examples (safe to keep)
const PRODUCTS: Product[] = [
  {
    id: "jj-3dp-mount-small",
    name: "3D Printed Scooter Phone Mount (Small)",
    description: "Durable PETG phone mount sized for smaller handlebars.",
    price: 1999,
    currency: "usd",
    image: "/store/images/phone-mount-small.jpg",
    priceId: "price_XXX_REPLACE_ME_SMALL",
    active: true,
  },
  {
    id: "jj-3dp-mount-large",
    name: "3D Printed Scooter Phone Mount (Large)",
    description: "PETG mount for thicker bars. Includes rubber shim.",
    price: 2299,
    currency: "usd",
    image: "/store/images/phone-mount-large.jpg",
    priceId: "price_XXX_REPLACE_ME_LARGE",
    active: true,
  },
  {
    id: "jj-3dp-battery-bracket",
    name: "E-Bike Battery Bracket",
    description: "Custom bracket for common down-tube battery packs.",
    price: 3499,
    currency: "usd",
    image: "/store/images/battery-bracket.jpg",
    priceId: "price_XXX_REPLACE_ME_BRACKET",
    active: true,
  },
];

// ---- Health (public) ----
router.get("/health", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: "store",
    stripe: STRIPE_SECRET_KEY ? "configured" : "missing_key",
  });
});

// ---- Public: list products (hide priceId). If image is missing, try Stripe. ----
router.get("/products", async (_req: Request, res: Response) => {
  const s = await getStripe(); // may be null
  const items = await Promise.all(
    PRODUCTS.filter(p => p.active).map(async (p) => {
      let image = p.image || "";
      if (!image && s && p.priceId) {
        try {
          const price = await s.prices.retrieve(p.priceId);
          const prodId = typeof price.product === "string" ? price.product : price.product?.id;
          if (prodId) {
            const sp = await s.products.retrieve(prodId);
            if (Array.isArray(sp.images) && sp.images[0]) image = sp.images[0];
          }
        } catch {
          // ignore; fail-safe to empty image
        }
      }
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        currency: p.currency,
        image,
        stock: p.stock ?? null,
      };
    })
  );
  res.json({ ok: true, products: items });
});

// ---- Public: checkout from cart ----
// body: { items: [{ id: string, quantity: number }, ...] }
router.post("/checkout", express.json(), async (req: Request, res: Response) => {
  try {
    const s = await getStripe();
    if (!s) return res.status(500).json({ ok: false, error: "stripe_not_configured" });

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

    const session = await s.checkout.sessions.create({
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

// ---- Admin guard (optional X-Access-Token; API itself is Basic-Auth gated) ----
function requireAdmin(req: Request) {
  if (!ADMIN_TOKEN) return; // skip if not configured
  const t = (req.header("x-access-token") || "").trim();
  if (t !== ADMIN_TOKEN) {
    const e: any = new Error("unauthorized");
    e.status = 401;
    throw e;
  }
}

// ---- Admin: upsert product. Either provide an existing priceId,
//      or ask us to create a Product/Price in Stripe automatically. ----
// Body variants:
// A) With existing priceId:
//    { id, name, description, price, currency, image, priceId, active, stock? }
// B) Auto-create in Stripe (if priceId omitted):
//    { id, name, description, price, currency, image, active, stock?,
//      stripe: { productId?, images?: string[], metadata?: Record<string,string> } }
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
      priceId,
      stripe: sopts = {},
    } = (req.body || {}) as any;

    if (!id || !name || !description || !image) {
      return res.status(400).json({ ok: false, error: "missing_fields" });
    }
    if (typeof price !== "number" || price <= 0) {
      return res.status(400).json({ ok: false, error: "invalid_price" });
    }

    let finalPriceId = String(priceId || "");

    if (!finalPriceId) {
      const s = await getStripe();
      if (!s) return res.status(500).json({ ok: false, error: "stripe_not_configured" });

      // Use provided productId or create one
      let productId = String(sopts.productId || "");
      if (!productId) {
        const createdProduct = await s.products.create({
          name,
          description,
          images: Array.isArray(sopts.images) && sopts.images.length ? sopts.images : [image],
          metadata: sopts.metadata || {},
        });
        productId = createdProduct.id;
      }

      const createdPrice = await s.prices.create({
        unit_amount: price,
        currency,
        product: productId,
      });
      finalPriceId = createdPrice.id;
    }

    // Upsert into in-memory catalog
    const idx = PRODUCTS.findIndex(p => p.id === id);
    const record: Product = {
      id,
      name,
      description,
      price,
      currency,
      image,
      priceId: finalPriceId,
      active: !!active,
      stock: typeof stock === "number" ? stock : null,
    };
    if (idx >= 0) PRODUCTS[idx] = record;
    else PRODUCTS.push(record);

    res.status(200).json({ ok: true, product: record });
  } catch (err: any) {
    const status = err?.status || 500;
    console.error("[store/admin/products] error:", err?.message || err);
    res.status(status).json({ ok: false, error: err?.message || "admin_upsert_failed" });
  }
});

// ---- Admin: list raw catalog (verify what’s loaded) ----
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