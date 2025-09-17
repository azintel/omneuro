// ////apps/tech-gateway/src/db.ts
import Database from "better-sqlite3";
import type { Database as SQLiteDatabase } from "better-sqlite3";
import { customAlphabet } from "nanoid";

export const db: SQLiteDatabase = new Database("tech-gateway.db");

// ---------- helpers ----------
const nid = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 12);
function hasTable(name: string): boolean {
  const row = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
    .get(name);
  return Boolean(row);
}
function hasColumn(tbl: string, col: string): boolean {
  if (!hasTable(tbl)) return false;
  const cols = db
    .prepare(`PRAGMA table_info(${tbl})`)
    .all() as Array<{ name: string }>;
  return cols.some((c) => c.name === col);
}

// ---------- baseline tables you already had ----------
db.exec(`
CREATE TABLE IF NOT EXISTS messages(
  id TEXT PRIMARY KEY,
  phone TEXT,
  body TEXT,
  dir TEXT,
  ts INTEGER
);
`);

// ---------- auth + ownership + events (preserves your prior content) ----------
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  phone TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS login_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  last_seen_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT DEFAULT (datetime('now')),
  actor_user_id INTEGER,
  type TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  meta TEXT
);
`);

// Safe migration: add owner_user_id to vehicles (if needed)
try {
  if (hasTable("vehicles") && !hasColumn("vehicles", "owner_user_id")) {
    db.exec(`ALTER TABLE vehicles ADD COLUMN owner_user_id INTEGER;`);
  }
} catch { /* no-op */ }

// ---------- STORE SCHEMA ----------
db.exec(`
CREATE TABLE IF NOT EXISTS store_products (
  id TEXT PRIMARY KEY,                    -- our product id (human or nanoid)
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  display_price_cents INTEGER NOT NULL,   -- price to display in UI
  currency TEXT NOT NULL DEFAULT 'usd',
  images TEXT,                            -- JSON array of strings (URLs)
  active INTEGER NOT NULL DEFAULT 1,
  stock INTEGER,
  sort INTEGER,
  brand TEXT,                             -- for compat filters (optional)
  model TEXT,                             -- for compat filters (optional)
  universal INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS store_stripe (
  product_id TEXT PRIMARY KEY,
  stripe_product_id TEXT,   -- Stripe Product
  stripe_price_id TEXT,     -- Stripe Price
  seen_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (product_id) REFERENCES store_products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS store_compat (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL,
  vehicle_brand TEXT NOT NULL,
  vehicle_model TEXT NOT NULL,
  note TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (product_id) REFERENCES store_products(id) ON DELETE CASCADE
);
`);

// ---------- TYPES ----------
export type StoreProduct = {
  id: string;
  name: string;
  description: string;
  display_price_cents: number;
  currency: "usd" | string;
  images: string[]; // first image used for public listing
  active: number;   // 1/0
  stock: number | null;
  sort: number | null;
  brand: string | null;
  model: string | null;
  universal: number; // 1/0
  created_at: string;
  updated_at: string;
};

export type PublicStoreProduct = {
  id: string;
  name: string;
  description: string;
  price: number;     // dollars for UI convenience
  currency: "usd" | string;
  image: string;     // first image or placeholder
  sort: number | null;
  stock: number | null;
};

// ---------- STORE HELPERS ----------
function rowToProduct(r: any): StoreProduct {
  return {
    ...r,
    images: r.images ? JSON.parse(r.images) : [],
    stock: r.stock ?? null,
    sort: r.sort ?? null,
    brand: r.brand ?? null,
    model: r.model ?? null,
  };
}

export function storeGetProduct(id: string): StoreProduct | null {
  const r = db
    .prepare(`SELECT * FROM store_products WHERE id=?`)
    .get(id);
  return r ? rowToProduct(r) : null;
}

export function storeAllProductsRaw(): StoreProduct[] {
  const rows = db
    .prepare(`SELECT * FROM store_products WHERE active=1 ORDER BY COALESCE(sort, 999999), name`)
    .all();
  return rows.map(rowToProduct);
}

export function storeAllProductsPublic(): PublicStoreProduct[] {
  const rows = storeAllProductsRaw();
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    price: Math.round(p.display_price_cents) / 100,
    currency: p.currency,
    image: (p.images && p.images[0]) || "",
    sort: p.sort ?? null,
    stock: p.stock ?? null,
  }));
}

export function storeUpsertProduct(input: {
  id: string;
  name: string;
  description: string;
  display_price_cents: number;
  currency: string;
  images: string[];
  active?: boolean;
  stock?: number | null;
  sort?: number | null;
  brand?: string | null;
  model?: string | null;
  universal?: boolean;
}): StoreProduct {
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  db.prepare(
    `
    INSERT INTO store_products
      (id,name,description,display_price_cents,currency,images,active,stock,sort,brand,model,universal,created_at,updated_at)
    VALUES
      (@id,@name,@description,@display_price_cents,@currency,@images,@active,@stock,@sort,@brand,@model,@universal,@now,@now)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,
      description=excluded.description,
      display_price_cents=excluded.display_price_cents,
      currency=excluded.currency,
      images=excluded.images,
      active=excluded.active,
      stock=excluded.stock,
      sort=excluded.sort,
      brand=excluded.brand,
      model=excluded.model,
      universal=excluded.universal,
      updated_at=excluded.updated_at
  `
  ).run({
    id: input.id,
    name: input.name,
    description: input.description,
    display_price_cents: input.display_price_cents,
    currency: input.currency,
    images: JSON.stringify(input.images || []),
    active: input.active === false ? 0 : 1,
    stock: input.stock ?? null,
    sort: input.sort ?? null,
    brand: input.brand ?? null,
    model: input.model ?? null,
    universal: input.universal ? 1 : 0,
    now,
  });

  return storeGetProduct(input.id)!;
}

export function storeSetStripeIds(
  product_id: string,
  stripe_product_id: string | null,
  stripe_price_id: string | null
) {
  db.prepare(
    `
    INSERT INTO store_stripe (product_id, stripe_product_id, stripe_price_id, seen_at)
    VALUES (@product_id, @stripe_product_id, @stripe_price_id, datetime('now'))
    ON CONFLICT(product_id) DO UPDATE SET
      stripe_product_id=excluded.stripe_product_id,
      stripe_price_id=excluded.stripe_price_id,
      seen_at=excluded.seen_at
  `
  ).run({ product_id, stripe_product_id, stripe_price_id });
}

export function storeFindStripeIds(product_id: string): {
  stripe_product_id: string | null;
  stripe_price_id: string | null;
} | null {
  const r = db
    .prepare(`SELECT stripe_product_id, stripe_price_id FROM store_stripe WHERE product_id=?`)
    .get(product_id);
  return r || null;
}

export function storeTouchSeenStripe(product_id: string) {
  db.prepare(`UPDATE store_stripe SET seen_at=datetime('now') WHERE product_id=?`).run(product_id);
}

export function storeListCompat(brand: string, model: string) {
  const rows = db
    .prepare(
      `
      SELECT p.*
      FROM store_products p
      LEFT JOIN store_compat c
        ON p.id=c.product_id
      WHERE p.active=1 AND (
        p.universal=1
        OR (c.vehicle_brand=? AND c.vehicle_model=?)
      )
      GROUP BY p.id
      ORDER BY COALESCE(p.sort, 999999), p.name
      `
    )
    .all(brand, model);
  return rows.map(rowToProduct);
}

export function storeAddCompat(
  product_id: string,
  vehicle_brand: string,
  vehicle_model: string,
  note?: string
) {
  db.prepare(
    `INSERT INTO store_compat (product_id, vehicle_brand, vehicle_model, note)
     VALUES (?, ?, ?, ?)`
  ).run(product_id, vehicle_brand, vehicle_model, note ?? null);
}

// ---------- message utilities (unchanged) ----------
export function logMessage(phone: string, body: string, dir: "in" | "out") {
  const id = nid();
  const ts = Date.now();
  db.prepare("INSERT INTO messages (id,phone,body,dir,ts) VALUES (?,?,?,?,?)").run(
    id,
    phone,
    body,
    dir,
    ts
  );
  return { id, phone, body, dir, ts };
}

export function recentMessages(phone: string, limit = 50) {
  return db
    .prepare("SELECT * FROM messages WHERE phone=? ORDER BY ts DESC LIMIT ?")
    .all(phone, limit)
    .reverse();
}

export default db;