import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';

const TOKEN_PATH = path.resolve('./tokens.json');
const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/spreadsheets'
];

// Load tokens.json and create an authorized OAuth2 client
export function getOAuthClient() {
  if (!fs.existsSync(TOKEN_PATH)) {
    throw new Error(`tokens.json not found at ${TOKEN_PATH}`);
  }
  const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));

  const { client_id, client_secret, redirect_uris } = tokens.installed || tokens.web;
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  oAuth2Client.setCredentials(tokens);
  return oAuth2Client;
}