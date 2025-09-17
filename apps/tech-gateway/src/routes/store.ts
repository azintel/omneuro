// ////apps/tech-gateway/src/routes/store.ts
import express from "express";
import type { Request, Response } from "express";

// Stripe setup (requires STRIPE_SECRET_KEY in env)
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_SUCCESS_URL =
  process.env.STORE_SUCCESS_URL || "https://juicejunkiez.com/store/?status=success";
const STRIPE_CANCEL_URL =
  process.env.STORE_CANCEL_URL || "https://juicejunkiez.com/store/?status=cancel";

let stripe: any = null;
if (STRIPE_SECRET_KEY) {
  // Lazy import to avoid build complaining when key is absent in dev
  const Stripe = (await import("stripe")).default;
  stripe = new Stripe(STRIPE_SECRET_KEY);
}

const router = express.Router();

/**
 * Temporary in-code product catalog.
 * Replace the `priceId` values with your real Stripe Price IDs.
 * You can add/edit products here or move to a DB later.
 */
type Product = {
  id: string;
  name: string;
  description: string;
  price: number; // in smallest currency unit display only (e.g., 3499 => $34.99), purely informational
  currency: "usd";
  image: string; // public URL under /store/images/...
  priceId: string; // Stripe Price ID (for checkout)
  active: boolean;
};

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

// Public: list products (no priceId leakage)
router.get("/products", (_req: Request, res: Response) => {
  const items = PRODUCTS.filter(p => p.active).map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    price: p.price,
    currency: p.currency,
    image: p.image,
  }));
  res.json({ ok: true, products: items });
});

// Public: create Checkout Session from cart
router.post("/checkout", express.json(), async (req: Request, res: Response) => {
  try {
    if (!stripe) {
      return res.status(500).json({ ok: false, error: "stripe_not_configured" });
    }

    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    // items: [{ id: string, quantity: number }]
    if (!items.length) {
      return res.status(400).json({ ok: false, error: "empty_cart" });
    }

    // Validate & map to Stripe line_items
    const line_items = [];
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
      // you can add metadata here if needed
    });

    return res.status(200).json({ ok: true, sessionId: session.id, url: session.url });
  } catch (err: any) {
    console.error("[store/checkout] error:", err?.message || err);
    return res.status(500).json({ ok: false, error: "checkout_failed" });
  }
});

export default router;