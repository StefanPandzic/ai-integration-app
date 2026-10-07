/**
 * Integration Settings (Slack, Drive, report schedule)
 *
 * Connector modes and delivery targets read from the environment. Only the
 * mock Drive connector exists; Slack live mode reuses the Phase 2 client.
 */

export type ConnectorMode = 'mock' | 'live';

export const getSlackMode = (): ConnectorMode =>
  process.env.SLACK_MODE === 'live' ? 'live' : 'mock';

export const getDriveMode = (): ConnectorMode =>
  process.env.DRIVE_MODE === 'live' ? 'live' : 'mock';

export const getManagerChannel = (): string =>
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
