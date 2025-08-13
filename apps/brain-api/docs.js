import express from 'express';
import { google } from 'googleapis';

const router = express.Router();

// Auth helper (uses your service account json from env)
function getAuth() {
  return new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS, // e.g. /home/ubuntu/omneuro/apps/brain-api/creds.json
    scopes: [
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/drive.file'
    ],
  });
}

// Sanity
router.get('/ping', (req, res) => {
  res.json({ ok: true, feature: 'google-docs' });
});

// Create a Google Doc with simple body text
router.post('/create', async (req, res) => {
  try {
    const { title = 'Untitled', content = '' } = req.body || {};

    const auth = await getAuth().getClient();
    const docs = google.docs({ version: 'v1', auth });

    // 1) Create doc
    const { data: created } = await docs.documents.create({
      requestBody: { title },
    });
    const docId = created.documentId;

    // 2) Insert text
    if (content && content.length > 0) {
      await docs.documents.batchUpdate({
        documentId: docId,
        requestBody: {
          requests: [
            {
              insertText: {
                location: { index: 1 }, // start of document
                text: content,
              },
            },
          ],
        },
      });
    }

    res.json({
      ok: true,
      docId,
      webLink: `https://docs.google.com/document/d/${docId}/edit`,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;