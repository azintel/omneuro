// apps/brain-api/googleAuth.js
import { google } from 'googleapis';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Where to read tokens from (can be overridden by env)
const TOKEN_PATH = process.env.GOOGLE_TOKENS_PATH || path.join(__dirname, 'tokens.json');

// Required OAuth env vars
const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const REDIRECT_URI =
  process.env.GOOGLE_OAUTH_REDIRECT || 'http://localhost:8081/v1/google/oauth2/callback';

function need(name, val) {
  if (!val) throw new Error(`Missing required env ${name}`);
}

// Export 1: OAuth client with tokens loaded (use in Docs/Sheets/Drive handlers)
export async function getAuth() {
  need('GOOGLE_OAUTH_CLIENT_ID', CLIENT_ID);
  need('GOOGLE_OAUTH_CLIENT_SECRET', CLIENT_SECRET);

  const oauth2 = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

  const raw = await fs.readFile(TOKEN_PATH, 'utf8');
  const tokens = JSON.parse(raw);
  oauth2.setCredentials(tokens);

  return oauth2;
}

// Export 2: Bare OAuth client (use if you ever need to run an auth flow)
export function getOAuthClient() {
  need('GOOGLE_OAUTH_CLIENT_ID', CLIENT_ID);
  need('GOOGLE_OAUTH_CLIENT_SECRET', CLIENT_SECRET);
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}