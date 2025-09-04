// apps/tech-gateway/src/routes/scheduler.ts
import { Router } from "express";
import type { Request, Response } from "express";
import db from "../lib/db.js";
import { appendAppointmentRow } from "../lib/sheets.js";
import { createEvent as createCalendarEvent } from "../lib/calendar.js";

const router = Router();

router.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, service: "scheduler" });
});

// hh:mm from minutes since midnight
function minToHHMM(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(mm)}`;
}

router.post("/appointments", async (req: Request, res: Response) => {
  try {
    const { date, start_minute, end_minute, owner_email, vehicle_id } = req.body || {};
    if (
      !date ||
      typeof start_minute !== "number" ||
      typeof end_minute !== "number" ||
      !owner_email ||
      typeof vehicle_id !== "number"
    ) {
      return res.status(400).json({ error: "invalid payload" });
    }

    const email = String(owner_email).toLowerCase();

    // DB insert
    const info = db
      .prepare(
        `INSERT INTO appointments (date, start_minute, end_minute, owner_email, vehicle_id, status)
         VALUES (?, ?, ?, ?, ?, 'scheduled')`
      )
      .run(date, start_minute, end_minute, email, vehicle_id);

    const id = Number(info.lastInsertRowid);
    const status = "scheduled" as const;

    // Dual-write: Sheets (best-effort)
    try {
      await appendAppointmentRow({
        id,
        date,
        start_minute,
        end_minute,
        owner_email: email,
        vehicle_id,
        status,
      });
    } catch (e) {
      console.error("[sheets] append appointment error:", (e as Error).message);
    }

    // Dual-write: Google Calendar (best-effort)
    try {
      const startISO = `${date}T${minToHHMM(start_minute)}:00`;
      const endISO = `${date}T${minToHHMM(end_minute)}:00`;

      await createCalendarEvent({
        summary: "Service appointment",
        description: `Owner: ${email}\nVehicle ID: ${vehicle_id}\nAppt ID: ${id}`,
        startISO,
        endISO,
        attendees: [{ email }],
      });
    } catch (e) {
      console.error("[calendar] create event error:", (e as Error).message);
    }

    res.json({ ok: true, id, date, start_minute, end_minute, owner_email: email, vehicle_id, status });
  } catch (err) {
    console.error("[scheduler] /appointments error:", (err as Error).message);
    res.status(500).json({ error: "internal_error" });
  }
});

export default router;