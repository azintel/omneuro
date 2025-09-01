// apps/tech-gateway/src/lib/db.ts
// Minimal SQLite layer for Client Garage (owners + vehicles).
// - Uses better-sqlite3 (sync, fast, simple).
// - DB file lives under apps/tech-gateway/data/garage.db (pm2 cwd set to that app).

import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "garage.db");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);

// Strict-ish baseline settings
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");
db.pragma("foreign_keys = ON");

// Schema bootstrap (idempotent)
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

// Types
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

// Owner upsert
export function upsertOwner(owner: Owner) {
  const { email, name = null, phone = null } = owner;
  if (!email) throw new Error("owner.email required");
  const sel = db.prepare("SELECT email FROM owners WHERE email = ?");
  const row = sel.get(email);
  if (row) {
    db.prepare("UPDATE owners SET name = COALESCE(?, name), phone = COALESCE(?, phone) WHERE email = ?")
      .run(name, phone, email);
  } else {
    db.prepare("INSERT INTO owners (email, name, phone) VALUES (?, ?, ?)").run(email, name, phone);
  }
}

// Add a vehicle
export function addVehicle(v: Vehicle): Vehicle {
  if (!v.owner_email || !v.make || !v.model) {
    throw new Error("owner_email, make, model are required");
  }
  const stmt = db.prepare(`
    INSERT INTO vehicles (owner_email, make, model, nickname, notes)
    VALUES (@owner_email, @make, @model, @nickname, @notes)
  `);
  const info = stmt.run({
    owner_email: v.owner_email.trim(),
    make: v.make.trim(),
    model: v.model.trim(),
    nickname: (v.nickname || "").trim() || null,
    notes: (v.notes || "").trim() || null,
  });
  const got = db.prepare("SELECT * FROM vehicles WHERE id = ?").get(info.lastInsertRowid as number);
  return got as Vehicle;
}

// List vehicles by owner email
export function listVehiclesByOwner(owner_email: string): Vehicle[] {
  if (!owner_email) return [];
  const stmt = db.prepare("SELECT * FROM vehicles WHERE owner_email = ? ORDER BY created_at DESC, id DESC");
  return stmt.all(owner_email) as Vehicle[];
}