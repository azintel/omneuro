// apps/tech-gateway/src/lib/sheets.ts
//
// Google Sheets helper (dual-write support)
// - Uses Google Service Account JSON stored in AWS SSM SecureString.
// - Exports appendVehicleRow() and appendAppointmentRow().
// - Works with NodeNext/Node16 moduleResolution (no 'google' namespace).
//
import { sheets_v4 } from "@googleapis/sheets";
import { GoogleAuth } from "google-auth-library";
import { getParam } from "./ssm.js";

const SA_PARAM = process.env.OMNEURO_GOOGLE_SA_PARAM || "/omneuro/google/sa_json";

// Fallback/general sheet (e.g., Vehicles tab, etc.)
const SHEETS_SPREADSHEET_ID = process.env.SHEETS_SPREADSHEET_ID || "";

// Scheduler-specific sheet (Appointments tab)
const SCHED_SPREADSHEET_ID = process.env.SCHED_SPREADSHEET_ID || "";

// Tab names
const VEH_TAB = "Vehicles";
const APPT_TAB = "Appointments";

/** Lazily build a Sheets client from SA JSON stored in SSM. */
async function getClient(spreadsheetId: string): Promise<sheets_v4.Sheets | null> {
  if (!spreadsheetId) return null;

  let creds: any;
  try {
    const raw = await getParam(SA_PARAM, true);
    creds = JSON.parse(raw);
  } catch (e: any) {
    console.error("[sheets] SSM read error:", e?.message || String(e));
    return null;
  }

  const auth = new GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return new sheets_v4.Sheets({ auth });
}

// ---------- Vehicles ----------

export async function appendVehicleRow(row: {
  owner_email: string;
  make: string;
  model: string;
  nickname?: string | null;
  notes?: string | null;
}) {
  const s = await getClient(SHEETS_SPREADSHEET_ID);
  if (!s) return;

  const values = [
    [
      row.owner_email,
      row.make,
      row.model,
      row.nickname ?? "",
      row.notes ?? "",
      new Date().toISOString(),
    ],
  ];

  try {
    const res = await (s.spreadsheets.values.append({
      spreadsheetId: SHEETS_SPREADSHEET_ID,
      range: VEH_TAB, // NOTE: use just the tab name when appending
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values },
    }) as unknown as Promise<{ data?: { updates?: any } }>);

    const upd = res.data?.updates || {};
    console.log("[sheets] vehicles append ok", {
      updatedRange: upd.updatedRange,
      updatedRows: upd.updatedRows,
      updatedCells: upd.updatedCells,
    });
  } catch (e: any) {
    console.error("[sheets] append vehicle error:", e?.message || String(e));
  }
}

// ---------- Appointments ----------

export async function appendAppointmentRow(row: {
  id: string;
  date: string;
  start_minute: number;
  end_minute: number;
  owner_email: string;
  vehicle_id?: number | null;
}) {
  const targetId = SCHED_SPREADSHEET_ID || SHEETS_SPREADSHEET_ID;
  const s = await getClient(targetId);
  if (!s) return;

  const values = [
    [
      row.id,
      row.date,
      row.start_minute,
      row.end_minute,
      row.owner_email,
      row.vehicle_id ?? "", // leave blank if nullish
      "scheduled",
      new Date().toISOString(),
    ],
  ];

  try {
    const res = await (s.spreadsheets.values.append({
      spreadsheetId: targetId,
      range: APPT_TAB, // NOTE: use just the tab name when appending
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values },
    }) as unknown as Promise<{ data?: { updates?: any } }>);

    const upd = res.data?.updates || {};
    console.log("[sheets] appointments append ok", {
      updatedRange: upd.updatedRange,
      updatedRows: upd.updatedRows,
      updatedCells: upd.updatedCells,
    });
  } catch (e: any) {
    console.error("[sheets] append appointment error:", e?.message || String(e));
  }
}