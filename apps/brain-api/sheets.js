// apps/brain-api/sheets.js
import express from 'express';
import { google } from 'googleapis';

const router = express.Router();

// ---- config (uses your shared folder) ----
const DEST_FOLDER_ID = '14qb3_QNjg_AunkRjYG9Wk9qmiaS1QC1g';

// Auth helper (uses your service account creds via GOOGLE_APPLICATION_CREDENTIALS)
async function getGoogle() {
  const auth = new google.auth.GoogleAuth({
    scopes: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/spreadsheets'
    ],
  });
  const client = await auth.getClient();
  return {
    drive: google.drive({ version: 'v3', auth: client }),
    sheets: google.sheets({ version: 'v4', auth: client }),
  };
}

// GET /v1/google/sheets/ping
router.get('/ping', (req, res) => {
  res.json({ ok: true, feature: 'google-sheets' });
});

// POST /v1/google/sheets/create
// Body: { title: "My Sheet", tabs: [{ title: "Sheet1", headers: ["A","B"], rows: [ ["r1a","r1b"], ["r2a","r2b"] ] }] }
router.post('/create', async (req, res) => {
  try {
    const title = (req.body?.title || 'New Sheet').toString();
    const tabs = Array.isArray(req.body?.tabs) ? req.body.tabs : [
      { title: 'Sheet1', headers: ['Col A', 'Col B'], rows: [['A1', 'B1']] }
    ];

    const { drive, sheets } = await getGoogle();

    // 1) Create empty spreadsheet
    const { data: created } = await sheets.spreadsheets.create({
      requestBody: { properties: { title } }
    });
    const spreadsheetId = created.spreadsheetId;

    // 2) Move into your shared folder (so you can see it)
    await drive.files.update({
      fileId: spreadsheetId,
      addParents: DEST_FOLDER_ID,
      removeParents: 'root',
      fields: 'id, parents'
    });

    // 3) Prepare batchUpdate to add tabs (or rename default) + values
    const requests = [];
    const valueUpdates = [];

    // By default a spreadsheet has one "Sheet1". We'll rename/use it for the first tab.
    let first = true;
    for (const t of tabs) {
      const tabTitle = (t.title || 'Sheet').toString();
      const headers = Array.isArray(t.headers) ? t.headers : [];
      const rows = Array.isArray(t.rows) ? t.rows : [];

      if (first) {
        // rename default Sheet1
        requests.push({
          updateSheetProperties: {
            properties: { sheetId: 0, title: tabTitle },
            fields: 'title'
          }
        });
        first = false;
      } else {
        requests.push({
          addSheet: { properties: { title: tabTitle } }
        });
      }

      // values (headers at row 1, rows after)
      const values = headers.length ? [headers, ...rows] : rows;
      if (values.length) {
        valueUpdates.push({
          range: `${tabTitle}!A1`,
          majorDimension: 'ROWS',
          values
        });
      }
    }

    if (requests.length) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests }
      });
    }

    if (valueUpdates.length) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: 'RAW',
          data: valueUpdates
        }
      });
    }

    res.json({ ok: true, spreadsheetId, link: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit` });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;