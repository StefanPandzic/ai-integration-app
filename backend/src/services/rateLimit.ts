/**
 * Rate Limits (in-process token buckets)
 *
 * acquire(key, limit) takes a token for `key`, sleeping until one is free.
 * A wait longer than `maxWaitMs` is not slept: it throws RetryLaterError
 * so the job queue reschedules the job instead of blocking the worker.
 * Callers that are waiting reserve tokens in order (the bucket goes
 * negative), so concurrent callers queue fairly.
 *
 * One process runs the worker, so in-process buckets are enough; several
 * instances would need a shared store (Postgres or Redis).
 */

import { createLogger } from '../lib/logger';
import { RetryLaterError } from './queue/errors';

export interface RateLimit {
  /** Sustained rate */
  perSecond: number;
  /** Tokens available at once */
  burst: number;
}

interface Bucket {
  tokens: number;
  updatedAt: number;
}

const DEFAULT_MAX_WAIT_MS = 10_000;

const buckets = new Map<string, Bucket>();
const log = createLogger('rate-limit');

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const acquire = async (
  key: string,
  limit: RateLimit,
  maxWaitMs = DEFAULT_MAX_WAIT_MS,
): Promise<void> => {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { tokens: limit.burst, updatedAt: now };
  bucket.tokens = Math.min(
    limit.burst,
    bucket.tokens + ((now - bucket.updatedAt) / 1000) * limit.perSecond,
  );
  bucket.updatedAt = now;

  const waitMs =
    bucket.tokens >= 1 ? 0 : Math.ceil(((1 - bucket.tokens) / limit.perSecond) * 1000);
  if (waitMs > maxWaitMs) {
    buckets.set(key, bucket);
    throw new RetryLaterError(`Rate limit for ${key}: next slot in ${waitMs}ms`, waitMs);
  }

  bucket.tokens -= 1;
  buckets.set(key, bucket);
  if (waitMs > 0) {
    log.debug(`⏳ Waiting for ${key}`, { ms: waitMs });
    await sleep(waitMs);
  }
};
