// apps/tech-gateway/src/lib/sheets.ts
// Dual-write helper: append rows to Google Sheets using a Service Account JSON from SSM.
// Safe-by-default:
//  - If SSM param or SHEETS_SPREADSHEET_ID are missing, this becomes a no-op with a log line.

import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { google } from "googleapis";

const REGION = process.env.AWS_REGION || "us-east-2";
const SA_PARAM = process.env.OMNEURO_GOOGLE_SA_PARAM || "/omneuro/google/sa_json";
const SPREADSHEET_ID = process.env.SHEETS_SPREADSHEET_ID || ""; // set in ecosystem.config.cjs

const ssm = new SSMClient({ region: REGION });

// Fetch service account JSON from SSM (decrypted)
async function getServiceAccountJSON(): Promise<string | null> {
  try {
    const out = await ssm.send(new GetParameterCommand({
      Name: SA_PARAM,
      WithDecryption: true,
    }));
    return out.Parameter?.Value || null;
  } catch (err: any) {
    console.error("[sheets] SSM get failed:", SA_PARAM, "region=", REGION, "code=", err?.name || err?.code, "msg=", err?.message || err);
    return null;
  }
}

async function getSheetsClient() {
  if (!SPREADSHEET_ID) return null;
  const sa = await getServiceAccountJSON();
  if (!sa) return null;

  let creds: any;
  try { creds = JSON.parse(sa); }
  catch { console.error("[sheets] invalid SA JSON in SSM param", SA_PARAM); return null; }

  const jwt = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  await jwt.authorize();
  const sheets = google.sheets({ version: "v4", auth: jwt });
  return sheets;
}

// Append a row to a named tab (range like "Vehicles!A:Z")
export async function appendRow(range: string, values: (string | number | null | undefined)[]) {
  if (!SPREADSHEET_ID) {
    console.warn("[sheets] SPREADSHEET_ID not set; skipping write.");
    return;
  }
  const sheets = await getSheetsClient();
  if (!sheets) {
    console.warn("[sheets] client unavailable; skipping write.");
    return;
  }
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [values] },
    });
  } catch (err) {
    console.error("[sheets] append failed:", (err as any)?.message || err);
  }
}