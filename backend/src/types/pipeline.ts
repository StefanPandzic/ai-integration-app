/**
 * Call Pipeline Types
 *
 * Shapes shared by the Grain connector, the job queue and the API routes.
 * Row types mirror backend/db/migrations/*.sql.
 */

import { z } from 'zod';

export const participantSchema = z.object({
  name: z.string().min(1),
  email: z.email().nullable(),
});

/** A call as delivered by any source, before it is stored */
export const incomingCallSchema = z.object({
  externalId: z.string().min(1),
  source: z.enum(['grain', 'mock', 'browser']),
  title: z.string().nullable(),
  startedAt: z.string().nullable(),
  durationSeconds: z.number().int().nonnegative().nullable(),
  participants: z.array(participantSchema).min(1),
  transcript: z.string().min(1),
  rawPayload: z.unknown().optional(),
});

export type Participant = z.infer<typeof participantSchema>;
export type IncomingCall = z.infer<typeof incomingCallSchema>;

export type CallStatus =
  | 'received'
  | 'needs_review'
  | 'summarized'
  | 'posted'
  | 'failed';

export interface CallRow {
  id: string;
  grain_recording_id: string;
  source: IncomingCall['source'];
  title: string | null;
  started_at: Date | null;
  duration_seconds: number | null;
  participants: Participant[];
  transcript: string;
  coach_id: string | null;
  client_id: string | null;
  status: CallStatus;
  review_reason: string | null;
  slack_message_ts: string | null;
  drive_file_id: string | null;
  drive_url: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CoachRow {
  id: string;
  name: string;
  email: string;
  slack_user_id: string | null;
}

export interface ClientRow {
  id: string;
  name: string;
  email: string | null;
  coach_id: string | null;
  slack_channel_id: string;
  title_keywords: string[];
}

export type JobType =
  | 'ingest_grain_recording'
  | 'process_call'
  | 'weekly_reports'
  | 'coach_report'
  | 'manager_report'
  | 'reconcile_grain';
export type JobStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'dead';

export interface JobRow {
  id: string;
  type: JobType;
  payload: Record<string, unknown>;
  call_id: string | null;
  idempotency_key: string | null;
  status: JobStatus;
  attempts: number;
  max_attempts: number;
  run_at: Date;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
}

export type ReportType = 'coach' | 'manager';
export type ReportStatus = 'ready' | 'empty';

/** Period dates are selected as 'YYYY-MM-DD' text (no timezone shifts) */
export interface ReportRow {
  id: string;
  type: ReportType;
  coach_id: string | null;
  period_start: string;
  period_end: string;
  status: ReportStatus;
  content: Record<string, unknown>;
  provider: string;
  model: string;
  slack_message_ts: string | null;
  drive_file_id: string | null;
  drive_url: string | null;
  created_at: Date;
}
