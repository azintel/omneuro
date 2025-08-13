import express from 'express';
import { google } from 'googleapis';

const router = express.Router();

// All new docs will be shared to this account
const SHARE_WITH_EMAIL = 'juicejunkiezmd@gmail.com';

async function getAuth() {
  return new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes: [
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/drive.file'
    ]
  });
}

router.get('/docs/ping', (req, res) => {
  res.json({ ok: true, feature: 'google-docs' });
});

router.post('/docs/create', async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title || !content) {
      return res.status(400).json({ ok: false, error: 'Missing title or content' });
    }

    const auth = await getAuth();
    const docs = google.docs({ version: 'v1', auth });
    const drive = google.drive({ version: 'v3', auth });

    // Create empty doc
    const createRes = await docs.documents.create({
      requestBody: { title }
    });

    const documentId = createRes.data.documentId;

    // Insert content
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

    // Share the doc with your main Google account
    await drive.permissions.create({
      fileId: documentId,
      requestBody: {
        role: 'writer',
        type: 'user',
        emailAddress: SHARE_WITH_EMAIL
      },
      fields: 'id'
    });

    // Get the web link
    const file = await drive.files.get({
      fileId: documentId,
      fields: 'id, webViewLink'
    });

    res.json({ ok: true, documentId, link: file.data.webViewLink });

  } catch (err) {
    console.error('Docs create error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;