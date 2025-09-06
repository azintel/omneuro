// apps/tech-gateway/src/lib/sheets.ts
//
// Google Sheets helper (service account JWT)
//  - Vehicles tab append
//  - Appointments tab append
//
// Env:
//   SHEETS_SPREADSHEET_ID   -> general (Vehicles, etc.)
//   SCHED_SPREADSHEET_ID    -> scheduler-specific (Appointments)

import { google, sheets_v4 } from "googleapis";
import type { JWTOptions } from "google-auth-library";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";

const REGION = process.env.AWS_REGION || "us-east-2";
const SA_PARAM =
  process.env.OMNEURO_GOOGLE_SA_PARAM || "/omneuro/google/sa_json";

const SHEETS_SPREADSHEET_ID = (process.env.SHEETS_SPREADSHEET_ID || "").trim();
const SCHED_SPREADSHEET_ID = (process.env.SCHED_SPREADSHEET_ID || "").trim();

// ---- auth ----
let cachedSA: { client_email: string; private_key: string } | null = null;

async function getServiceAccount(): Promise<{
  client_email: string;
  private_key: string;
}> {
  if (cachedSA) return cachedSA;
  const ssm = new SSMClient({ region: REGION });
  const out = await ssm.send(
    new GetParameterCommand({ Name: SA_PARAM, WithDecryption: true })
  );
  const val = out.Parameter?.Value;
  if (!val) throw new Error("[sheets] missing SA JSON in SSM");
  const parsed = JSON.parse(val);
  cachedSA = { client_email: parsed.client_email, private_key: parsed.private_key };
  return cachedSA;
}

async function getAuth() {
  const sa = await getServiceAccount();
  const opts: JWTOptions = {
    email: sa.client_email,
    key: sa.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  };
  return new google.auth.JWT(opts);
}

async function getClient() {
  const auth = await getAuth();
  return google.sheets({ version: "v4", auth });
}

// ---- types we append ----
export type VehicleRow = {
  owner_email: string;
  make: string;
  model: string;
  nickname?: string;
  notes?: string;
  // you can expand later with year, serial, etc.
};

export type AppointmentRow = {
  id: string;
  date: string;         // "YYYY-MM-DD"
  start_minute: number; // minutes from 00:00
  end_minute: number;
  owner_email: string;
  vehicle_id: number;
  status?: string;      // allow status column
};

// ---- utils ----
const VEHICLES_TAB = "Vehicles";
const APPT_TAB = "Appointments";

// When appending with Sheets API, the *range* should be just the tab name.
// The API figures out the bottom and inserts rows.
export async function appendVehicleRow(row: VehicleRow) {
  if (!SHEETS_SPREADSHEET_ID) {
    console.warn("[sheets] SHEETS_SPREADSHEET_ID not set; skipping vehicles append");
    return;
  }
  const s = await getClient();
  const range = VEHICLES_TAB; // append into tab
  const values = [
    [
      row.owner_email,
      row.make,
      row.model,
      row.nickname ?? "",
      row.notes ?? "",
    ],
  ];
  try {
    const res = await s.spreadsheets.values.append({
      spreadsheetId: SHEETS_SPREADSHEET_ID,
      range,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values },
    });
    const upd = res.data.updates!;
    console.log("[sheets] vehicles append ok", {
      updatedRange: upd.updatedRange,
      updatedRows: upd.updatedRows,
      updatedCells: upd.updatedCells,
    });
  } catch (e: any) {
    console.error("[sheets] vehicles append error:", e?.message || String(e));
  }
}

export async function appendAppointmentRow(row: AppointmentRow) {
  if (!SCHED_SPREADSHEET_ID) {
    console.warn("[sheets] SCHED_SPREADSHEET_ID not set; skipping appointments append");
    return;
  }
  const s = await getClient();
  const range = APPT_TAB;
  const values = [
    [
      row.id,
      row.date,
      row.start_minute,
      row.end_minute,
      row.owner_email,
      row.vehicle_id,
      row.status ?? "",
      "", // reserved/future notes column
    ],
  ];
  try {
    const res = await s.spreadsheets.values.append({
      spreadsheetId: SCHED_SPREADSHEET_ID,
      range,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values },
    });
    const upd = res.data.updates!;
    console.log("[sheets] appointments append ok", {
      updatedRange: upd.updatedRange,
      updatedRows: upd.updatedRows,
      updatedCells: upd.updatedCells,
    });
  } catch (e: any) {
    console.error("[sheets] appointments append error:", e?.message || String(e));
  }
}

export default { appendVehicleRow, appendAppointmentRow };