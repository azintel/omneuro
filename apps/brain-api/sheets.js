import express from 'express';
import { google } from 'googleapis';
import { getOAuthClient } from './googleAuth.js';

const router = express.Router();

router.get('/ping', (req, res) => {
  res.json({ ok: true, feature: 'google-sheets' });
});

router.post('/create', async (req, res) => {
  try {
    const { title, tabs = [], parentId } = req.body;
    const auth = getOAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });
    const drive = google.drive({ version: 'v3', auth });

    // Create spreadsheet
    const createRes = await drive.files.create({
      requestBody: {
        name: title,
        mimeType: 'application/vnd.google-apps.spreadsheet',
        parents: parentId ? [parentId] : undefined
      },
      fields: 'id'
    });

    const spreadsheetId = createRes.data.id;

    // Prepare batch update
    let requests = [];
    tabs.forEach((tab, index) => {
      requests.push({
        addSheet: {
          properties: { title: tab.title || `Sheet${index + 1}` }
        }
      });
    });

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests }
    });

    // Write headers and rows if provided
    for (let tab of tabs) {
      if (tab.headers || tab.rows) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${tab.title || 'Sheet1'}!A1`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [tab.headers || [], ...(tab.rows || [])]
          }
        });
      }
    }

    res.json({
      ok: true,
      id: spreadsheetId,
      url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;