/**
 * Integration Settings (Slack, Drive, schedules, rate limits)
 *
 * Connector modes and delivery targets read from the environment. Slack live
 * mode reuses the Phase 2 client; Drive live mode is in services/drive.
 */

import type { RateLimit } from '../services/rateLimit';

export type ConnectorMode = 'mock' | 'live';

/** chat.postMessage allows about 1 message per second per channel */
export const SLACK_RATE_LIMIT: RateLimit = { perSecond: 1, burst: 1 };

export const getSlackMode = (): ConnectorMode =>
  process.env.SLACK_MODE === 'live' ? 'live' : 'mock';

export const getDriveMode = (): ConnectorMode =>
  process.env.DRIVE_MODE === 'live' ? 'live' : 'mock';

/**
 * Folder that holds Calls/ and Weekly reports/: a folder in a Shared Drive
 * (service account) or the one `npm run drive:setup` creates (OAuth)
 */
export const getDriveRootFolderId = (): string | null =>
  process.env.DRIVE_ROOT_FOLDER_ID || null;

/** Slack channel of seeded clients and clients added from the review queue */
export const getDefaultClientChannel = (): string =>
  process.env.SLACK_DEMO_CHANNEL_ID || 'C0DEMOCHANNEL';

export const getManagerChannel =(): string =>
  process.env.SLACK_MANAGER_CHANNEL_ID || '#coaching-managers';

export const getOpsChannel = (): string =>
  process.env.SLACK_OPS_CHANNEL_ID || '#coaching-ops';

/** Base URL of the dashboard, for links in Slack messages and Drive docs */
export const getDashboardUrl = (): string =>
  (
    process.env.DASHBOARD_URL ||
    process.env.CORS_ORIGIN ||
    'http://localhost:5173'
  ).replace(/\/$/, '');

export const REPORTS_TIMEZONE = 'America/Chicago';

export const getReportsCron = (): string =>
  process.env.REPORTS_CRON || '0 7 * * 1';

export const isReportsCronEnabled = (): boolean =>
  process.env.REPORTS_CRON_ENABLED !== 'false';

/** Nightly reconcile against Grain (default 2:00, America/Chicago) */
export const getReconcileCron = (): string =>
  process.env.RECONCILE_CRON || '0 2 * * *';

export const isReconcileCronEnabled = (): boolean =>
  process.env.RECONCILE_CRON_ENABLED !== 'false';

/** How far back a reconcile looks; overlaps runs so a missed night is covered */
export const getReconcileLookbackHours = (): number =>
  Number(process.env.RECONCILE_LOOKBACK_HOURS) || 48;
