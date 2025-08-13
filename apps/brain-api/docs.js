import express from 'express';
import { google } from 'googleapis';

const router = express.Router();

function getAuth() {
  // Prefer explicit keyFile via GOOGLE_APPLICATION_CREDENTIALS
  // Falls back to ADC if not set
  return new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS || undefined,
    scopes: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/documents'
    ],
  });
}

function docsClient(auth) {
  return google.docs({ version: 'v1', auth });
}

function driveClient(auth) {
  return google.drive({ version: 'v3', auth });
}

router.get('/ping', (req, res) => {
  res.json({ ok: true, feature: 'google-docs' });
});

/**
 * POST /v1/google/docs/create
 * {
 *   "title": "JJ Test Doc",
 *   "content": "Hello from Juice Junkiez!",
 *   "parentFolderId": "optional_folder_id"   // <-- Share this folder with the service account first
 * }
 */
router.post('/create', async (req, res) => {
  const { title, content, parentFolderId } = req.body || {};
  const humanEmail = 'juicejunkiezmd@gmail.com';

  if (!title) {
    return res.status(400).json({ ok: false, error: 'Missing "title"' });
  }

  try {
    const auth = getAuth();
    const docs = docsClient(auth);
    const drive = driveClient(auth);

    // 1) Create the empty doc (Docs API)
    const createResp = await docs.documents.create({
      requestBody: { title },
    });
    const documentId = createResp.data.documentId;

    // 2) If caller provided a parent folder, move the file there (Drive API)
    // Moving is done via updating parents; first we need current parents.
    if (parentFolderId) {
      const fileMeta = await drive.files.get({
        fileId: documentId,
        fields: 'parents',
        supportsAllDrives: true,
      });

      const previousParents = (fileMeta.data.parents || []).join(',');
      await drive.files.update({
        fileId: documentId,
        addParents: parentFolderId,
        removeParents: previousParents,
        supportsAllDrives: true,
        fields: 'id, parents',
      });
    }

    // 3) Write content into the doc (Docs API)
    if (content && content.length > 0) {
      await docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests: [
            {
              insertText: {
                location: { index: 1 },
                text: content,
              },
            },
          ],
        },
      });
    }

    // 4) Make sure your human account can see/edit it (Drive permissions)
    await drive.permissions.create({
      fileId: documentId,
      supportsAllDrives: true,
      requestBody: {
        type: 'user',
        role: 'writer',
        emailAddress: humanEmail,
      },
      sendNotificationEmail: false,
    });

    const link = `https://docs.google.com/document/d/${documentId}/edit`;
    return res.json({ ok: true, documentId, link });
  } catch (err) {
    // Better error surfacing
    const status = err?.response?.status || 500;
    const gmsg = err?.response?.data?.error?.message;
    console.error('Docs create error:', gmsg || err?.message, err?.response?.data || '');
    return res.status(status).json({
      ok: false,
      error: gmsg || err?.message || 'Unknown error',
    });
  }
});

export default router;