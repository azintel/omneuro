// apps/brain-api/docs.js
import express from 'express';
import { google } from 'googleapis';

const router = express.Router();

// Auth with both Drive and Docs scopes
async function getAuth() {
  const auth = new google.auth.GoogleAuth({
    scopes: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/documents',
    ],
  });
  return auth.getClient();
}

router.get('/ping', (_req, res) => {
  res.json({ ok: true, feature: 'google-docs' });
});

// POST /api/v1/google/docs/create
// Body: { title: string, content?: string, folderId?: string }
router.post('/create', async (req, res) => {
  try {
    const { title, content = '', folderId } = req.body || {};
    if (!title || typeof title !== 'string') {
      return res.status(400).json({ ok: false, error: 'title (string) is required' });
    }

    const client = await getAuth();
    const docs = google.docs({ version: 'v1', auth: client });
    const drive = google.drive({ version: 'v3', auth: client });

    // 1) Create empty Google Doc with a title
    const { data: created } = await docs.documents.create({
      requestBody: { title },
    });

    const docId = created.documentId;

    // 2) If content provided, insert it
    if (content && content.length > 0) {
      await docs.documents.batchUpdate({
        documentId: docId,
        requestBody: {
          requests: [
            {
              insertText: {
                // New docs have one empty paragraph, index 1 is safe
                location: { index: 1 },
                text: content,
              },
            },
          ],
        },
      });
    }

    // 3) If a folderId was provided, move the doc into that folder
    if (folderId && typeof folderId === 'string') {
      // First fetch current parents so we can remove them
      const { data: fileMeta } = await drive.files.get({
        fileId: docId,
        fields: 'parents',
      });

      await drive.files.update({
        fileId: docId,
        addParents: folderId,
        removeParents: (fileMeta.parents || []).join(','),
        fields: 'id, parents',
      });
    }

    const url = `https://docs.google.com/document/d/${docId}/edit`;
    return res.json({ ok: true, docId, url });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;