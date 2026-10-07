/**
 * Jobs Repository (Postgres-backed queue)
 *
 * Claims use FOR UPDATE SKIP LOCKED so several workers never take the same
 * job. A 'running' job whose lock is older than STALE_LOCK_MINUTES is
 * treated as abandoned (crashed worker) and can be claimed again.
 */

import { JobRow, JobType } from '../types/pipeline';
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
  options: { retryable: boolean; delayMs?: number },
): Promise<'pending' | 'dead'> => {
  const dead = !options.retryable || job.attempts >= job.max_attempts;
  const delayMs = options.delayMs ?? backoffMs(job.attempts);

  await query(
    `update jobs
        set status = $2, locked_at = null, last_error = $3,
            run_at = now() + make_interval(secs => $4)
      where id = $1`,
    [job.id, dead ? 'dead' : 'pending', error, dead ? 0 : delayMs / 1000],
  );
  return dead ? 'dead' : 'pending';
};
