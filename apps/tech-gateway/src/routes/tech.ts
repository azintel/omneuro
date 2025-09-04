// apps/tech-gateway/src/routes/tech.ts
import { Router, type Request, type Response } from "express";
import db from "../lib/db.js";

const router = Router();

type TimeRange = { start: number; end: number }; // minutes from midnight inclusive / exclusive

function parseRangeToMinutes(s: string): TimeRange | null {
  // "10-12" or "10:30-12:15" (24h)
  const m = String(s || "").trim().match(/^(\d{1,2})(?::(\d{2}))?-(\d{1,2})(?::(\d{2}))?$/);
  if (!m) return null;
  const h1 = Number(m[1]), n1 = Number(m[2] ?? 0);
  const h2 = Number(m[3]), n2 = Number(m[4] ?? 0);
  if ([h1,h2,n1,n2].some(x => !Number.isFinite(x))) return null;
  const start = h1 * 60 + n1;
  const end   = h2 * 60 + n2;
  if (start < 0 || end <= start || end > 24 * 60) return null;
  return { start, end };
}

/**
 * Natural-ish command to bulk-create a tech and availability.
 * Body example:
 * {
 *   "cmd": "add availability",
 *   "name": "Zack",
 *   "days": ["tuesday","thursday","saturday","sunday"],
 *   "ranges": ["10-12","12-15","15-18"],
 *   "capacity": 1
 * }
 */
router.post("/command", (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Partial<{
    cmd: string;
    name: string;
    days: string[];
    ranges: string[];
    capacity: number;
  }>;

  const name = String(body.name || "").trim();
  const days = Array.isArray(body.days) ? body.days : [];
  const ranges = Array.isArray(body.ranges) ? body.ranges : [];
  const capacity = Number.isFinite(body.capacity) ? Number(body.capacity) : 1;

  if (!name) return res.status(400).json({ error: "name required" });
  if (!days.length || !ranges.length) {
    return res.status(400).json({ error: "days and ranges required" });
  }

  const dmap: Record<string, number> = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
    thursday: 4, friday: 5, saturday: 6,
  };
  const dayIdx: number[] = days
    .map(d => dmap[String(d || "").toLowerCase()] )
    .filter((n): n is number => Number.isInteger(n));

  if (!dayIdx.length) return res.status(400).json({ error: "invalid days" });

  // Create tech (idempotent by name)
  const existing = db.prepare(`SELECT id, name FROM techs WHERE LOWER(name)=LOWER(?)`).get(name) as { id?: string } | undefined;
  const id = existing?.id || (db as any).nid();
  if (!existing) {
    db.prepare(`INSERT INTO techs (id,name,email,phone,is_active) VALUES (?,?,?,?,1)`).run(id, name, null, null);
  }
  const tech = { id, name };

  // Insert availability
  const inserted: Array<{ day_of_week: number; start_minute: number; end_minute: number; capacity: number }> = [];
  for (const dow of dayIdx) {
    for (const rStr of ranges) {
      const r = parseRangeToMinutes(rStr);
      if (!r) continue;
      db.prepare(`
        INSERT INTO tech_availability (id,tech_id,day_of_week,start_minute,end_minute,capacity)
        VALUES (?,?,?,?,?,?)
      `).run((db as any).nid(), tech.id, dow, r.start, r.end, capacity);
      inserted.push({ day_of_week: dow, start_minute: r.start, end_minute: r.end, capacity });
    }
  }

  // Audit
  db.prepare(`INSERT INTO events (id,ts,actor,type,json) VALUES (?,?,?,?,?)`)
    .run((db as any).nid(), Date.now(), "tech-portal", "availability_bulk_add",
      JSON.stringify({ tech, inserted }));

  return res.json({ ok: true, tech, inserted_count: inserted.length, windows: ranges, days });
});

export default router;