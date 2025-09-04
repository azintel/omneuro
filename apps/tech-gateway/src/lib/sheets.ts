// apps/tech-gateway/src/lib/sheets.ts
//
// Google Sheets helpers for Garage + Scheduler.
// - Service Account JSON is loaded from SSM (/omneuro/google/sa_json)
// - Fallback general sheet: SHEETS_SPREADSHEET_ID
// - Scheduler sheet: SCHED_SPREADSHEET_ID
// - Auto-creates tabs with headers if missing.

import { GoogleAuth } from "google-auth-library";
import { sheets_v4 } from "@googleapis/sheets";
import { getParam } from "./ssm.js";

const TAB_APPOINTMENTS = "Appointments";
const TAB_VEHICLES = "Vehicles";

// Env
const SCHED_SPREADSHEET_ID = process.env.SCHED_SPREADSHEET_ID || "";
const GENERAL_SHEETS_ID = process.env.SHEETS_SPREADSHEET_ID || "";

// Build a Sheets client with SA creds from SSM
async function getClient(): Promise<sheets_v4.Sheets | null> {
  try {
    const saParam = process.env.OMNEURO_GOOGLE_SA_PARAM || "/omneuro/google/sa_json";
    const saJson = await getParam(saParam, true);
    if (!saJson) {
      console.error("[sheets] SSM returned empty SA json");
      return null;
    }
    const credentials = JSON.parse(saJson);
    const auth = new GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    return new sheets_v4.Sheets({ auth });
  } catch (err: any) {
    console.error("[sheets] client error:", err?.message || String(err));
    return null;
  }
}

// Ensure tab exists and has headers
async function ensureTab(
  s: sheets_v4.Sheets,
  spreadsheetId: string,
  title: string,
  headers: string[],
) {
  try {
    const meta = await s.spreadsheets.get({ spreadsheetId });
    const has = (meta.data.sheets || []).some(sh => sh.properties?.title === title);
    if (!has) {
      await s.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ addSheet: { properties: { title } } }] },
      });
      await s.spreadsheets.values.update({
        spreadsheetId,
        range: `${title}!A1:${String.fromCharCode(64 + headers.length)}1`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [headers] },
      });
    }
  } catch (e: any) {
    console.error(`[sheets] ensureTab(${title}) error:`, e?.message || String(e));
  }
}

/** Append one appointment row into the scheduler sheet */
export async function appendAppointmentRow(row: {
  id: number;
  date: string;             // YYYY-MM-DD
  start_minute: number;     // minutes since midnight
  end_minute: number;       // minutes since midnight
  owner_email: string;
  vehicle_id: number;
  status: string;           // "scheduled" | ...
  created_at?: string;      // ISO
}) {
  const spreadsheetId = SCHED_SPREADSHEET_ID || GENERAL_SHEETS_ID;
  if (!spreadsheetId) {
    console.warn("[sheets] no spreadsheet id configured for appointments");
    return;
  }
  const s = await getClient();
  if (!s) return;

  await ensureTab(s, spreadsheetId, TAB_APPOINTMENTS, [
    "id",
    "date",
    "start_minute",
    "end_minute",
    "owner_email",
    "vehicle_id",
    "status",
    "created_at",
  ]);

  const values = [[
    row.id,
    row.date,
    row.start_minute,
    row.end_minute,
    row.owner_email,
    row.vehicle_id,
    row.status,
    row.created_at || new Date().toISOString(),
  ]];

  // Use just the tab name when appending
  const range = TAB_APPOINTMENTS;

  try {
    const res = await s.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values },
    });
    const upd = res.data.updates;
    console.log("[sheets] appointments append ok", {
      updatedRange: upd?.updatedRange,
      updatedRows: upd?.updatedRows,
      updatedCells: upd?.updatedCells,
    });
  } catch (e: any) {
    console.error("[sheets] append appointment error:", e?.message || String(e));
  }
}

/** Append one vehicle row into the general sheet (used by /api/garage/vehicles) */
export async function appendVehicleRow(row: {
  id?: number;
  owner_email: string;
  make: string;
  model: string;
  nickname?: string | null;
  notes?: string | null;
  created_at?: string; // ISO or sqlite DATETIME
}) {
  const spreadsheetId = GENERAL_SHEETS_ID || SCHED_SPREADSHEET_ID;
  if (!spreadsheetId) {
    console.warn("[sheets] no spreadsheet id configured for vehicles");
    return;
  }
  const s = await getClient();
  if (!s) return;

  await ensureTab(s, spreadsheetId, TAB_VEHICLES, [
    "id",
    "owner_email",
    "make",
    "model",
    "nickname",
    "notes",
    "created_at",
  ]);

  const values = [[
    row.id ?? "",
    row.owner_email,
    row.make,
    row.model,
    row.nickname ?? "",
    row.notes ?? "",
    row.created_at || new Date().toISOString(),
  ]];

  // Use just the tab name when appending
  const range = TAB_VEHICLES;

  try {
    const res = await s.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values },
    });
    const upd = res.data.updates;
    console.log("[sheets] vehicles append ok", {
      updatedRange: upd?.updatedRange,
      updatedRows: upd?.updatedRows,
      updatedCells: upd?.updatedCells,
    });
  } catch (e: any) {
    console.error("[sheets] append vehicle error:", e?.message || String(e));
  }
}