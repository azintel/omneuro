// apps/tech-gateway/src/lib/sheets.ts
// Dual-write helpers for Vehicles and Appointments using @googleapis/sheets.

import { sheets_v4 } from "@googleapis/sheets";
import { GoogleAuth } from "google-auth-library";
import { getParam } from "../lib/ssm.js";

const VEHICLE_SHEET_ID = process.env.SHEETS_SPREADSHEET_ID || "";
const SCHED_SHEET_ID   = process.env.SCHED_SPREADSHEET_ID || "";
const SA_PARAM         = process.env.OMNEURO_GOOGLE_SA_PARAM || "/omneuro/google/sa_json";

async function getSheets(): Promise<sheets_v4.Sheets | null> {
  const saJson = await getParam(SA_PARAM, true);
  if (!saJson) return null;
  const creds = JSON.parse(saJson);

  const auth = new GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return new sheets_v4.Sheets({ auth });
}

export async function appendVehicleRow(v: {
  id?: number; // <-- make optional to match your Vehicle shape at call sites
  owner_email: string;
  make: string;
  model: string;
  nickname?: string;
  notes?: string;
  created_at?: string;
}) {
  if (!VEHICLE_SHEET_ID) return;
  const c = await getSheets(); if (!c) return;

  const values = [[
    v.id ?? "",                 // write blank if undefined
    v.owner_email,
    v.make,
    v.model,
    v.nickname || "",
    v.notes || "",
    v.created_at || new Date().toISOString(),
  ]];

  await c.spreadsheets.values.append({
    spreadsheetId: VEHICLE_SHEET_ID,
    range: "Vehicles!A:G",
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}

export async function appendAppointmentRow(a: {
  id: number;
  date: string;
  start_minute: number;
  end_minute: number;
  owner_email: string;
  vehicle_id: number;
  status: string;
}) {
  if (!SCHED_SHEET_ID) return;
  const c = await getSheets(); if (!c) return;

  const values = [[
    a.id,
    a.date,
    a.start_minute,
    a.end_minute,
    a.owner_email,
    a.vehicle_id,
    a.status,
    new Date().toISOString(),
  ]];

  await c.spreadsheets.values.append({
    spreadsheetId: SCHED_SHEET_ID,
    range: "Appointments!A:H",
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}