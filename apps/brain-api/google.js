import express from 'express';
import { google } from 'googleapis';
import fs from 'fs';

const router = express.Router();

// --- simple health ---
router.get('/ping', (_req, res) => {
  res.json({ ok: true, feature: 'google-core' });
});

// --- OAuth helper ---
function getOAuth2Client() {
  const {
    GOOGLE_OAUTH_CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_SECRET,
    GOOGLE_OAUTH_REDIRECT,
  } = process.env;

  if (!GOOGLE_OAUTH_CLIENT_ID || !GOOGLE_OAUTH_CLIENT_SECRET || !GOOGLE_OAUTH_REDIRECT) {
    throw new Error(
      'Missing GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_OAUTH_REDIRECT env vars'
    );
  }

  return new google.auth.OAuth2(
    GOOGLE_OAUTH_CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_SECRET,
    GOOGLE_OAUTH_REDIRECT
  );
}

// Scopes you actually need (adjust later as you add features)
const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/documents',
];

// --- OAuth start: redirects user to Google consent screen ---
router.get('/oauth2/start', (req, res) => {
  try {
    const oauth2 = getOAuth2Client();
    const url = oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: SCOPES,
    });
    res.redirect(url);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- OAuth callback: exchanges ?code=... for tokens ---
router.get('/oauth2/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.status(400).send('Missing ?code');
    }
    const oauth2 = getOAuth2Client();
    const { tokens } = await oauth2.getToken(code);
    oauth2.setCredentials(tokens);

    // Optional: persist tokens for later local testing (NOT for prod)
    const tokenPath = '/tmp/google_oauth_tokens.json';
    fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));

    res.send(`
      <html>
        <body>
          <h3>Google connected ✅</h3>
          <p>Tokens saved to <code>${tokenPath}</code> (local testing only).</p>
          <p>You can close this window.</p>
        </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send(`OAuth error: ${err.message}`);
  }
});
// --- DEBUG: who/what are we authenticated as, and what is Drive storage? ---
router.get('/debug/quota', async (req, res) => {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    const client = await auth.getClient();
    const drive = google.drive({ version: 'v3', auth: client });

    const { data } = await drive.about.get({
      fields: 'user(emailAddress,displayName), storageQuota(limit,usage,usageInDrive,usageInDriveTrash)',
      supportsAllDrives: true,
    });

    res.json({ ok: true, who: data.user, quota: data.storageQuota });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
});

// Try creating the tiniest file in a specific parent (your shared folder), to see who owns it
router.post('/debug/create-empty', async (req, res) => {
  const { parentId } = req.body || {}; // e.g., "14qb3_QNjg_AunkRjYG9Wk9qmiaS1QC1g"
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    const client = await auth.getClient();
    const drive = google.drive({ version: 'v3', auth: client });

    const file = await drive.files.create({
      requestBody: {
        name: 'debug-empty.txt',
        mimeType: 'text/plain',
        parents: parentId ? [parentId] : undefined,
      },
      media: { mimeType: 'text/plain', body: 'x' },
      fields: 'id, name, owners(emailAddress), parents',
      supportsAllDrives: true,
    });

    res.json({ ok: true, file: file.data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
});

export default router;