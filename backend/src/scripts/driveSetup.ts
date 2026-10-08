/**
 * Google Drive setup and check (docs/INTEGRATIONS.md → Google Drive).
 * Usage: npm run drive:setup
 *
 * 1. OAuth only: with GOOGLE_OAUTH_CLIENT_ID/_SECRET set but no refresh
 *    token, opens the Google consent flow on a localhost redirect and prints
 *    GOOGLE_OAUTH_REFRESH_TOKEN
 * 2. Checks the credentials (about.get)
 * 3. Checks DRIVE_ROOT_FOLDER_ID; with OAuth and none set, creates a
 *    "Coaching Call Intelligence" folder in My Drive and prints its ID
 * 4. Creates (or updates) a "Setup check" Google Doc in the root folder
 *
 * Safe to run again: the test document is updated in place.
 */

import dotenv from 'dotenv';
import http from 'http';
import { OAuth2Client } from 'google-auth-library';
import { getDriveRootFolderId } from '../config/integrations';
import { createDriveApi, documentUrl } from '../services/drive/driveApi';
import {
  DRIVE_FILE_SCOPE,
  createDriveAuth,
  getOAuthClientConfig,
} from '../services/drive/driveAuth';

dotenv.config();

const REDIRECT_PORT = 53682;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}`;
const ROOT_FOLDER_NAME = 'Coaching Call Intelligence';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

/** Runs the consent flow once and returns the refresh token */
const obtainRefreshToken = async (clientId: string, clientSecret: string): Promise<string> => {
  const client = new OAuth2Client({ clientId, clientSecret, redirectUri: REDIRECT_URI });
  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [DRIVE_FILE_SCOPE],
  });

  const code = await new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? '/', REDIRECT_URI);
      const value = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      if (!value && !error) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(value ? 'Google Drive connected. You can close this tab.' : `Consent failed: ${error}`);
      server.close();
      if (value) resolve(value);
      else reject(new Error(`Consent failed: ${error}`));
    });
    server.on('error', reject);
    server.listen(REDIRECT_PORT, () => {
      console.log('Open this URL, sign in with the Google account that should own the documents, and allow access:\n');
      console.log(`  ${authUrl}\n`);
      console.log(`Waiting for the redirect to ${REDIRECT_URI} ...`);
    });
  });

  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error(
      'Google returned no refresh token. Remove the app at https://myaccount.google.com/permissions and run again.',
    );
  }
  return tokens.refresh_token;
};

const run = async (): Promise<void> => {
  const newEnv: string[] = [];

  const oauth = getOAuthClientConfig();
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON && oauth && !process.env.GOOGLE_OAUTH_REFRESH_TOKEN) {
    const refreshToken = await obtainRefreshToken(oauth.clientId, oauth.clientSecret);
    process.env.GOOGLE_OAUTH_REFRESH_TOKEN = refreshToken;
    newEnv.push(`GOOGLE_OAUTH_REFRESH_TOKEN=${refreshToken}`);
  }

  const auth = createDriveAuth();
  if (!auth) {
    console.error(
      'No Google credentials. Set GOOGLE_SERVICE_ACCOUNT_JSON (Shared Drive) or ' +
        'GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET (personal account) in backend/.env, ' +
        'then run this again. See docs/INTEGRATIONS.md → Google Drive.',
    );
    process.exit(1);
  }
  const api = createDriveApi(auth);

  console.log(`✅ Credentials work (${auth.kind}): acting as ${await api.getUser()}`);

  let rootFolderId = getDriveRootFolderId();
  if (rootFolderId) {
    const folder = await api.getFile(rootFolderId);
    if (folder.mimeType !== FOLDER_MIME) {
      throw new Error(`DRIVE_ROOT_FOLDER_ID ${rootFolderId} is a ${folder.mimeType}, not a folder`);
    }
    console.log(`✅ Root folder: ${folder.name} (${documentUrl(folder)})`);
  } else if (auth.kind === 'oauth') {
    // drive.file can only see folders the app created, so the app creates the root
    const found = await api.findFolder(ROOT_FOLDER_NAME, 'root');
    const folder = found ?? (await api.createFolder(ROOT_FOLDER_NAME, 'root'));
    rootFolderId = folder.id;
    newEnv.push(`DRIVE_ROOT_FOLDER_ID=${folder.id}`);
    console.log(
      `✅ ${found ? 'Found' : 'Created'} root folder "${ROOT_FOLDER_NAME}" in My Drive (${documentUrl(folder)})`,
    );
  } else {
    console.error(
      'Set DRIVE_ROOT_FOLDER_ID to a folder in a Shared Drive where the service account is a Content manager ' +
        '(the ID is the last part of the folder URL).',
    );
    process.exit(1);
  }

  const html = `<h1>Setup check</h1><p>Written by npm run drive:setup at ${new Date().toISOString()}.</p>`;
  const existing = await api.findDocumentByKey('setup-check');
  const doc = existing
    ? await api.updateDocument(existing.id, 'Setup check', html)
    : await api.createDocument(rootFolderId, 'Setup check', html, 'setup-check');
  console.log(`✅ Test document ${existing ? 'updated' : 'created'}: ${documentUrl(doc)}`);

  console.log('\nAdd to backend/.env and restart the backend:\n');
  for (const line of ['DRIVE_MODE=live', ...newEnv]) console.log(`  ${line}`);
};

run().catch((error: unknown) => {
  console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
