// apps/brain-api/googleAuth.js
import { google } from 'googleapis';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve tokens.json next to this file unless GOOGLE_TOKENS_PATH is set
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TOKEN_PATH = process.env.GOOGLE_TOKENS_PATH || path.join(__dirname, 'tokens.json');

// OAuth env (required)
const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const REDIRECT_URI =
  process.env.GOOGLE_OAUTH_REDIRECT || 'http://localhost:8081/v1/google/oauth2/callback';

function requireEnv(name, val) {
  if (!val) throw new Error(`Missing required env ${name}`);
}

// Returns an OAuth2 client pre-loaded with access/refresh tokens (used by Docs/Sheets/Drive routes)
export async function getAuth() {
  requireEnv('GOOGLE_OAUTH_CLIENT_ID', CLIENT_ID);
  requireEnv('GOOGLE_OAUTH_CLIENT_SECRET', CLIENT_SECRET);

  const oauth2 = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

  const raw = await fs.readFile(TOKEN_PATH, 'utf8');
  const tokens = JSON.parse(raw);
  oauth2.setCredentials(tokens);

  return oauth2;
}

// Returns a bare OAuth2 client (no tokens) for auth flows (if/when you need it)
export function getOAuthClient() {
  requireEnv('GOOGLE_OAUTH_CLIENT_ID', CLIENT_ID);
  requireEnv('GOOGLE_OAUTH_CLIENT_SECRET', CLIENT_SECRET);
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}