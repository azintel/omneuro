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

// GET /v1/google/ping — list items in "Juice Junkiez - Admin"
router.get('/ping', async (req, res) => {
  try {
    const drive = await getDrive();

    // Find Admin folder by exact name
    const find = await drive.files.list({
      q: "name = 'Juice Junkiez - Admin' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: 'files(id,name)',
      pageSize: 1,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    if (!find.data.files?.length) {
      return res.status(404).json({ ok: false, error: 'admin_folder_not_found' });
    }
    const admin = find.data.files[0];

    // List children
    const list = await drive.files.list({
      q: `'${admin.id}' in parents and trashed = false`,
      fields: 'files(id,name,mimeType,modifiedTime,size)',
      orderBy: 'folder,name',
      pageSize: 50,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    res.json({
      ok: true,
      folder: { id: admin.id, name: admin.name },
      items: (list.data.files || []).map(f => ({
        id: f.id, name: f.name, mimeType: f.mimeType,
        modifiedTime: f.modifiedTime, size: f.size || null,
      })),
    });
  } catch (err) {
    console.error('google_ping_error', err?.stack || err);
    res.status(500).json({ ok: false, error: 'google_ping_error' });
  }
});

export default router;