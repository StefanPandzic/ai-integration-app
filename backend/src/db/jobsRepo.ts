/**
 * Jobs Repository (Postgres-backed queue)
 *
 * Claims use FOR UPDATE SKIP LOCKED so several workers never take the same
 * job. A 'running' job whose lock is older than STALE_LOCK_MINUTES is
 * treated as abandoned (crashed worker) and can be claimed again.
 */

import { JobRow, JobStatus, JobType } from '../types/pipeline';
import { query } from './index';

const STALE_LOCK_MINUTES = 10;
const BACKOFF_BASE_MS = 5_000;
const BACKOFF_MAX_MS = 10 * 60_000;

interface EnqueueOptions {
  type: JobType;
  payload: Record<string, unknown>;
  callId?: string;
  /** Duplicate keys are ignored; the existing job is returned */
  idempotencyKey?: string;
}

export const enqueueJob = async (
  options: EnqueueOptions,
): Promise<{ jobId: string; created: boolean }> => {
  const inserted = await query<{ id: string }>(
    `insert into jobs (type, payload, call_id, idempotency_key)
     values ($1, $2, $3, $4)
     on conflict (idempotency_key) do nothing
     returning id`,
    [
      options.type,
      JSON.stringify(options.payload),
      options.callId ?? null,
      options.idempotencyKey ?? null,
    ],
  );
  if (inserted[0]) {
    return { jobId: inserted[0].id, created: true };
  }

  const existing = await query<{ id: string }>(
    'select id from jobs where idempotency_key = $1',
    [options.idempotencyKey],
  );
  return { jobId: existing[0].id, created: false };
};

export const getJob = async (id: string): Promise<JobRow | null> =>
  (await query<JobRow>('select * from jobs where id = $1', [id]))[0] ?? null;

export const claimNextJob = async (): Promise<JobRow | null> => {
  const rows = await query<JobRow>(
    `update jobs
        set status = 'running', locked_at = now(), attempts = attempts + 1
      where id = (
        select id from jobs
         where (status = 'pending' and run_at <= now())
            or (status = 'running'
                and locked_at < now() - make_interval(mins => $1))
         order by run_at
         limit 1
         for update skip locked
      )
      returning *`,
    [STALE_LOCK_MINUTES],
  );
  return rows[0] ?? null;
};

export const completeJob = async (jobId: string): Promise<void> => {
  await query(
    `update jobs set status = 'succeeded', locked_at = null, last_error = null
      where id = $1`,
    [jobId],
  );
};

/** Exponential backoff with full jitter */
const backoffMs = (attempts: number): number =>
  Math.random() *
  Math.min(BACKOFF_BASE_MS * 2 ** Math.max(attempts - 1, 0), BACKOFF_MAX_MS);

/**
 * Reschedules the job, or dead-letters it when it is out of attempts or
 * the error is permanent. Returns the resulting status.
 */
export const failJob = async (
  job: JobRow,
  error: string,
  options: { retryable: boolean; delayMs?: number; refundAttempt?: boolean },
): Promise<'pending' | 'dead'> => {
  const refund = options.retryable && options.refundAttempt === true;
  const dead =
    !options.retryable || (!refund && job.attempts >= job.max_attempts);
  const delayMs = options.delayMs ?? backoffMs(job.attempts);

  await query(
    `update jobs
        set status = $2, locked_at = null, last_error = $3,
            run_at = now() + make_interval(secs => $4),
            attempts = attempts - $5
      where id = $1`,
    [
      job.id,
      dead ? 'dead' : 'pending',
      error,
      dead ? 0 : delayMs / 1000,
      refund ? 1 : 0,
    ],
  );
  return dead ? 'dead' : 'pending';
};

/** Stores a handler's outcome on the job (e.g. reconcile counts) */
export const setJobResult = async (
  jobId: string,
  result: Record<string, unknown>,
): Promise<void> => {
  await query(
    `update jobs set payload = payload || jsonb_build_object('result', $2::jsonb)
      where id = $1`,
    [jobId, JSON.stringify(result)],
  );
};

export type RetryOutcome = 'retried' | 'not_found' | 'not_dead';

/**
 * Puts a dead job back in the queue with fresh attempts. A failed call
 * goes back to the status of its last finished step, so the pipeline
 * resumes where it stopped.
 */
