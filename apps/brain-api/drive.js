import express from 'express';
import { google } from 'googleapis';
import { getOAuthClient } from './googleAuth.js';

const router = express.Router();

router.get('/ping', (req, res) => {
  res.json({ ok: true, feature: 'google-drive' });
});

router.get('/files', async (req, res) => {
  try {
    const auth = getOAuthClient();
    const drive = google.drive({ version: 'v3', auth });
    const result = await drive.files.list({
      pageSize: 20,
      fields: 'files(id, name, mimeType, parents)'
    });
    res.json({ ok: true, files: result.data.files });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});
// Upload small text file to a parent folder
router.post('/upload-text', async (req, res) => {
  try {
    const { parentId, name = 'notes.txt', content = '' } = req.body || {};
    if (!parentId) return res.status(400).json({ ok: false, error: 'parentId required' });

    const drive = await getDrive();
    const fileMetadata = { name, parents: [parentId] };
    const media = {
      mimeType: 'text/plain',
      body: Buffer.from(content, 'utf8')
    };

    const { data } = await drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: 'id, name, webViewLink'
    });

    res.json({ ok: true, file: data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;