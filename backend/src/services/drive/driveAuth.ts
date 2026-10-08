/**
 * Google Drive Credentials
 *
 * Two setups (docs/INTEGRATIONS.md → Google Drive):
 * - service account: GOOGLE_SERVICE_ACCOUNT_JSON (the key JSON, or a path to
 *   it), added as Content manager to a Shared Drive. Scope `drive`, so it can
 *   write into the Shared Drive folder someone else created
 * - OAuth: GOOGLE_OAUTH_CLIENT_ID / _SECRET / _REFRESH_TOKEN for one Google
 *   account. Scope `drive.file`: the app sees only the files it created
 *
 * google-auth-library only mints and refreshes access tokens; the Drive
 * calls themselves are plain fetch (driveApi.ts).
 */

import fs from 'fs';
import { AuthClient, GoogleAuth, OAuth2Client } from 'google-auth-library';
import { NonRetryableError } from '../queue/errors';

export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';

export type DriveAuthKind = 'service_account' | 'oauth';

export interface DriveAuth {
  kind: DriveAuthKind;
  getAccessToken: () => Promise<string>;
}

export const getOAuthClientConfig = (): { clientId: string; clientSecret: string } | null => {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
};

const readServiceAccountKey = (value: string): Record<string, string> => {
  const json = value.trim().startsWith('{') ? value : fs.readFileSync(value.trim(), 'utf8');
  try {
    return JSON.parse(json) as Record<string, string>;
  } catch {
    throw new NonRetryableError('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON');
  }
};

const tokenGetter =
  (client: AuthClient, kind: DriveAuthKind) => async (): Promise<string> => {
    try {
      const { token } = await client.getAccessToken();
      if (!token) throw new Error('empty access token');
      return token;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // A revoked or expired refresh token / deleted key: only a human can fix it
      if (/invalid_grant|invalid_client|unauthorized_client/.test(message)) {
        throw new NonRetryableError(
          `Google ${kind === 'oauth' ? 'OAuth' : 'service account'} credentials were rejected (${message}); run npm run drive:setup`,
        );
      }
      throw error;
    }
  };

/** Builds the credentials from the environment; null when none are set */
export const createDriveAuth = (): DriveAuth | null => {
  const serviceAccount = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (serviceAccount) {
    const auth = new GoogleAuth({
      credentials: readServiceAccountKey(serviceAccount),
      scopes: [DRIVE_SCOPE],
    });
    let client: Promise<AuthClient> | null = null;
    return {
      kind: 'service_account',
      getAccessToken: async () => {
        client ??= auth.getClient();
        return tokenGetter(await client, 'service_account')();
      },
    };
  }

  const oauth = getOAuthClientConfig();
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  if (oauth && refreshToken) {
    const client = new OAuth2Client(oauth.clientId, oauth.clientSecret);
    client.setCredentials({ refresh_token: refreshToken });
    return { kind: 'oauth', getAccessToken: tokenGetter(client, 'oauth') };
  }

  return null;
};
