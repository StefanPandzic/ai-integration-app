/**
 * Display helpers shared by call, client and coach views
 */

import type { CallStatus, Sentiment } from '../types';

export const STATUS_LABEL: Record<CallStatus, string> = {
  received: 'Processing',
  needs_review: 'Needs review',
  summarized: 'Summarized',
  posted: 'Posted',
  failed: 'Failed',
};

export const STATUS_SCHEME: Record<CallStatus, string> = {
  received: 'blue',
  needs_review: 'orange',
  summarized: 'purple',
  posted: 'green',
  failed: 'red',
};

export const SENTIMENT_SCHEME: Record<Sentiment, string> = {
  positive: 'green',
  neutral: 'gray',
  mixed: 'yellow',
  negative: 'red',
};

const dateFormat = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const shortDateFormat = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
});

export const formatDateTime = (iso: string | null): string =>
  iso ? dateFormat.format(new Date(iso)) : '—';

export const formatDate = (iso: string | null): string =>
  iso ? shortDateFormat.format(new Date(iso)) : '—';

export const formatDuration = (seconds: number | null): string | null => {
  if (seconds === null) return null;
  const minutes = Math.round(seconds / 60);
  return minutes < 60
    ? `${minutes} min`
    : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
};

/** When the call happened (Grain start time, else when it was received) */
export const callDate = (call: {
  started_at: string | null;
  created_at: string;
}): string => call.started_at ?? call.created_at;
