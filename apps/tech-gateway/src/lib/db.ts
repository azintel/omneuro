// apps/tech-gateway/src/lib/db.ts
// Minimal SQLite layer for Client Garage + scheduler tables.

import Database from "better-sqlite3";
import type { Database as BetterSqliteDatabase } from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { customAlphabet } from "nanoid";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "garage.db");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);

// Baseline pragmas
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");
db.pragma("foreign_keys = ON");

// Core tables (owners/vehicles) — unchanged
db.exec(`
  CREATE TABLE IF NOT EXISTS owners (
    email       TEXT PRIMARY KEY,
    name        TEXT,
    phone       TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS vehicles (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_email  TEXT NOT NULL,
    make         TEXT NOT NULL,
    model        TEXT NOT NULL,
    nickname     TEXT,
    notes        TEXT,
    created_at   TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (owner_email) REFERENCES owners(email) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_vehicles_owner ON vehicles(owner_email);
`);

// NEW: audit + scheduler tables
db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id    TEXT PRIMARY KEY,
    ts    INTEGER NOT NULL,
    actor TEXT,
    type  TEXT,
    json  TEXT
  );

  CREATE TABLE IF NOT EXISTS techs (
    id        TEXT PRIMARY KEY,
    name      TEXT UNIQUE,
    email     TEXT,
    phone     TEXT,
    is_active INTEGER
  );

  CREATE TABLE IF NOT EXISTS tech_availability (
    id            TEXT PRIMARY KEY,
    tech_id       TEXT NOT NULL,
    day_of_week   INTEGER,           -- 0..6 (Sun..Sat)
    start_minute  INTEGER,
    end_minute    INTEGER,
    capacity      INTEGER DEFAULT 1,
    FOREIGN KEY (tech_id) REFERENCES techs(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_avail_tech_dow ON tech_availability(tech_id, day_of_week);

  CREATE TABLE IF NOT EXISTS appointments (
    id            TEXT PRIMARY KEY,
    date          TEXT,              -- YYYY-MM-DD
    start_minute  INTEGER,
    end_minute    INTEGER,
    owner_email   TEXT,
    vehicle_id    INTEGER,
    status        TEXT,              -- scheduled|cancelled|completed
    created_at    TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (owner_email) REFERENCES owners(email) ON DELETE SET NULL,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)  ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_appts_date ON appointments(date);
`);

// Types you already used
export type Owner = { email: string; name?: string; phone?: string };
export type Vehicle = {
  id?: number;
  owner_email: string;
  make: string;
  model: string;
  nickname?: string;
  notes?: string;
  created_at?: string;
};

// Existing APIs (unchanged)
export function upsertOwner(owner: Owner) {
  const { email, name = null, phone = null } = owner;
  if (!email) throw new Error("owner.email required");
  const row = db.prepare("SELECT email FROM owners WHERE email = ?").get(email);
  if (row) {
    db.prepare("UPDATE owners SET name = COALESCE(?, name), phone = COALESCE(?, phone) WHERE email = ?")
      .run(name, phone, email);
  } else {
    db.prepare("INSERT INTO owners (email, name, phone) VALUES (?, ?, ?)").run(email, name, phone);
  }
}

export function addVehicle(v: Vehicle): Vehicle {
  if (!v.owner_email || !v.make || !v.model) {
    throw new Error("owner_email, make, model are required");
  }
  const info = db.prepare(`
    INSERT INTO vehicles (owner_email, make, model, nickname, notes)
    VALUES (@owner_email, @make, @model, @nickname, @notes)
  `).run({
    owner_email: v.owner_email.trim(),
    make: v.make.trim(),
    model: v.model.trim(),
    nickname: (v.nickname ?? "").trim() || null,
    notes: (v.notes ?? "").trim() || null,
  });
  const got = db.prepare("SELECT * FROM vehicles WHERE id = ?").get(info.lastInsertRowid as number);
  return got as Vehicle;
}

export function listVehiclesByOwner(owner_email: string): Vehicle[] {
  if (!owner_email) return [];
  const stmt = db.prepare("SELECT * FROM vehicles WHERE owner_email = ? ORDER BY created_at DESC, id DESC");
  return stmt.all(owner_email) as Vehicle[];
}

// Small id helper + attach for convenience
const nano = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 12);
export function nid() { return nano(); }
;(db as any).nid = nid;

// Export a typed DB that references the external type we also export
export type DB = BetterSqliteDatabase & { nid: () => string };
export default db as DB;