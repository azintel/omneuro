import Database from 'better-sqlite3';
import type { Database as SQLiteDatabase } from 'better-sqlite3';
import { customAlphabet } from 'nanoid';

export const db: SQLiteDatabase = new Database('tech-gateway.db');

// --- helpers ---
const nid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 12);
function hasTable(name: string): boolean {
  const row = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(name);
  return Boolean(row);
}
function hasColumn(tbl: string, col: string): boolean {
  if (!hasTable(tbl)) return false;
  const cols = db.prepare(`PRAGMA table_info(${tbl})`).all() as Array<{ name: string }>;
  return cols.some(c => c.name === col);
}

// --- base tables (existing) ---
db.exec(`
CREATE TABLE IF NOT EXISTS messages(
  id TEXT PRIMARY KEY,
  phone TEXT,
  body TEXT,
  dir TEXT,
  ts INTEGER
);
`);

// --- auth + ownership + events (new) ---
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
  id TEXT PRIMARY KEY,            -- random string
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

// Safe migration: add owner_user_id to vehicles (if both table and column exist/miss)
try {
  if (hasTable('vehicles') && !hasColumn('vehicles', 'owner_user_id')) {
    db.exec(`ALTER TABLE vehicles ADD COLUMN owner_user_id INTEGER;`);
  }
} catch {/* ignore if already added elsewhere */}

// --- message utilities (unchanged) ---
export function logMessage(phone: string, body: string, dir: 'in'|'out') {
  const id = nid();
  const ts = Date.now();
  db.prepare('INSERT INTO messages (id,phone,body,dir,ts) VALUES (?,?,?,?,?)')
    .run(id, phone, body, dir, ts);
  return { id, phone, body, dir, ts };
}

export function recentMessages(phone: string, limit = 50) {
  return db.prepare('SELECT * FROM messages WHERE phone=? ORDER BY ts DESC LIMIT ?')
    .all(phone, limit)
    .reverse();
}

export default db;