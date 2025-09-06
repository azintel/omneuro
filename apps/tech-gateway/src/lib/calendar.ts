// apps/tech-gateway/src/lib/calendar.ts
//
// Google Calendar helper (JWT / service account) — no Schema$* refs
// Optional fields are only included when defined (to satisfy exactOptionalPropertyTypes)

import { google } from "googleapis";
import { JWT } from "google-auth-library";
import type { JWTOptions } from "google-auth-library";
import { getParam } from "./ssm.js";

// ---------- minimal shapes we control ----------
export type GEventAttendee = { email: string; displayName?: string };
export type CalendarEventInput = {
  summary: string;
  description?: string;
  startISO: string; // e.g. 2025-09-06T16:00:00-04:00
  endISO: string;   // e.g. 2025-09-06T16:30:00-04:00
  attendees?: GEventAttendee[];
  location?: string;
  sendUpdates?: "all" | "externalOnly" | "none";
};

// ---------- internal helpers ----------
const SCOPES = ["https://www.googleapis.com/auth/calendar"];
const DEFAULT_TZ = process.env.SCHED_TZ || "America/New_York";
const SA_PARAM = process.env.OMNEURO_GOOGLE_SA_PARAM || "/omneuro/google/sa_json";

async function getSaJson(): Promise<JWTOptions> {
  const raw = await getParam(SA_PARAM, true);
  const sa = JSON.parse(raw);
  // IMPORTANT: don't include `subject` unless you actually have one.
  const opts: JWTOptions = {
    email: sa.client_email,
    key: sa.private_key,
    scopes: SCOPES,
  };
  return opts;
}

export async function getJwtAuth(): Promise<JWT> {
  return new JWT(await getSaJson());
}

export function getCalendarId(): string {
  const id = process.env.GOOGLE_CALENDAR_ID || "";
  if (!id) throw new Error("GOOGLE_CALENDAR_ID not set");
  return id;
}

// ---------- main API ----------
export async function createEvent(
  input: CalendarEventInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const auth = await getJwtAuth();
    const calendar = google.calendar({ version: "v3", auth });
    const calendarId = getCalendarId();

    // Build request body with conditional spreads so optional props
    // are present only when defined (avoids string|undefined issues).
    const body = {
      summary: input.summary,
      start: { dateTime: input.startISO, timeZone: DEFAULT_TZ },
      end: { dateTime: input.endISO, timeZone: DEFAULT_TZ },
      ...(input.description ? { description: input.description } : {}),
      ...(input.attendees && input.attendees.length
        ? { attendees: input.attendees }
        : {}),
      ...(input.location ? { location: input.location } : {}),
    };

    const sendUpdates = input.sendUpdates ?? "none";

    const res = await calendar.events.insert({
      calendarId,
      requestBody: body,
      sendUpdates,
    });

    const id = res.data.id;
    if (!id) throw new Error("insert returned no event id");
    return { ok: true, id };
  } catch (e: any) {
    const msg = e?.message || String(e);
    console.warn("[calendar] create event warning:", msg);
    return { ok: false, error: msg };
  }
}

// Health probe (auth + calendar existence)
export async function health(): Promise<boolean> {
  try {
    const auth = await getJwtAuth();
    const calendar = google.calendar({ version: "v3", auth });
    const calendarId = getCalendarId();
    await calendar.calendars.get({ calendarId });
    return true;
  } catch (e) {
    console.warn("[calendar] health check failed:", e);
    return false;
  }
}

export default { createEvent, health, getJwtAuth };