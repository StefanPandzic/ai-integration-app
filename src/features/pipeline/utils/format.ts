/**
 * Display helpers for jobs and queue health
 */

import type { JobStatus } from '../../calls';
import type { JobFeedItem, JobType } from '../types';

export const JOB_TYPE_LABEL: Record<JobType, string> = {
  ingest_grain_recording: 'Fetch recording',
  process_call: 'Process call',
  weekly_reports: 'Weekly run',
  coach_report: 'Coach report',
  manager_report: 'Manager report',
  reconcile_grain: 'Grain reconcile',
};

export const JOB_STATUS_SCHEME: Record<JobStatus, string> = {
  pending: 'blue',
  running: 'purple',
  succeeded: 'green',
  failed: 'red',
  dead: 'red',
};

/** "45s", "12 min", "3 h", "2 d" */
export const formatAge = (seconds: number | null): string => {
  if (seconds === null) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)} h`;
  return `${Math.round(seconds / 86_400)} d`;
};

export const ageSince = (iso: string, now = Date.now()): string =>
  formatAge((now - new Date(iso).getTime()) / 1000);

/** What the job is about, for the feed's subject column */
export const jobSubject = (job: JobFeedItem): string => {
  if (job.call_id) return job.call_title ?? 'Untitled call';
  if (job.type === 'coach_report') return `${job.coach_name ?? 'Coach'} · week of ${job.period_start ?? '?'}`;
  if (job.run_id) return `Week of ${job.period_start ?? '?'}`;
  if (job.type === 'reconcile_grain') {
    return job.result
      ? `${job.result.listed ?? 0} listed · ${job.result.recovered ?? 0} recovered`
      : 'Last 48 h of recordings';
  }
  return job.recording_id ?? '—';
};

/** Dashboard link for the job's subject, if it has one */
export const jobLink = (job: JobFeedItem): string | null => {
  if (job.call_id) return `/calls/${job.call_id}`;
  if (job.run_id) return `/reports?period=${job.period_start ?? ''}`;
  return null;
};
