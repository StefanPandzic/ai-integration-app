/**
 * Display helpers for weekly reports
 */

import type { RubricKey, RunState, RunTrigger } from '../types';

/** Mirrors RUBRIC in backend/src/schemas/coachReport.ts */
export const RUBRIC_LABEL: Record<RubricKey, string> = {
  goal_clarity: 'Goal clarity',
  accountability: 'Accountability',
  client_ownership: 'Client ownership',
  listening: 'Listening',
  progress: 'Progress toward goals',
};

export const RUN_STATE_LABEL: Record<RunState, string> = {
  running: 'Running',
  ok: 'Delivered',
  partial: 'Partial',
  failed: 'Failed',
};

export const RUN_STATE_SCHEME: Record<RunState, string> = {
  running: 'blue',
  ok: 'green',
  partial: 'orange',
  failed: 'red',
};

export const TRIGGER_LABEL: Record<RunTrigger, string> = {
  cron: 'Scheduled',
  'catch-up': 'Catch-up',
  manual: 'Manual',
};

const dayFormat = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

const parseDay = (day: string) => new Date(`${day}T00:00:00Z`);

/** "Sep 28 – Oct 4" from 'YYYY-MM-DD' period dates */
export const formatPeriod = (start: string, end: string): string =>
  `${dayFormat.format(parseDay(start))} – ${dayFormat.format(parseDay(end))}`;

/** Sunday of the week starting on `start` */
export const periodEnd = (start: string): string => {
  const date = parseDay(start);
  date.setUTCDate(date.getUTCDate() + 6);
  return date.toISOString().slice(0, 10);
};

export const formatRating = (value: number | null | undefined): string =>
  value === null || value === undefined ? '—' : `${value.toFixed(1)}/5`;

export const formatShare = (value: number | null): string =>
  value === null ? '—' : `${Math.round(value * 100)}%`;

/** "+3", "-1", "±0" */
export const formatDelta = (value: number | null): string | null => {
  if (value === null) return null;
  if (value === 0) return '±0';
  return value > 0 ? `+${value}` : String(value);
};

export const ratingScheme = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return 'gray';
  if (value >= 4) return 'green';
  if (value >= 3) return 'blue';
  if (value >= 2) return 'orange';
  return 'red';
};

/** "Sep 28" from a 'YYYY-MM-DD' date */
export const formatDay = (day: string): string => dayFormat.format(parseDay(day));