export const retryJob = async (jobId: string): Promise<RetryOutcome> => {
  const [job] = await query<JobRow>(
    `update jobs
        set status = 'pending', attempts = 0, run_at = now(), locked_at = null
      where id = $1 and status = 'dead'
      returning *`,
    [jobId],
  );
  if (!job) {
    return (await getJob(jobId)) ? 'not_dead' : 'not_found';
  }

  if (job.call_id) {
    await query(
      `update calls
          set status = case
            when slack_message_ts is not null then 'posted'
            when exists (select 1 from call_summaries where call_id = calls.id)
              then 'summarized'
            else 'received' end
        where id = $1 and status = 'failed'`,
      [job.call_id],
    );
  }
  return 'retried';
};

export interface QueueHealth {
  pending: number;
  /** Pending and due now (not waiting for a backoff) */
  ready: number;
  running: number;
  dead: number;
  /** How long the longest-waiting due job has been waiting */
  oldest_ready_age_seconds: number | null;
  succeeded_last_hour: number;
  dead_last_hour: number;
}

export const getQueueHealth = async (): Promise<QueueHealth> => {
  const [row] = await query<QueueHealth>(
    `select count(*) filter (where status = 'pending')::int as pending,
            count(*) filter (where status = 'pending' and run_at <= now())::int as ready,
            count(*) filter (where status = 'running')::int as running,
            count(*) filter (where status = 'dead')::int as dead,
            extract(epoch from now() - min(run_at)
              filter (where status = 'pending' and run_at <= now()))::int
              as oldest_ready_age_seconds,
            count(*) filter (where status = 'succeeded'
              and updated_at > now() - interval '1 hour')::int as succeeded_last_hour,
            count(*) filter (where status = 'dead'
              and updated_at > now() - interval '1 hour')::int as dead_last_hour
       from jobs`,
  );
  return row;
};

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
  result: Record<string, unknown> | null;
  run_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface JobFilters {
  status?: JobStatus | null;
  type?: JobType | null;
  limit?: number;
}

/** Most recently changed first */
export const listJobs = ({
  status = null,
  type = null,
  limit = 50,
}: JobFilters = {}): Promise<JobFeedItem[]> =>
  query<JobFeedItem>(
    `select j.id, j.type, j.status, j.attempts, j.max_attempts, j.last_error,
            j.call_id, ca.title as call_title,
            j.payload->>'runId' as run_id,
            j.payload->>'periodStart' as period_start,
            co.name as coach_name,
            j.payload->>'recordingId' as recording_id,
            j.payload->'result' as result,
            j.run_at, j.created_at, j.updated_at
       from jobs j
       left join calls ca on ca.id = j.call_id
       left join coaches co on co.id::text = j.payload->>'coachId'
      where ($1::text is null or j.status = $1)
        and ($2::text is null or j.type = $2)
      order by j.updated_at desc
      limit $3`,
    [status, type, limit],
  );

export interface ReconcileState {
  status: JobStatus;
  updated_at: Date;
  result: { listed: number; recovered: number } | null;
}

/** The latest reconcile_grain job */
export const getLastReconcile = async (): Promise<ReconcileState | null> =>
  (
    await query<ReconcileState>(
      `select status, updated_at, payload->'result' as result
         from jobs where type = 'reconcile_grain'
        order by created_at desc limit 1`,
    )
  )[0] ?? null;

/** Whether a reconcile succeeded within the last `hours` (startup catch-up) */
export const hasRecentReconcile = async (hours: number): Promise<boolean> =>
  (
    await query<{ id: string }>(
      `select id from jobs
        where type = 'reconcile_grain'
          and status in ('pending', 'running', 'succeeded')
          and created_at > now() - make_interval(hours => $1)
        limit 1`,
      [hours],
    )
  ).length > 0;

export interface JobSnapshot {
  id: string;
  type: JobType;
  status: JobRow['status'];
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  run_at: Date;
  updated_at: Date;
}

/** The most recent job for a call (detail view pipeline state) */
export const getLatestJobForCall = async (
  callId: string,
): Promise<JobSnapshot | null> =>
  (
    await query<JobSnapshot>(
      `select id, type, status, attempts, max_attempts, last_error, run_at, updated_at
         from jobs where call_id = $1 order by created_at desc limit 1`,
      [callId],
    )
  )[0] ?? null;
