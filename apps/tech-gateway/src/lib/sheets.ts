// apps/tech-gateway/src/lib/sheets.ts
//
// Minimal Google Sheets writer for garage events.
// - Builds a client from Service Account JSON stored in SSM SecureString
// - Appends a single vehicle row
//
// ENV:
//   SHEETS_SPREADSHEET_ID        -> target spreadsheet
//   OMNEURO_GOOGLE_SA_PARAM      -> SSM name for SA JSON (default: /omneuro/google/sa_json)
//
// NodeNext note: relative imports require .js suffix.

import { GoogleAuth } from "google-auth-library";
import { sheets_v4 } from "@googleapis/sheets";
import { getParam } from "./ssm.js";

const SPREADSHEET_ID = process.env.SHEETS_SPREADSHEET_ID || "";
const SA_PARAM = process.env.OMNEURO_GOOGLE_SA_PARAM || "/omneuro/google/sa_json";

// Lazily construct an authenticated Sheets client
async function getClient(): Promise<sheets_v4.Sheets | null> {
  if (!SPREADSHEET_ID) {
    // Spreadsheet not configured; treat as no-op
    return null;
  }
  try {
    const saJson = await getParam(SA_PARAM, true);
    if (!saJson) {
      console.error("[sheets] SSM returned empty Service Account json");
      return null;
    }
    const creds = JSON.parse(saJson);
    const auth = new GoogleAuth({
      credentials: creds,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    return new sheets_v4.Sheets({ auth });
  } catch (e: any) {
    const msg = e?.message || String(e);
    console.error("[sheets] client unavailable:", msg);
    return null;
  }
}

/** Append a single vehicle row to the sheet (no-op if not configured). */
export async function appendRow(vehicle: {
  owner_email: string;
  make: string;
  model: string;
  nickname?: string | null;
  notes?: string | null;
}) {
  const client = await getClient();
  if (!client) return null;

  // Adjust range/sheet tab name to match your doc
  const range = "Vehicles!A:Z";

  const values = [[
    new Date().toISOString(),
    vehicle.owner_email,
    vehicle.make,
    vehicle.model,
    vehicle.nickname ?? "",
    vehicle.notes ?? "",
  ]];

  try {
    const res = await client.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });
    console.log("[sheets] append ok", {
      range: res.data.updates?.updatedRange,
      cells: res.data.updates?.updatedCells,
    });
    return res.data;
  } catch (e: any) {
    const msg = e?.message || String(e);
    console.error("[sheets] append error:", msg);
    return { error: msg };
  }
}