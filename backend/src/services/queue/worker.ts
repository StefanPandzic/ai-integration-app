/**
 * Job Worker
 *
 * Polls the jobs table and runs one job at a time (local LLMs are the
 * bottleneck). Failures are retried with backoff by failJob(); when a
 * call's job is dead-lettered the call is marked 'failed'.
 */

import { setCallStatus } from '../../db/callsRepo';
import { claimNextJob, completeJob, failJob } from '../../db/jobsRepo';
import { JobRow, JobType } from '../../types/pipeline';
import { LLMRefusalError } from '../llm';
import { NonRetryableError, RetryLaterError } from './errors';

export type JobHandler = (job: JobRow) => Promise<void>;

const POLL_INTERVAL_MS = 1_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const errorMessage = (error: unknown): string =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error);

export const createWorker = (handlers: Record<JobType, JobHandler>) => {
  let running = false;
  let loop: Promise<void> | null = null;

  const runJob = async (job: JobRow): Promise<void> => {
    const label = `${job.type} ${job.id.slice(0, 8)} (attempt ${job.attempts}/${job.max_attempts})`;
    const startTime = Date.now();
    console.log(`▶️ Job ${label}`);

    try {
      await handlers[job.type](job);
      await completeJob(job.id);
      console.log(`✅ Job ${label} done in ${Date.now() - startTime}ms`);
    } catch (error) {
      const retryable = !(
        error instanceof NonRetryableError || error instanceof LLMRefusalError
      );
      const delayMs =
        error instanceof RetryLaterError ? error.delayMs : undefined;
      const status = await failJob(job, errorMessage(error), {
        retryable,
        delayMs,
      });

      console.error(
        `❌ Job ${label} failed (${status === 'dead' ? 'dead-lettered' : 'will retry'}): ${errorMessage(error)}`,
      );
      if (status === 'dead' && job.call_id) {
        await setCallStatus(job.call_id, 'failed');
      }
    }
  };

  const pollLoop = async (): Promise<void> => {
    while (running) {
      try {
        const job = await claimNextJob();
        if (job) {
          await runJob(job);
          continue;
        }
      } catch (error) {
        console.error('❌ Worker poll error:', errorMessage(error));
      }
      await sleep(POLL_INTERVAL_MS);
    }
  };

  return {
    start: () => {
      if (running) return;
      running = true;
      loop = pollLoop();
      console.log('🧵 Job worker started');
    },
    stop: async () => {
      running = false;
      await loop;
    },
  };
};
