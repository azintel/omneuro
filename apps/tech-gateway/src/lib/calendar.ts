// apps/tech-gateway/src/lib/calendar.ts
import { calendar_v3 } from "@googleapis/calendar";
import { GoogleAuth } from "google-auth-library";
import { getParam } from "./ssm.js";

const SA_PARAM = process.env.OMNEURO_GOOGLE_SA_PARAM || "/omneuro/google/sa_json";
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || "";
const SCHED_TZ = process.env.SCHED_TZ || "America/New_York";

async function getCalendarClient(): Promise<calendar_v3.Calendar | null> {
  if (!CALENDAR_ID) {
    console.warn("[calendar] GOOGLE_CALENDAR_ID not set; skipping");
    return null;
  }

  let creds: any;
  try {
    const raw = await getParam(SA_PARAM, true);
    creds = JSON.parse(raw);
  } catch (e: any) {
    console.error("[calendar] failed to read SA JSON from SSM:", e?.message || String(e));
    return null;
  }

  const auth = new GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/calendar.events"],
  });

  const client = await auth.getClient();
  return new calendar_v3.Calendar({ auth: client as any });
}

export type CalendarEventInput = {
  summary: string;
  description?: string;
  startISO: string;
  endISO: string;
  attendees?: Array<{ email: string; displayName?: string }>;
};

export async function createCalendarEvent(input: CalendarEventInput): Promise<{
  ok: boolean;
  id?: string;
  htmlLink?: string;
  error?: string;
}> {
  const cal = await getCalendarClient();
  if (!cal || !CALENDAR_ID) return { ok: true };

  const attendees = (input.attendees || []).map(a => ({
    email: a.email,
    displayName: a.displayName,
  })) as calendar_v3.Schema$EventAttendee[];

  try {
    // normalize description to null (many schemas prefer null over undefined)
    const request = cal.events.insert({
      calendarId: CALENDAR_ID,
      requestBody: {
        summary: input.summary,
        description: input.description ?? null,
        start: { dateTime: input.startISO, timeZone: SCHED_TZ },
        end: { dateTime: input.endISO, timeZone: SCHED_TZ },
        attendees,
      },
    }) as unknown as Promise<{ data: calendar_v3.Schema$Event }>;

    const resp = await request;
    const ev = resp.data;

    // Build a result without undefined keys (exactOptionalPropertyTypes safe)
    const out: { ok: boolean; id?: string; htmlLink?: string } = { ok: true };
    if (ev.id) out.id = ev.id;
    if (ev.htmlLink) out.htmlLink = ev.htmlLink;

    console.log("[calendar] created", out);
    return out;
  } catch (e: any) {
    console.error("[calendar] create event error:", e?.message || String(e));
    return { ok: false, error: e?.message || String(e) };
  }
}