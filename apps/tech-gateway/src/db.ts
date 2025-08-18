import Database from 'better-sqlite3';
import { customAlphabet } from 'nanoid';

const db = new Database('tech-gateway.db');
db.exec(`CREATE TABLE IF NOT EXISTS messages(
  id TEXT PRIMARY KEY,
  phone TEXT,
  body TEXT,
  dir TEXT,
  ts INTEGER
)`);

const nid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 12);

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