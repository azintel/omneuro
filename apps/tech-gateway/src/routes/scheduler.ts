// apps/tech-gateway/src/routes/scheduler.ts
import { Router } from "express";
import db from "../db.js";
import { customAlphabet } from "nanoid";
import { appendAppointmentRow } from "../lib/sheets.js";
import { createCalendarEvent } from "../lib/calendar.js";

const router = Router();
const nid = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 12);

const SCHED_TZ = process.env.SCHED_TZ || "America/New_York";

function pad2(n: number) { return n < 10 ? `0${n}` : String(n); }
function toHHMM(minute: number) { return `${pad2(Math.floor(minute/60))}:${pad2(minute%60)}`; }
function localISO(date_ymd: string, minute: number) { return `${date_ymd}T${toHHMM(minute)}`; }
function ymd(d: Date) { return d.toISOString().slice(0,10); }

// ----- techs
router.post("/techs", (req, res) => {
  const { name, email, phone } = req.body || {};
  if (!name) return res.status(400).json({ error: "name required" });
  const id = nid();
  db.prepare(`INSERT INTO techs (id,name,email,phone) VALUES (?,?,?,?)`).run(id, name, email ?? null, phone ?? null);
  res.json({ ok:true, tech:{ id, name, email, phone }});
});

router.post("/techs/:id/availability", (req,res)=>{
  const tech_id = req.params.id;
  const { day_of_week, start_minute, end_minute, capacity = 1 } = req.body || {};
  if (![0,1,2,3,4,5,6].includes(Number(day_of_week))) return res.status(400).json({ error: "day_of_week 0-6" });
  if (!(Number.isInteger(start_minute) && Number.isInteger(end_minute) && start_minute < end_minute)) {
    return res.status(400).json({ error: "invalid minute range" });
  }
  const id = nid();
  db.prepare(`
    INSERT INTO tech_availability (id,tech_id,day_of_week,start_minute,end_minute,capacity)
    VALUES (?,?,?,?,?,?)
  `).run(id, tech_id, day_of_week, start_minute, end_minute, capacity);
  res.json({ ok:true, availability:{ id, tech_id, day_of_week, start_minute, end_minute, capacity }});
});

// ----- slots
router.get("/slots", (req, res) => {
  const { start, end } = req.query as { start?: string, end?: string };
  if (!start || !end) return res.status(400).json({ error: "start and end (YYYY-MM-DD) required" });

  const avails = db.prepare(`
    SELECT ta.*, t.name as tech_name
    FROM tech_availability ta
    JOIN techs t ON t.id=ta.tech_id
    WHERE t.is_active=1
  `).all() as any[];

  const blackout = db.prepare(`SELECT date_ymd FROM blackout_days`).all().map((r:any)=>r.date_ymd);
  const appts = db.prepare(`
    SELECT date_ymd, start_minute, end_minute, tech_id
    FROM appointments
    WHERE date_ymd BETWEEN ? AND ? AND status IN ('pending','confirmed')
  `).all(start, end) as any[];

  const out: any[] = [];
  const dayMs = 86400000;
  const startDate = new Date(start + "T00:00:00");
  const endDate = new Date(end + "T00:00:00");

  for (let d = startDate; d <= endDate; d = new Date(d.getTime()+dayMs)) {
    const day = ymd(d);
    if (blackout.includes(day)) continue;
    const dow = d.getDay();

    const todays = avails.filter(a => a.day_of_week === dow);
    for (const a of todays) {
      for (let m=a.start_minute; m < a.end_minute; m+=30) {
        const slotStart = m, slotEnd = m+30;
        const used = appts.filter(p =>
          p.date_ymd === day && p.tech_id === a.tech_id && !(p.end_minute<=slotStart || p.start_minute>=slotEnd)
        ).length;
        if (used < a.capacity) {
          out.push({
            date_ymd: day,
            start_minute: slotStart,
            end_minute: slotEnd,
            start_hhmm: toHHMM(slotStart),
            end_hhmm: toHHMM(slotEnd),
            tech_id: a.tech_id,
            tech_name: a.tech_name,
            capacity: a.capacity,
            used
          });
        }
      }
    }
  }

  res.json({ ok:true, items: out });
});

