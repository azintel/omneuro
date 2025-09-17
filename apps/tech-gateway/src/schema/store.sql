-- ////apps/tech-gateway/src/schema/store.sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  currency TEXT NOT NULL DEFAULT 'usd',
  image TEXT,
  stripe_price_id TEXT,
  price_display_cents INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  stock INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS product_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL,
  url TEXT NOT NULL,
  sort INTEGER DEFAULT 0,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS product_categories (
  product_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  PRIMARY KEY (product_id, category_id),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS product_tags (
  product_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (product_id, tag_id),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS makes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vehicle_models (
  id TEXT PRIMARY KEY,
  make_id TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT,
  FOREIGN KEY (make_id) REFERENCES makes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS product_fitments (
  product_id TEXT NOT NULL,
  model_id TEXT,
  universal INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  PRIMARY KEY (product_id, model_id),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (model_id) REFERENCES vehicle_models(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS carts (
  id TEXT PRIMARY KEY,
  user_id INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS cart_items (
  id TEXT PRIMARY KEY,
  cart_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id INTEGER,
  stripe_session_id TEXT,
  status TEXT DEFAULT 'created',
  total_cents INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);