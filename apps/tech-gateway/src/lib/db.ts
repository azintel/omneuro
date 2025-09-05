// apps/tech-gateway/src/lib/db.ts
import DatabaseCtor from "better-sqlite3";
import type { Database as BetterSqliteDb } from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { customAlphabet } from "nanoid";

// paths
const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "garage.db");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// open + pragmas
const db = new DatabaseCtor(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");
db.pragma("foreign_keys = ON");

// schema bootstrap (idempotent)
db.exec(`
  -- owners / vehicles
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

  -- catalog: services & fees
  CREATE TABLE IF NOT EXISTS services (
    id           TEXT PRIMARY KEY,
    \`key\`      TEXT UNIQUE NOT NULL,
    name         TEXT NOT NULL,
    description  TEXT,
    base_price   REAL NOT NULL,
    created_at   TEXT DEFAULT (datetime('now')),
    updated_at   TEXT
  );

  CREATE TABLE IF NOT EXISTS fees (
    id           TEXT PRIMARY KEY,
    \`key\`      TEXT UNIQUE NOT NULL,
    name         TEXT NOT NULL,
    description  TEXT,
    unit_price   REAL NOT NULL,
    created_at   TEXT DEFAULT (datetime('now')),
    updated_at   TEXT
  );

  -- scheduler
  CREATE TABLE IF NOT EXISTS appointments (
    id            TEXT PRIMARY KEY,
    date          TEXT NOT NULL,             -- YYYY-MM-DD
    start_minute  INTEGER NOT NULL,
    end_minute    INTEGER NOT NULL,
    owner_email   TEXT NOT NULL,
    vehicle_id    INTEGER,
    status        TEXT NOT NULL,             -- scheduled/cancelled/completed
    created_at    TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL
  );

  -- audit/events
  CREATE TABLE IF NOT EXISTS events (
    id       TEXT PRIMARY KEY,
    ts       TEXT DEFAULT (datetime('now')),
    actor    TEXT,
    type     TEXT,
    json     TEXT
  );
`);

// nano id helper
const nano = customAlphabet("0123456789abcdefghijkmnopqrstuvwxyz", 12);
export function nid(): string { return nano(); }
;(db as any).nid = nid;

// ------------ types ------------
export type Owner = { email: string; name?: string | null; phone?: string | null };
export type Vehicle = {
  id?: number;
  owner_email: string;
  make: string;
  model: string;
  nickname?: string | null;
  notes?: string | null;
  created_at?: string;
};

export type Service = {
  id: string; key: string; name: string;
  description?: string | null;
  base_price: number;
  created_at?: string; updated_at?: string | null;
};

export type Fee = {
  id: string; key: string; name: string;
  description?: string | null;
  unit_price: number;
  created_at?: string; updated_at?: string | null;
};

export type Appointment = {
  id: string;
  date: string;
  start_minute: number;
  end_minute: number;
  owner_email: string;
  vehicle_id?: number | null;
  status: "scheduled" | "cancelled" | "completed";
};

// ---------- owners / vehicles ----------
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
  if (!v.owner_email || !v.make || !v.model) throw new Error("owner_email, make, model are required");
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
  return db.prepare("SELECT * FROM vehicles WHERE owner_email = ? ORDER BY created_at DESC, id DESC")
    .all(owner_email) as Vehicle[];
}

// ---------- catalog: services ----------
export function createService(input: { key: string; name: string; description?: string; base_price: number }): Service {
  const id = nid();
  db.prepare(`INSERT INTO services (id, key, name, description, base_price) VALUES (?, ?, ?, ?, ?)`)
    .run(id, input.key.trim(), input.name.trim(), (input.description ?? null), Number(input.base_price));
  return getServiceByKey(input.key)!;
}

export function updateService(key: string, patch: Partial<Omit<Service,"id"|"key"|"created_at">>): Service | null {
  const s = getServiceByKey(key);
  if (!s) return null;
  db.prepare(`
    UPDATE services
       SET name = COALESCE(?, name),
           description = COALESCE(?, description),
           base_price = COALESCE(?, base_price),
           updated_at = datetime('now')
     WHERE key = ?
  `).run(patch.name ?? null, patch.description ?? null, (patch.base_price as number | null) ?? null, key);
  return getServiceByKey(key);
}

export function listServices(): Service[] {
  return db.prepare(`SELECT * FROM services ORDER BY name ASC`).all() as Service[];
}
export function getServiceByKey(key: string): Service | null {
  return (db.prepare(`SELECT * FROM services WHERE key = ?`).get(key) as Service | undefined) ?? null;
}

// ---------- catalog: fees ----------
export function createFee(input: { key: string; name: string; description?: string; unit_price: number }): Fee {
  const id = nid();
  db.prepare(`INSERT INTO fees (id, key, name, description, unit_price) VALUES (?, ?, ?, ?, ?)`)
    .run(id, input.key.trim(), input.name.trim(), (input.description ?? null), Number(input.unit_price));
  return getFeeByKey(input.key)!;
}
export function updateFee(key: string, patch: Partial<Omit<Fee,"id"|"key"|"created_at">>): Fee | null {
  const f = getFeeByKey(key);
  if (!f) return null;
  db.prepare(`
    UPDATE fees
       SET name = COALESCE(?, name),
           description = COALESCE(?, description),
           unit_price = COALESCE(?, unit_price),
           updated_at = datetime('now')
     WHERE key = ?
  `).run(patch.name ?? null, patch.description ?? null, (patch.unit_price as number | null) ?? null, key);
  return getFeeByKey(key);
}
export function listFees(): Fee[] {
  return db.prepare(`SELECT * FROM fees ORDER BY name ASC`).all() as Fee[];
}
export function getFeeByKey(key: string): Fee | null {
  return (db.prepare(`SELECT * FROM fees WHERE key = ?`).get(key) as Fee | undefined) ?? null;
}

// ---------- scheduler ----------
export function createAppointment(a: Appointment): Appointment {
  db.prepare(`
    INSERT INTO appointments (id, date, start_minute, end_minute, owner_email, vehicle_id, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    a.id, a.date, a.start_minute, a.end_minute, a.owner_email, a.vehicle_id ?? null, a.status
  );
  return db.prepare(`SELECT * FROM appointments WHERE id = ?`).get(a.id) as Appointment;
}

// ---------- events ----------
export function logEvent(e: { actor?: string | null; type: string; json?: any }) {
  db.prepare(`INSERT INTO events (id, actor, type, json) VALUES (?, ?, ?, ?)`)
    .run(nid(), e.actor ?? null, e.type, e.json ? JSON.stringify(e.json) : null);
}

// final type + export
export type DB = BetterSqliteDb & { nid: () => string };
export default db as DB;