/**
 * Google Drive Connector
 *
 * DRIVE_MODE=mock|live selects the implementation behind saveDocument():
 * - mock (default): writes the HTML to integration_outbox, returns a fake
 *   file ID and a URL to the dashboard's outbox view of the document
 * - live: not implemented yet (design in docs/INTEGRATIONS.md)
 *
 * `key` makes saves idempotent: saving the same key again returns the
 * stored document instead of creating a second one.
 */

import crypto from 'crypto';
import {
  ConnectorMode,
  getDashboardUrl,
  getDriveMode,
} from '../../config/integrations';
import { recordOutbound } from '../../db/outboxRepo';
import { createLogger } from '../../lib/logger';
import { NonRetryableError } from '../queue/errors';

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

const createLiveConnector = (): DriveConnector => ({
  mode: 'live',
  saveDocument: async () => {
    throw new NonRetryableError(
      'Live Google Drive connector is not implemented yet; set DRIVE_MODE=mock',
    );
  },
});

let connector: DriveConnector | null = null;

export const getDriveConnector = (): DriveConnector => {
  connector ??=
    getDriveMode() === 'live' ? createLiveConnector() : createMockConnector();
  return connector;
};
