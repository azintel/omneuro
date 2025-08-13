import express from 'express';
import { google } from 'googleapis';

const router = express.Router();

// Google Drive/Docs auth
async function getDocs() {
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/documents'
    ]
  });
  const client = await auth.getClient();
  return {
    docs: google.docs({ version: 'v1', auth: client }),
    drive: google.drive({ version: 'v3', auth: client })
  };
}

// Simple ping
router.get('/ping', (req, res) => {
  res.json({ ok: true, feature: 'google-docs' });
});

// Create new doc in shared folder
router.post('/create', async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title || !content) {
      return res.status(400).json({ ok: false, error: 'Missing title or content' });
    }

    const { docs, drive } = await getDocs();

    // Create doc in the shared folder
    const fileMeta = {
      name: title,
      mimeType: 'application/vnd.google-apps.document',
      parents: ['14qb3_QNjg_AunkRjYG9Wk9qmiaS1QC1g'] // <-- shared folder ID
    };

    const driveRes = await drive.files.create({
      resource: fileMeta,
      fields: 'id'
    });

    const documentId = driveRes.data.id;

    // Write content to doc
    await docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [
          {
            insertText: {
              location: { index: 1 },
              text: content
            }
          }
        ]
      }
    });

    res.json({ ok: true, documentId, link: `https://docs.google.com/document/d/${documentId}/edit` });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;