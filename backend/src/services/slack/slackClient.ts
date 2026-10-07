/**
 * Slack Client
 *
 * chat.postMessage over fetch. On HTTP 429 it honors Retry-After: short
 * waits are slept in-process, long ones are handed back to the job queue
 * as a RetryLaterError. Without SLACK_BOT_TOKEN it runs in dry-run mode
 * (logs the message and returns a fake `dry-run-*` ts).
 */

import { NonRetryableError, RetryLaterError } from '../queue/errors';

const POST_MESSAGE_URL = 'https://slack.com/api/chat.postMessage';
const MAX_INLINE_WAIT_MS = 10_000;
const MAX_INLINE_RETRIES = 3;

// Slack error codes worth retrying; everything else is a config problem
const RETRYABLE_ERRORS = new Set([
  'ratelimited',
  'internal_error',
  'fatal_error',
  'service_unavailable',
  'request_timeout',
]);

export interface SlackMessage {
  channel: string;
  text: string;
  blocks: Record<string, unknown>[];
}

interface PostMessageResponse {
  ok: boolean;
  ts?: string;
  error?: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const isSlackDryRun = (): boolean => !process.env.SLACK_BOT_TOKEN;

export const postMessage = async (
  message: SlackMessage,
): Promise<{ ts: string; dryRun: boolean }> => {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    console.log(
      `💬 [Slack dry run] #${message.channel}: ${message.text} (${message.blocks.length} blocks)`,
    );
    return { ts: `dry-run-${Date.now()}`, dryRun: true };
  }

  for (let attempt = 1; ; attempt++) {
    const response = await fetch(POST_MESSAGE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(message),
    });

    if (response.status === 429) {
      const retryAfterMs =
        (Number(response.headers.get('retry-after')) || 1) * 1000;
      if (retryAfterMs > MAX_INLINE_WAIT_MS || attempt >= MAX_INLINE_RETRIES) {
        throw new RetryLaterError('Slack rate limited', retryAfterMs);
      }
      console.warn(`⏳ Slack rate limited, retrying in ${retryAfterMs}ms`);
      await sleep(retryAfterMs);
      continue;
    }

    if (!response.ok) {
      throw new Error(`Slack HTTP ${response.status} ${response.statusText}`);
    }

    const body = (await response.json()) as PostMessageResponse;
    if (body.ok && body.ts) {
      return { ts: body.ts, dryRun: false };
    }

    const error = body.error ?? 'unknown_error';
    if (RETRYABLE_ERRORS.has(error)) {
      throw new Error(`Slack error: ${error}`);
    }
    throw new NonRetryableError(
      `Slack error: ${error} (channel ${message.channel})`,
    );
  }
};
