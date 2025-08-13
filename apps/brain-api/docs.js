import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import express from 'express';

const router = express.Router();

// ===== CONFIG =====
const tokensPath = path.join('/home/ubuntu/omneuro/apps/brain-api', 'tokens.json');

// These must match your OAuth client
const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_OAUTH_REDIRECT || 'http://localhost:8081/v1/google/oauth2/callback';

// Load OAuth tokens from file
if (!fs.existsSync(tokensPath)) {
  throw new Error(`OAuth tokens file not found at ${tokensPath}`);
}
const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));

// Create OAuth2 client and set credentials
const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
oAuth2Client.setCredentials(tokens);

// ===== ROUTES =====

// Ping
router.get('/ping', (req, res) => {
  res.json({ ok: true, feature: 'google-docs' });
});

// Create a new Google Doc
router.post('/create', async (req, res) => {
  try {
    const { title, content, parentId } = req.body;
    if (!title || !content) {
      return res.status(400).json({ ok: false, error: 'Missing title or content' });
    }

    const drive = google.drive({ version: 'v3', auth: oAuth2Client });

    // Step 1: Create the empty doc
    const fileMetadata = {
      name: title,
      mimeType: 'application/vnd.google-apps.document',
      ...(parentId ? { parents: [parentId] } : {})
    };

    const createRes = await drive.files.create({
      resource: fileMetadata,
      fields: 'id'
    });

    const docId = createRes.data.id;

    // Step 2: Write content into the doc
    const docs = google.docs({ version: 'v1', auth: oAuth2Client });
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

    res.json({ ok: true, documentId: docId });
  } catch (err) {
    console.error('Error creating Google Doc:', err.response?.data || err.message || err);
    res.status(500).json({ ok: false, error: err.message || 'Unknown error' });
  }
});

export default router;