/**
 * Pipeline types (mirror backend/src/db/jobsRepo.ts and
 * backend/src/routes/pipeline.ts; dates arrive as ISO strings)
 */

import type { JobStatus } from '../../calls';

export type JobType =
  | 'ingest_grain_recording'
  | 'process_call'
  | 'weekly_reports'
  | 'coach_report'
  | 'manager_report'
  | 'reconcile_grain';

export interface JobFeedItem {
  id: string;
  type: JobType;
  status: JobStatus;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  call_id: string | null;
  call_title: string | null;
  run_id: string | null;
  period_start: string | null;
  coach_name: string | null;
  recording_id: string | null;
  /** Reconcile jobs: { listed, recovered, recordingIds } */
  result: { listed?: number; recovered?: number; recordingIds?: string[] } | null;
  run_at: string;
  created_at: string;
  updated_at: string;
}

export interface JobFilters {
  status?: JobStatus;
  type?: JobType;
  limit?: number;
}

export interface QueueHealth {
  pending: number;
  ready: number;
  running: number;
  dead: number;
  oldest_ready_age_seconds: number | null;
  succeeded_last_hour: number;
  dead_last_hour: number;
}

export interface ReconcileState {
  status: JobStatus;
  updated_at: string;
  result: { listed: number; recovered: number } | null;
}

export interface ScheduleInfo {
  enabled: boolean;
  cron: string;
  timezone: string;
  nextRunAt: string | null;
}

export interface PipelineHealth {
  queue: QueueHealth;
  lastReconcile: ReconcileState | null;
  lastReportRun: {
    run_id: string;
    period_start: string;
    state: 'running' | 'ok' | 'partial' | 'failed';
    updated_at: string;
  } | null;
  schedules: { reports: ScheduleInfo; reconcile: ScheduleInfo };
}

export type PipelineTab = 'live' | 'failures';
