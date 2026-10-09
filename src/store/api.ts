import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

/**
 * Backend API (RTK Query)
 *
 * Empty base: each feature injects its endpoints from
 * `features/<name>/services/<name>Api.ts`. Server data lives in this
 * cache only and is never persisted.
 */

/** Polling for live server state while the live-updates stream is down */
export const LIVE_POLL_MS = 3000;
/** Safety-net polling while the stream is open (events drive refetches) */
export const LIVE_SAFETY_POLL_MS = 60_000;

export const BACKEND_URL: string =
  import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: BACKEND_URL,
  }),
  tagTypes: [
    'Call',
    'Client',
    'Coach',
    'Demo',
    'Report',
    'ReportRun',
    'Outbox',
    'Job',
    'Pipeline',
    'SlackChannel',
  ],
  endpoints: () => ({}),
});

/** Turns an RTK Query error into a message for the UI */
export const getErrorMessage = (error: unknown): string | null => {
  if (!error) return null;
  if (typeof error === 'object' && 'status' in error) {
    const { status, data } = error as { status: unknown; data?: unknown };
    if (data && typeof data === 'object' && 'error' in data) {
      return String((data as { error: unknown }).error);
    }
    return status === 'FETCH_ERROR'
      ? 'Backend unreachable'
      : `Request failed (${String(status)})`;
  }
  return error instanceof Error ? error.message : 'Request failed';
};
