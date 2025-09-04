// apps/tech-gateway/src/lib/calendar.ts
//
// Google Calendar helper using monorepo package '@googleapis/calendar'.
// Env:
//   GOOGLE_CALENDAR_ID=... (required)
//   SCHED_TZ=America/New_York (default)

import { calendar_v3 } from "@googleapis/calendar";
import { fromServiceAccountJSON } from "./sheets.js";

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || "";
const SCHED_TZ = process.env.SCHED_TZ || "America/New_York";

export async function createCalendarEvent(opts: {
  summary: string;
  description?: string;
  startLocal: string; // 'YYYY-MM-DDTHH:MM' (no tz)
  endLocal: string;   // 'YYYY-MM-DDTHH:MM' (no tz)
  attendees?: { email: string; displayName?: string }[];
}) {
  if (!CALENDAR_ID) throw new Error("GOOGLE_CALENDAR_ID not configured");

  const auth = await fromServiceAccountJSON(["https://www.googleapis.com/auth/calendar"]);
  const calendar = new calendar_v3.Calendar({ auth });

  const { data } = await calendar.events.insert({
    calendarId: CALENDAR_ID,
    requestBody: {
      summary: opts.summary,
      description: opts.description,
      start: { dateTime: opts.startLocal, timeZone: SCHED_TZ },
      end:   { dateTime: opts.endLocal,   timeZone: SCHED_TZ },
      attendees: opts.attendees,
    },
  });
  return data; // includes id
}