import express from 'express';
import { google } from 'googleapis';
import { getAuth } from './googleAuth.js';

const router = express.Router();

// Ping route
router.get('/ping', (req, res) => {
  res.json({ ok: true, feature: 'google-sheets' });
});

// Append rows to a sheet
router.post('/append', async (req, res) => {
  try {
    const { spreadsheetId, range, rows } = req.body;
    if (!spreadsheetId || !range || !rows) {
      return res.status(400).json({ ok: false, error: 'spreadsheetId, range, and rows are required' });
    }

    const auth = await getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: rows }
    });

    res.json({ ok: true, updatedRange: response.data.updates.updatedRange });
  } catch (err) {
    console.error('Sheets append error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;