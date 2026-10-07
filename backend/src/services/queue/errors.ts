/**
 * Job Errors
 *
 * Handlers throw these to tell the worker how to treat a failure.
 * Any other error is retried with exponential backoff.
 */

/** Retrying can't help (bad config, unknown channel); dead-letter now */
export class NonRetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NonRetryableError';
  }
}

/** Retry after a specific delay (e.g. a Retry-After header) */
export class RetryLaterError extends Error {
  constructor(
    message: string,
    public readonly delayMs: number,
  ) {
    super(message);
    this.name = 'RetryLaterError';
  }
}