// ----- create appointment
router.post("/appointments", async (req,res)=>{
  try {
    const { owner_email, tech_id, date_ymd, start_minute, end_minute, notes } = req.body || {};
    if (!owner_email || !date_ymd || !Number.isInteger(start_minute) || !Number.isInteger(end_minute)) {
      return res.status(400).json({ error: "owner_email, date_ymd, start_minute, end_minute required" });
    }

    const avail = db.prepare(`
      SELECT ta.capacity, t.name as tech_name
      FROM tech_availability ta
      JOIN techs t ON t.id = ta.tech_id
      WHERE ta.tech_id = ? AND ta.day_of_week = CAST (strftime('%w', ?) AS INTEGER)
        AND ta.start_minute <= ? AND ta.end_minute >= ?
      LIMIT 1
    `).get(tech_id, date_ymd, start_minute, end_minute) as { capacity:number, tech_name?:string } | undefined;
    if (!avail) return res.status(409).json({ error: "tech not available at that time" });

    const used = db.prepare(`
      SELECT COUNT(*) AS c FROM appointments
      WHERE tech_id = ? AND date_ymd = ? AND status IN ('pending','confirmed')
        AND NOT (end_minute <= ? OR start_minute >= ?)
    `).get(tech_id, date_ymd, start_minute, end_minute).c as number;
    if (used >= (avail.capacity ?? 1)) return res.status(409).json({ error: "slot already filled" });

    const id = nid();
    db.prepare(`
      INSERT INTO appointments (id, owner_email, tech_id, date_ymd, start_minute, end_minute, status, notes)
      VALUES (?,?,?,?,?,?, 'pending', ?)
    `).run(id, owner_email, tech_id ?? null, date_ymd, start_minute, end_minute, notes ?? null);

    // event log
    db.prepare(`INSERT INTO events (id,ts,actor,type,json) VALUES (?,?,?,?,?)`)
      .run(nid(), Date.now(), `client:${owner_email}`, "appointment.created",
           JSON.stringify({ id, owner_email, tech_id, date_ymd, start_minute, end_minute }));

    // dual-write best effort
    let gcalId: string | undefined;
    const startLocal = localISO(date_ymd, start_minute);
    const endLocal   = localISO(date_ymd, end_minute);

    try {
      const ev = await createCalendarEvent({
        summary: `Service: ${owner_email}${avail?.tech_name ? ` • ${avail.tech_name}` : ""}`,
        description: notes || undefined,
        startLocal, endLocal,
        attendees: [{ email: owner_email }],
      });
      gcalId = (ev as any)?.id;
      if (gcalId) db.prepare(`UPDATE appointments SET gcal_event_id=? WHERE id=?`).run(gcalId, id);
    } catch (e:any) {
      console.error("[scheduler] calendar write failed:", e?.message || String(e));
    }

    try {
      await appendAppointmentRow({
        id,
        owner_email,
        tech_id: tech_id ?? null,
        tech_name: avail?.tech_name ?? null,
        date_ymd,
        start_hhmm: toHHMM(start_minute),
        end_hhmm: toHHMM(end_minute),
        status: "pending",
        created_at_iso: new Date().toISOString(),
        notes: notes ?? null,
      });
    } catch (e:any) {
      console.error("[scheduler] sheets write failed:", e?.message || String(e));
    }

    res.json({ ok:true, appointment:{ id, owner_email, tech_id, date_ymd, start_minute, end_minute, status:"pending", gcal_event_id:gcalId }});
  } catch (e:any) {
    console.error("[scheduler] create failed:", e?.message || String(e));
    res.status(500).json({ error: "internal_error" });
  }
});

export default router;