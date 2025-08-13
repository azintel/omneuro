import express from 'express';
import { google } from 'googleapis';
import { getOAuthClient } from './googleAuth.js';

const router = express.Router();

router.get('/ping', (req, res) => {
  res.json({ ok: true, feature: 'google-docs' });
});

router.post('/create', async (req, res) => {
  try {
    const { title, content, parentId } = req.body;
    const auth = getOAuthClient();
    const docs = google.docs({ version: 'v1', auth });
    const drive = google.drive({ version: 'v3', auth });

    // 1. Create empty doc
    const createRes = await drive.files.create({
      requestBody: {
        name: title,
        mimeType: 'application/vnd.google-apps.document',
        parents: parentId ? [parentId] : undefined
      },
      fields: 'id'
    });

    const docId = createRes.data.id;

    // 2. Insert text
    await docs.documents.batchUpdate({
      documentId: docId,
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

    res.json({ ok: true, id: docId, url: `https://docs.google.com/document/d/${docId}/edit` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;