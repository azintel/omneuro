// apps/tech-gateway/src/lib/sheets.ts
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { google } from "googleapis";

const REGION = process.env.AWS_REGION || "us-east-2";
const SA_PARAM = process.env.OMNEURO_GOOGLE_SA_PARAM || "/omneuro/google/sa_json";
// Prefer environment variable for spreadsheet ID; fallback to SSM if needed
const SPREADSHEET_ID = process.env.SHEETS_SPREADSHEET_ID || process.env.OMNEURO_GOOGLE_SHEET_ID || "";

const ssm = new SSMClient({ region: REGION });

async function getServiceAccountJSON(): Promise<string | null> {
  try {
    const res = await ssm.send(new GetParameterCommand({
      Name: SA_PARAM,
      WithDecryption: true
    }));
    return res.Parameter?.Value || null;
  } catch (err: any) {
    console.error("[sheets] failed to get SA from SSM", SA_PARAM, err.name || err.code, err.message || err);
    return null;
  }
}

async function getSheetsClient() {
  if (!SPREADSHEET_ID) {
    console.warn("[sheets] no SPREADSHEET_ID; skipping sheet writes");
    return null;
  }
  const saJson = await getServiceAccountJSON();
  if (!saJson) {
    console.warn("[sheets] no service account JSON; skipping sheet writes");
    return null;
  }
  let creds: any;
  try {
    creds = JSON.parse(saJson);
  } catch {
    console.error("[sheets] invalid service account JSON");
    return null;
  }

  const jwt = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  await jwt.authorize();
  return google.sheets({ version: "v4", auth: jwt });
}

export async function appendRow(range: string, values: (string | number | null | undefined)[]) {
  const sheets = await getSheetsClient();
  if (!sheets) return;
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [values] },
    });
  } catch (err: any) {
    console.error("[sheets] appendRow error:", err.message || err);
  }
}