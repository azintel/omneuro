import express from 'express';
import { google } from 'googleapis';

const router = express.Router();

async function getDrive() {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  const client = await auth.getClient();
  return google.drive({ version: 'v3', auth: client });
}

// GET /api/v1/google/drive/files
router.get('/drive/files', async (req, res) => {
  try {
    const drive = await getDrive();
    const { data } = await drive.files.list({ pageSize: 10, fields: 'files(id,name,mimeType,owners(emailAddress))' });
    res.json({ ok: true, files: data.files || [] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;