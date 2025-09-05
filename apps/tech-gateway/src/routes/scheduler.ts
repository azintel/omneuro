// apps/tech-gateway/src/routes/scheduler.ts
import { Router, type Request, type Response } from "express";
import { nid, createAppointment } from "../lib/db.js";
import { appendAppointmentRow } from "../lib/sheets.js";
import { createCalendarEvent } from "../lib/calendar.js";

const router = Router();

router.get("/health", (_req: Request, res: Response) => res.json({ ok: true, service: "scheduler" }));

router.post("/appointments", async (req: Request, res: Response) => {
  const { date, start_minute, end_minute, owner_email, vehicle_id } = req.body || {};

  const start = Number(start_minute);
  const end = Number(end_minute);
  const veh = (vehicle_id == null || vehicle_id === "") ? null : Number(vehicle_id);

  if (!date || Number.isNaN(start) || Number.isNaN(end) || !owner_email) {
    return res.status(400).json({ error: "date, start_minute, end_minute, owner_email required" });
  }

  const id = nid();
  const record = createAppointment({
    id,
    date: String(date),
    start_minute: start,
    end_minute: end,
    owner_email: String(owner_email).toLowerCase(),
    vehicle_id: veh,
    status: "scheduled",
  });

  // Dual-write: Sheets
  try {
    await appendAppointmentRow({
      id,
      date: record.date,
      start_minute: record.start_minute,
      end_minute: record.end_minute,
      owner_email: record.owner_email,
      vehicle_id: record.vehicle_id ?? null,
    });
  } catch (e: any) {
    console.error("[sheets] append appointment error:", e?.message || String(e));
  }

  // Dual-write: Calendar (best effort)
  try {
    const h = (m: number) => String(Math.floor(m / 60)).padStart(2, "0");
    const mm = (m: number) => String(m % 60).padStart(2, "0");
    const startISO = `${record.date}T${h(record.start_minute)}:${mm(record.start_minute)}:00`;
    const endISO = `${record.date}T${h(record.end_minute)}:${mm(record.end_minute)}:00`;

    await createCalendarEvent({
      summary: `Service appointment (${record.owner_email})`,
      startISO,
      endISO,
      attendees: [{ email: record.owner_email }],
    });
  } catch (e: any) {
    console.error("[calendar] create event error:", e?.message || String(e));
  }

  res.json({ ok: true, ...record });
});

export default router;