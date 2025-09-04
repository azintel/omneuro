// apps/tech-gateway/src/routes/scheduler.ts
import { Router, type Request, type Response } from "express";
import db from "../lib/db.js";
import { appendAppointmentRow } from "../lib/sheets.js";
import { createEvent } from "../lib/calendar.js";

const router = Router();

function minutesToISO(dateStr: string, minutes: number, tz: string): string {
  // Robust parse (avoid Date multi-arg overload types)
  const parts = dateStr.split("-");
  const y = Number(parts[0] ?? 1970);
  const m = Number(parts[1] ?? 1);
  const d = Number(parts[2] ?? 1);

  const baseUTC = Date.UTC(
    Number.isFinite(y) ? y : 1970,
    Number.isFinite(m) ? m - 1 : 0,
    Number.isFinite(d) ? d : 1,
    0, 0, 0, 0
  );
  const t = new Date(baseUTC + minutes * 60_000);

  // stable ISO-like (sv-SE) with zone conversion
  const local = t.toLocaleString("sv-SE", { timeZone: tz, hour12: false });
  return local.replace(" ", "T");
}

router.post("/appointments", async (req: Request, res: Response) => {
  try {
    const b = (req.body ?? {}) as Partial<{
      date: string;
      start_minute: number;
      end_minute: number;
      owner_email: string;
      vehicle_id: number;
      summary?: string;
      description?: string;
      attendees?: { email: string; displayName?: string }[];
    }>;

    const date = String(b.date || "").trim();
    const start_minute = Number(b.start_minute);
    const end_minute   = Number(b.end_minute);
    const owner_email  = String(b.owner_email || "").trim().toLowerCase();
    const vehicle_id   = Number(b.vehicle_id);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "invalid date" });
    }
    if (!Number.isFinite(start_minute) || !Number.isFinite(end_minute) ||
        start_minute < 0 || end_minute <= start_minute || end_minute > 1440) {
      return res.status(400).json({ error: "invalid start/end minutes" });
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(owner_email)) {
      return res.status(400).json({ error: "invalid owner_email" });
    }
    if (!Number.isFinite(vehicle_id) || vehicle_id <= 0) {
      return res.status(400).json({ error: "invalid vehicle_id" });
    }

    // capacity check
    const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
    const capRow = db.prepare(`
      SELECT COALESCE(SUM(capacity),0) AS cap
        FROM tech_availability
       WHERE day_of_week = ?
         AND start_minute <= ?
         AND end_minute   >= ?
    `).get(dow, start_minute, end_minute) as { cap: number };

    const existing = db.prepare(`
      SELECT COUNT(*) AS n
        FROM appointments
       WHERE date = ?
         AND start_minute = ?
         AND end_minute   = ?
    `).get(date, start_minute, end_minute) as { n: number };

    if ((existing?.n || 0) >= (capRow?.cap || 0)) {
      return res.status(409).json({ error: "slot_full" });
    }

    // create
    const info = db.prepare(`
      INSERT INTO appointments (date,start_minute,end_minute,owner_email,vehicle_id,status)
      VALUES (?,?,?,?,?,'scheduled')
    `).run(date, start_minute, end_minute, owner_email, vehicle_id);

    const id = Number(info.lastInsertRowid);

    // Sheets (best effort)
    try {
      await appendAppointmentRow({
        id, date, start_minute, end_minute, owner_email, vehicle_id, status: "scheduled",
      });
    } catch (e: any) {
      console.error("[sheets] append appointment failed:", e?.message || e);
    }

    // Calendar (best effort)
    try {
      const tz = process.env.SCHED_TZ || "America/New_York";
      await createEvent({
        summary: String(b.summary || "Juice Junkiez Service"),
        description: String(b.description || `Owner: ${owner_email} • Vehicle ${vehicle_id}`),
        startISO: minutesToISO(date, start_minute, tz),
        endISO:   minutesToISO(date, end_minute,   tz),
        attendees: Array.isArray(b.attendees) ? b.attendees : [{ email: owner_email }],
        timeZone: tz,
      });
    } catch (e: any) {
      console.error("[calendar] createEvent failed:", e?.message || e);
    }

    res.json({ ok: true, id, date, start_minute, end_minute, owner_email, vehicle_id, status: "scheduled" });
  } catch (err: any) {
    console.error("[scheduler] error:", err?.message || err);
    res.status(500).json({ error: "internal_error" });
  }
});

export default router;