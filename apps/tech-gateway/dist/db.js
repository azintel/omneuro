import Database from 'better-sqlite3';
import { customAlphabet } from 'nanoid';
export const nid = customAlphabet('123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz', 16);
export const db = new Database('tech-gateway.db');
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS technicians(
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS messages(
  id TEXT PRIMARY KEY,
  tech_id TEXT NOT NULL,
  dir TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(tech_id) REFERENCES technicians(id)
);
`);
//# sourceMappingURL=db.js.map