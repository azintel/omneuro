import express from 'express';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

// Resolve __dirname since we’re using ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to OAuth token file (created during the OAuth process)
const TOKEN_PATH = path.join(__dirname, 'tokens.json');

// Helper to get an authenticated OAuth2 client from saved tokens
async function getOAuthClient() {
  if (!process.env.GOOGLE_OAUTH_CLIENT_ID || !process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
    throw new Error('OAuth CLIENT_ID / CLIENT_SECRET not set in environment variables.');
  }
  if (!fs.existsSync(TOKEN_PATH)) {
    throw new Error(`OAuth token file not found at ${TOKEN_PATH}. Run the OAuth flow first.`);
  }

  const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));

  const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT
  );
  oAuth2Client.setCredentials(tokens);
  return oAuth2Client;
}

// Test route
router.get('/ping', (req, res) => {
  res.json({ ok: true, feature: 'google-docs', auth: 'oauth-user' });
});

// Create a new Google Doc in the user's Drive
router.post('/create', async (req, res) => {
  try {
    const { title, content, parentId } = req.body;
    if (!title || !content) {
      return res.status(400).json({ ok: false, error: 'Missing title or content' });
    }

    const auth = await getOAuthClient();
    const docs = google.docs({ version: 'v1', auth });
    const drive = google.drive({ version: 'v3', auth });

    // Step 1: Create empty doc
    const createRes = await drive.files.create({
      requestBody: {
        name: title,
        mimeType: 'application/vnd.google-apps.document',
        ...(parentId ? { parents: [parentId] } : {})
      },
      fields: 'id'
    });

    const docId = createRes.data.id;

    // Step 2: Insert content
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

    res.json({ ok: true, docId, url: `https://docs.google.com/document/d/${docId}/edit` });
  } catch (err) {
    console.error('Error creating doc:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;