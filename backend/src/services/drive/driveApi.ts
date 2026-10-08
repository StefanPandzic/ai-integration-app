/**
 * Google Drive REST API (v3) over fetch
 *
 * Only the calls the connector and `npm run drive:setup` need. HTML uploads
 * are converted to Google Docs. Every call passes supportsAllDrives so the
 * same code works in My Drive and in Shared Drives.
 *
 * Failures map to the queue's error types:
 * - 429, 403 rateLimitExceeded/userRateLimitExceeded → RetryLaterError
 * - 5xx, 401 and network errors → plain Error (backoff and retry)
 * - other 4xx (missing folder, no permission, storageQuotaExceeded) →
 *   NonRetryableError, which dead-letters the job and alerts ops
 */

import crypto from 'crypto';
import { NonRetryableError, RetryLaterError } from '../queue/errors';
import { DriveAuth } from './driveAuth';

const API_URL = 'https://www.googleapis.com/drive/v3';
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const DOC_MIME = 'application/vnd.google-apps.document';
const FILE_FIELDS = 'id,name,mimeType,webViewLink';
const DEFAULT_RETRY_MS = 30_000;

/** appProperties key that ties a Drive file to a call or report */
const APP_KEY = 'key';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
}

interface DriveErrorBody {
  error?: { message?: string; errors?: { reason?: string }[] };
}

/** Quotes a value for a Drive search query */
const quote = (value: string): string =>
  `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

const toError = async (response: Response, what: string): Promise<Error> => {
  const body = (await response.json().catch(() => null)) as DriveErrorBody | null;
  const reason = body?.error?.errors?.[0]?.reason ?? '';
  const detail = body?.error?.message ?? response.statusText;
  const message = `Drive ${what} failed: ${response.status} ${reason ? `${reason}: ` : ''}${detail}`;

  if (
    response.status === 429 ||
    reason === 'rateLimitExceeded' ||
    reason === 'userRateLimitExceeded'
  ) {
    const retryAfter = Number(response.headers.get('retry-after'));
    return new RetryLaterError(message, retryAfter > 0 ? retryAfter * 1000 : DEFAULT_RETRY_MS);
  }
  // 401 with a freshly minted token is a clock or propagation hiccup;
  // revoked credentials already fail in driveAuth with NonRetryableError
  if (response.status >= 500 || response.status === 401) return new Error(message);
  if (reason === 'storageQuotaExceeded') {
    return new NonRetryableError(
      `${message} (a service account has no storage: DRIVE_ROOT_FOLDER_ID must be in a Shared Drive)`,
    );
  }
  return new NonRetryableError(message);
};

const multipartBody = (
  metadata: Record<string, unknown>,
  html: string,
): { body: string; contentType: string } => {
  const boundary = `drive-${crypto.randomUUID()}`;
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    '',
    html,
    `--${boundary}--`,
    '',
  ].join('\r\n');
  return { body, contentType: `multipart/related; boundary=${boundary}` };
};

export const createDriveApi = (auth: DriveAuth) => {
  const request = async <T>(
    what: string,
    method: string,
    url: string,
    params: Record<string, string>,
    init: { body?: string; contentType?: string } = {},
  ): Promise<T> => {
    const search = new URLSearchParams({ supportsAllDrives: 'true', ...params });
    const response = await fetch(`${url}?${search}`, {
      method,
      headers: {
        Authorization: `Bearer ${await auth.getAccessToken()}`,
        ...(init.contentType && { 'Content-Type': init.contentType }),
      },
      body: init.body,
    });
    if (!response.ok) throw await toError(response, what);
    return (await response.json()) as T;
  };

  const findFirst = async (what: string, q: string): Promise<DriveFile | null> => {
    const { files } = await request<{ files: DriveFile[] }>(what, 'GET', `${API_URL}/files`, {
      q: `${q} and trashed=false`,
      fields: `files(${FILE_FIELDS})`,
      pageSize: '1',
      corpora: 'allDrives',
      includeItemsFromAllDrives: 'true',
    });
    return files[0] ?? null;
  };

  return {
    /** Who the credentials act as; a cheap check that they work */
    getUser: async (): Promise<string> =>
      (
        await request<{ user: { emailAddress: string } }>('about', 'GET', `${API_URL}/about`, {
          fields: 'user(emailAddress)',
        })
      ).user.emailAddress,

    getFile: (fileId: string): Promise<DriveFile> =>
      request<DriveFile>('get file', 'GET', `${API_URL}/files/${encodeURIComponent(fileId)}`, {
        fields: FILE_FIELDS,
      }),

    findFolder: (name: string, parentId: string): Promise<DriveFile | null> =>
      findFirst(
        'folder lookup',
        `name=${quote(name)} and ${quote(parentId)} in parents and mimeType='${FOLDER_MIME}'`,
      ),

    createFolder: (name: string, parentId: string): Promise<DriveFile> =>
      request<DriveFile>(
        'create folder',
        'POST',
        `${API_URL}/files`,
        { fields: FILE_FIELDS },
        {
          body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
          contentType: 'application/json',
        },
      ),

    /** The document saved earlier under this key (survives a lost DB write) */
    findDocumentByKey: (key: string): Promise<DriveFile | null> =>
      findFirst(
        'document lookup',
        `appProperties has { key=${quote(APP_KEY)} and value=${quote(key)} }`,
      ),

    createDocument: (folderId: string, title: string, html: string, key: string) =>
      request<DriveFile>(
        'create document',
        'POST',
        `${UPLOAD_URL}/files`,
        { uploadType: 'multipart', fields: FILE_FIELDS },
        multipartBody(
          { name: title, mimeType: DOC_MIME, parents: [folderId], appProperties: { [APP_KEY]: key } },
          html,
        ),
      ),

    /** Replaces the content in place, so links already posted stay valid */
    updateDocument: (fileId: string, title: string, html: string) =>
      request<DriveFile>(
        'update document',
        'PATCH',
        `${UPLOAD_URL}/files/${encodeURIComponent(fileId)}`,
        { uploadType: 'multipart', fields: FILE_FIELDS },
        multipartBody({ name: title }, html),
      ),
  };
};

export type DriveApi = ReturnType<typeof createDriveApi>;

export const documentUrl = (file: DriveFile): string =>
  file.webViewLink ?? `https://docs.google.com/document/d/${file.id}/edit`;
