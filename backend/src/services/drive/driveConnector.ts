/**
 * Google Drive Connector
 *
 * DRIVE_MODE=mock|live selects the implementation behind saveDocument():
 * - mock (default): writes the HTML to integration_outbox, returns a fake
 *   file ID and a URL to the dashboard's outbox view of the document
 * - live: converts the HTML to a Google Doc under DRIVE_ROOT_FOLDER_ID,
 *   creating the folder path as needed (setup in docs/INTEGRATIONS.md)
 *
 * `key` makes saves idempotent: saving the same key again returns the
 * stored document instead of creating a second one. In live mode the key is
 * stored on the Drive file (appProperties) and saving it again replaces that
 * document's content, so a regenerated report keeps its link.
 */

import crypto from 'crypto';
import {
  ConnectorMode,
  getDashboardUrl,
  getDriveMode,
  getDriveRootFolderId,
} from '../../config/integrations';
import { recordOutbound } from '../../db/outboxRepo';
import { createLogger } from '../../lib/logger';
import { NonRetryableError } from '../queue/errors';
import { createDriveApi, documentUrl } from './driveApi';
import { createDriveAuth } from './driveAuth';

const log = createLogger('drive');

export interface SavedDocument {
  fileId: string;
  url: string;
}

export interface DriveConnector {
  mode: ConnectorMode;
  saveDocument: (
    folderPath: string,
    title: string,
    html: string,
    key: string,
  ) => Promise<SavedDocument>;
}

const createMockConnector = (): DriveConnector => ({
  mode: 'mock',
  saveDocument: async (folderPath, title, html, key) => {
    const item = await recordOutbound({
      service: 'drive',
      target: folderPath,
      title,
      payload: { html },
      externalId: `mock-drive-${crypto.randomUUID()}`,
      idempotencyKey: `drive:${key}`,
    });
    log.info(`📁 [Drive mock] ${folderPath}/${title}`);
    return {
      fileId: item.external_id,
      url: `${getDashboardUrl()}/outbox?tab=drive&item=${item.id}`,
    };
  },
});

/** Live mode without credentials or a root folder: every save dead-letters */
const createMisconfiguredConnector = (problem: string): DriveConnector => ({
  mode: 'live',
  saveDocument: async () => {
    throw new NonRetryableError(`DRIVE_MODE=live needs ${problem}; run npm run drive:setup`);
  },
});

const createLiveConnector = (): DriveConnector => {
  const auth = createDriveAuth();
  const rootFolderId = getDriveRootFolderId();
  if (!auth) {
    return createMisconfiguredConnector(
      'GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_OAUTH_CLIENT_ID/_SECRET/_REFRESH_TOKEN',
    );
  }
  if (!rootFolderId) return createMisconfiguredConnector('DRIVE_ROOT_FOLDER_ID');
  const api = createDriveApi(auth);

  /** Folder path → folder ID; sharing the promise dedupes concurrent jobs */
  const folders = new Map<string, Promise<string>>();

  const resolveFolder = (path: string): Promise<string> => {
    const parts = path.split('/').filter(Boolean);
    if (parts.length === 0) return Promise.resolve(rootFolderId);
    const key = parts.join('/');
    let folderId = folders.get(key);
    if (!folderId) {
      const name = parts[parts.length - 1];
      folderId = resolveFolder(parts.slice(0, -1).join('/')).then(
        async (parentId) =>
          (await api.findFolder(name, parentId))?.id ??
          (await api.createFolder(name, parentId)).id,
      );
      folderId.catch(() => folders.delete(key));
      folders.set(key, folderId);
    }
    return folderId;
  };

  return {
    mode: 'live',
    saveDocument: async (folderPath, title, html, key) => {
      const existing = await api.findDocumentByKey(key);
      const file = existing
        ? await api.updateDocument(existing.id, title, html)
        : await api.createDocument(await resolveFolder(folderPath), title, html, key);
      log.info(`📁 [Drive] ${existing ? 'updated' : 'created'} ${folderPath}/${title}`, {
        fileId: file.id,
      });
      return { fileId: file.id, url: documentUrl(file) };
    },
  };
};

let connector: DriveConnector | null = null;

export const getDriveConnector = (): DriveConnector => {
  connector ??=
    getDriveMode() === 'live' ? createLiveConnector() : createMockConnector();
  return connector;
};
