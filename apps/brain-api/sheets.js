import express from 'express';
import { google } from 'googleapis';
import { getAuth } from './googleAuth.js';

const router = express.Router();

// GET /v1/google/sheets/ping
router.get('/ping', (req, res) => {
  res.json({ ok: true, feature: 'google-sheets' });
});

// POST /v1/google/sheets/create
// body: { title: string, tabs?: [ { title: string, headers?: string[] } ] }
router.post('/create', async (req, res) => {
  try {
    const { title, tabs = [] } = req.body || {};
    if (!title) return res.status(400).json({ ok: false, error: 'title is required' });

    const auth = await getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // Create the spreadsheet (use first tab title if present)
    const initialSheet = tabs[0]?.title ? { properties: { title: tabs[0].title } } : undefined;

    const createResp = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title },
        sheets: initialSheet ? [initialSheet] : undefined,
      },
      fields: 'spreadsheetId',
    });

    const spreadsheetId = createResp.data.spreadsheetId;

    // Add additional tabs if provided
    if (tabs.length > 1) {
      const requests = tabs.slice(1).map(t => ({
        addSheet: { properties: { title: t.title } },
      }));

      if (requests.length) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: { requests },
        });
      }
    }

    // Write headers for each tab (if provided)
    for (const t of tabs) {
      if (t.headers && t.headers.length) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${t.title}!A1`,
          valueInputOption: 'RAW',
          requestBody: { values: [t.headers] },
        });
      }
    }

    res.json({ ok: true, spreadsheetId });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /v1/google/sheets/append
// body: { spreadsheetId: string, range: string (e.g. "Products!A2"), rows: any[][] }
router.post('/append', async (req, res) => {
  try {
    const { spreadsheetId, range, rows } = req.body || {};
    if (!spreadsheetId) return res.status(400).json({ ok: false, error: 'spreadsheetId is required' });
    if (!range) return res.status(400).json({ ok: false, error: 'range is required' });
    if (!Array.isArray(rows)) return res.status(400).json({ ok: false, error: 'rows must be an array of arrays' });

    const auth = await getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const resp = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: rows },
    });

    res.json({ ok: true, update: resp.data.updates || null });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;