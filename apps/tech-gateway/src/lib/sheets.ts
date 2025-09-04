// apps/tech-gateway/src/lib/sheets.ts
//
// Google Sheets helper:
// - Auth via Service Account JSON from SSM (OMNEURO_GOOGLE_SA_PARAM=/omneuro/google/sa_json)
// - Dual-write helpers for Vehicles + Appointments
//
// Env:
//   AWS_REGION (default us-east-2)
//   OMNEURO_GOOGLE_SA_PARAM=/omneuro/google/sa_json
//   SHEETS_SPREADSHEET_ID=...              (general/fallback sheet)
//   SCHED_SPREADSHEET_ID=...               (preferred scheduler sheet)

import { GoogleAuth } from "google-auth-library";
import { sheets_v4 } from "@googleapis/sheets";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const region = process.env.AWS_REGION || "us-east-2";
const SA_PARAM = process.env.OMNEURO_GOOGLE_SA_PARAM || "/omneuro/google/sa_json";

function getAppointmentsSheetId(): string {
  return process.env.SCHED_SPREADSHEET_ID || process.env.SHEETS_SPREADSHEET_ID || "";
}
function getDefaultSheetId(): string {
  return process.env.SHEETS_SPREADSHEET_ID || "";
}

async function getServiceAccountJSON(): Promise<any> {
  const ssm = new SSMClient({ region });
  const resp = await ssm.send(new GetParameterCommand({
    Name: SA_PARAM,
    WithDecryption: true,
  }));
  const raw = resp.Parameter?.Value;
  if (!raw) {
    throw new Error(`[sheets] SSM ${SA_PARAM} returned empty value`);
  }
  return JSON.parse(raw);
}

export async function fromServiceAccountJSON(scopes: string[]) {
  const sa = await getServiceAccountJSON();
  const auth = new GoogleAuth({
    credentials: { client_email: sa.client_email, private_key: sa.private_key },
    scopes,
  });
  return auth;
}

async function getSheetsClient(): Promise<sheets_v4.Sheets> {
  const auth = await fromServiceAccountJSON(["https://www.googleapis.com/auth/spreadsheets"]);
  return new sheets_v4.Sheets({ auth });
}

/** Append a vehicle row to the default spreadsheet (tab 'Vehicles') */
export async function appendVehicleRow(row: {
  id: number | string;
  owner_email: string;
  make: string;
  model: string;
  nickname?: string | null;
  notes?: string | null;
  created_at?: string | null;
}) {
  const spreadsheetId = getDefaultSheetId();
  if (!spreadsheetId) throw new Error("SHEETS_SPREADSHEET_ID not configured");
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "Vehicles!A:Z",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        String(row.id),
        row.owner_email,
        row.make,
        row.model,
        row.nickname ?? "",
        row.notes ?? "",
        row.created_at ?? new Date().toISOString(),
      ]],
    },
  });
}

/** Append an appointment row to scheduler spreadsheet (tab 'Appointments') */
export async function appendAppointmentRow(row: {
  id: string;
  owner_email: string;
  tech_id?: string | null;
  tech_name?: string | null;
  date_ymd: string;
  start_hhmm: string; // 'HH:MM'
  end_hhmm: string;   // 'HH:MM'
  status: string;
  created_at_iso?: string;
  notes?: string | null;
}) {
  const spreadsheetId = getAppointmentsSheetId() || getDefaultSheetId();
  if (!spreadsheetId) throw new Error("SCHED_SPREADSHEET_ID / SHEETS_SPREADSHEET_ID not configured");
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "Appointments!A:Z",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        row.id,
        row.owner_email,
        row.tech_id ?? "",
        row.tech_name ?? "",
        row.date_ymd,
        row.start_hhmm,
        row.end_hhmm,
        row.status,
        row.created_at_iso ?? new Date().toISOString(),
        row.notes ?? "",
      ]],
    },
  });
}