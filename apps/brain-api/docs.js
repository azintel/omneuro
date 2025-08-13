import express from 'express';
import { google } from 'googleapis';
import fs from 'fs';

const router = express.Router();

// Path to service account credentials
const KEYFILE_PATH = '/home/ubuntu/omneuro/apps/brain-api/creds.json';

// Helper: Get authenticated Google Docs API client
async function getDocsClient() {
  if (!fs.existsSync(KEYFILE_PATH)) {
    throw new Error(`Credentials file not found at ${KEYFILE_PATH}`);
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: KEYFILE_PATH,
    scopes: ['https://www.googleapis.com/auth/documents'],
  });

  const client = await auth.getClient();
  return google.docs({ version: 'v1', auth: client });
}

// Ping endpoint
router.get('/ping', (req, res) => {
  res.json({ ok: true, feature: 'google-docs' });
});

// Create a new Google Doc
router.post('/create', async (req, res) => {
  try {
    const { title, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({ ok: false, error: 'Missing title or content' });
    }

    const docs = await getDocsClient();

    // Step 1: Create the doc
    const createRes = await docs.documents.create({
      requestBody: { title },
    });

    const documentId = createRes.data.documentId;

    // Step 2: Insert text into the doc
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

    res.json({ ok: true, documentId, url: `https://docs.google.com/document/d/${documentId}/edit` });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;