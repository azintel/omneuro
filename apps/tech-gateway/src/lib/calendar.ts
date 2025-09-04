// apps/tech-gateway/src/lib/calendar.ts
// Google Calendar helper using the SCOPED package @googleapis/calendar.

import { calendar, calendar_v3 } from "@googleapis/calendar";
import { GoogleAuth, OAuth2Client } from "google-auth-library";
import { getParam } from "../lib/ssm.js";

const SA_PARAM   = process.env.OMNEURO_GOOGLE_SA_PARAM || "/omneuro/google/sa_json";
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || "";
const SCHED_TZ    = process.env.SCHED_TZ || "America/New_York";

async function getCalendar(): Promise<calendar_v3.Calendar> {
  const saJson = await getParam(SA_PARAM, true);
  if (!saJson) throw new Error("[calendar] empty SA JSON from SSM");
  const creds = JSON.parse(saJson);

  // Get a concrete client; then pass that client (not the GoogleAuth wrapper).
  const auth = new GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
  const client = (await auth.getClient()) as OAuth2Client | any;

  // Some type versions are picky; cast to any to satisfy the overload.
  return calendar({ version: "v3", auth: client as any });
}

export async function createEvent(opts: {
  summary: string;
  description?: string;
  startISO: string;
  endISO: string;
  attendees?: { email: string; displayName?: string }[];
  timeZone?: string;
}) {
  if (!CALENDAR_ID) {
    console.warn("[calendar] GOOGLE_CALENDAR_ID not set; skipping calendar write");
    return null;
  }

  const cal = await getCalendar();
  const tz = opts.timeZone || SCHED_TZ;

  const attendees: calendar_v3.Schema$EventAttendee[] = (opts.attendees || []).map(a => ({
    email: a.email,
    displayName: a.displayName ?? null, // some d.ts expect string | null
  }));

  const resp = await cal.events.insert({
    calendarId: CALENDAR_ID,
    requestBody: {
      summary: opts.summary,
      description: opts.description || "",
      start: { dateTime: opts.startISO, timeZone: tz },
      end:   { dateTime: opts.endISO,   timeZone: tz },
      attendees,
    },
  });

  return resp.data;
}