// apps/tech-gateway/src/routes/scheduler.ts
//
// POST /api/scheduler/appointments
//  - Validates input
//  - Appends to Google Sheets (Appointments tab)
//  - Creates Google Calendar event (emails attendees)
//  - Returns created payload

import { Router, type Request, type Response } from "express";
import { appendAppointmentRow } from "../lib/sheets.js";
import calendar from "../lib/calendar.js";

const router = Router();

function pad(n: number) {
  return n < 10 ? `0${n}` : String(n);
}
function timeStrFromMinutes(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${pad(h)}:${pad(m)}:00`;
}
function randomId(): string {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
}

// Health (already used by redeploy script)
router.get("/health", (_req, res) =>
  res.json({ ok: true, service: "scheduler" })
);

// Create appointment
router.post("/appointments", async (req: Request, res: Response) => {
  try {
    const { date, start_minute, end_minute, owner_email, vehicle_id } = req.body || {};

    // Basic validation
    const bad =
      typeof date !== "string" ||
      typeof start_minute !== "number" ||
      typeof end_minute !== "number" ||
      typeof owner_email !== "string" ||
      typeof vehicle_id !== "number";
    if (bad) {
      return res.status(400).json({ error: "invalid_input" });
    }

    const id = randomId();
    const status = "scheduled";

    // Build ISO times (we pass timeZone to Calendar; ISO can be naive)
    const startISO = `${date}T${timeStrFromMinutes(start_minute)}`;
    const endISO = `${date}T${timeStrFromMinutes(end_minute)}`;

    // --- Sheets append (best-effort) ---
    try {
      await appendAppointmentRow({
        id,
        date,
        start_minute,
        end_minute,
        owner_email,
        vehicle_id,
        status,
      });
    } catch (e) {
      console.error("[scheduler] sheets append error:", (e as Error).message);
    }

    // --- Calendar create (best-effort) ---
    try {
      const summary = `Service appointment (#${id})`;
      const description = `Owner: ${owner_email}\nVehicle ID: ${vehicle_id}\nStart: ${start_minute} min\nEnd: ${end_minute} min`;
      const attendees = [
        { email: owner_email },
        { email: "juicejunkiezmd@gmail.com", displayName: "JuiceJunkiez" },
      ];
      const cal = await calendar.createEvent({
        summary,
        description,
        startISO,
        endISO,
        attendees,
        location: "", // optional
      });
      if (!cal.ok) {
        console.warn("[scheduler] calendar create warning:", cal.error);
      }
    } catch (e) {
      console.error("[scheduler] calendar create error:", (e as Error).message);
    }

    // Respond
    res.json({
      ok: true,
      id,
      date,
      start_minute,
      end_minute,
      owner_email,
      vehicle_id,
      status,
    });
  } catch (err) {
    console.error("[scheduler] /appointments error:", (err as Error).message);
    res.status(500).json({ error: "internal_error" });
  }
});

export default router;