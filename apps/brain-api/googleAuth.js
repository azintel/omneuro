import { google } from 'googleapis';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve ./tokens.json next to this file by default
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TOKEN_PATH = process.env.GOOGLE_TOKENS_PATH || path.join(__dirname, 'tokens.json');

// REQUIRED env for OAuth (we’re using the OAuth tokens flow, not service accounts)
const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const REDIRECT_URI =
  process.env.GOOGLE_OAUTH_REDIRECT || 'http://localhost:8081/v1/google/oauth2/callback';

function requireEnv(name, val) {
  if (!val) {
    throw new Error(`Missing required env ${name}`);
  }
}

export async function getAuth() {
  requireEnv('GOOGLE_OAUTH_CLIENT_ID', CLIENT_ID);
  requireEnv('GOOGLE_OAUTH_CLIENT_SECRET', CLIENT_SECRET);

  const oauth2 = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

  // Load refresh/access tokens
  const raw = await fs.readFile(TOKEN_PATH, 'utf8');
  const tokens = JSON.parse(raw);
  oauth2.setCredentials(tokens);
  return oauth2;
}