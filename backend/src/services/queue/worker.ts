/**
 * Job Worker
 *
 * Polls the jobs table and runs one job at a time (local LLMs are the
 * bottleneck). Failures are retried with backoff by failJob(); when a
 * call's job is dead-lettered the call is marked 'failed' and onDead runs
 * (ops alert). Each job runs inside a log context (jobId, callId, runId),
 * so every line it logs can be traced back to it.
 */

import { setCallStatus } from '../../db/callsRepo';
import { claimNextJob, completeJob, failJob } from '../../db/jobsRepo';
import { createLogger, errorMessage, withLogContext } from '../../lib/logger';
import { JobRow, JobType } from '../../types/pipeline';
import { LLMRefusalError } from '../llm';
import { NonRetryableError, RetryLaterError } from './errors';

export type JobHandler = (job: JobRow) => Promise<void>;

export interface WorkerOptions {
  /** Called after a job is dead-lettered (e.g. to alert ops); errors are logged */
  onDead?: (job: JobRow, error: string) => Promise<void>;
}

const POLL_INTERVAL_MS = 1_000;

const log = createLogger('worker');

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const jobContext = (job: JobRow) => ({
  jobId: job.id,
  callId: job.call_id ?? undefined,
  runId: typeof job.payload.runId === 'string' ? job.payload.runId : undefined,
  recordingId:
    typeof job.payload.recordingId === 'string' ? job.payload.recordingId : undefined,
});

export const createWorker = (
  handlers: Record<JobType, JobHandler>,
  options: WorkerOptions = {},
) => {
  let running = false;
  let loop: Promise<void> | null = null;

  const runJob = async (job: JobRow): Promise<void> => {
    const fields = { type: job.type, attempt: `${job.attempts}/${job.max_attempts}` };
    const startTime = Date.now();
    log.info(`▶️ Job ${job.type} started`, fields);

    try {
      await handlers[job.type](job);
      await completeJob(job.id);
      log.info(`✅ Job ${job.type} done`, { ...fields, ms: Date.now() - startTime });
    } catch (error) {
      const retryable = !(
        error instanceof NonRetryableError || error instanceof LLMRefusalError
      );
      const isWaiting =
        error instanceof RetryLaterError && !error.countsAsAttempt;
      const delayMs =
        error instanceof RetryLaterError ? error.delayMs : undefined;
      const status = await failJob(job, errorMessage(error), {
        retryable,
        delayMs,
        refundAttempt: isWaiting,
      });

      if (isWaiting) {
        log.info(`⏳ Job ${job.type} waiting: ${errorMessage(error)}`, fields);
        return;
      }
      log.error(
        `❌ Job ${job.type} failed (${status === 'dead' ? 'dead-lettered' : 'will retry'})`,
        { ...fields, error },
      );
      if (status === 'dead') {
        if (job.call_id) {
          await setCallStatus(job.call_id, 'failed');
        }
        await options.onDead?.(job, errorMessage(error)).catch((hookError) =>
          log.error('❌ onDead hook failed', { error: hookError }),
        );
      }
    }
  };

  const pollLoop = async (): Promise<void> => {
    while (running) {
      try {
        const job = await claimNextJob();
        if (job) {
          await withLogContext(jobContext(job), () => runJob(job));
          continue;
        }
      } catch (error) {
        log.error('❌ Worker poll error', { error });
      }
      await sleep(POLL_INTERVAL_MS);
    }
  };

  return {
    start: () => {
      if (running) return;
      running = true;
      loop = pollLoop();
      log.info('🧵 Job worker started');
    },
    stop: async () => {
      running = false;
      await loop;
    },
  };
};
