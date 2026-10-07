/**
 * Slack Connector
 *
 * SLACK_MODE=mock|live selects the implementation behind postMessage():
 * - mock (default): writes the Block Kit message to integration_outbox and
 *   returns a fake Slack-style `ts`, so the dashboard shows what was "sent"
 * - live: chat.postMessage over fetch with SLACK_BOT_TOKEN. On HTTP 429 it
 *   honors Retry-After: short waits are slept in-process, long ones are
 *   handed back to the job queue as a RetryLaterError. Kept for going live
 *   (see docs/INTEGRATIONS.md); the demo runs on the mock.
 *
 * A channel can be a channel ID or a user ID (posting to a user ID DMs them).
 */

import { ConnectorMode, getSlackMode } from '../../config/integrations';
import { recordOutbound } from '../../db/outboxRepo';
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

export interface SlackConnector {
  mode: ConnectorMode;
  postMessage: (message: SlackMessage) => Promise<{ ts: string }>;
}

interface PostMessageResponse {
  ok: boolean;
  ts?: string;
  error?: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Slack-style message timestamp ("seconds.micros") */
const fakeTs = (): string => {
  const now = Date.now();
  const micros = (now % 1000) * 1000 + Math.floor(Math.random() * 1000);
  return `${Math.floor(now / 1000)}.${String(micros).padStart(6, '0')}`;
};

const createMockConnector = (): SlackConnector => ({
  mode: 'mock',
  postMessage: async (message) => {
    const ts = fakeTs();
    await recordOutbound({
      service: 'slack',
      target: message.channel,
      title: message.text,
      payload: { text: message.text, blocks: message.blocks },
      externalId: ts,
    });
    console.log(`💬 [Slack mock] ${message.channel}: ${message.text}`);
    return { ts };
  },
});

const createLiveConnector = (): SlackConnector => ({
  mode: 'live',
  postMessage: async (message) => {
    const token = process.env.SLACK_BOT_TOKEN;
    if (!token) {
      throw new NonRetryableError('SLACK_MODE=live requires SLACK_BOT_TOKEN');
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
        return { ts: body.ts };
      }

      const error = body.error ?? 'unknown_error';
      if (RETRYABLE_ERRORS.has(error)) {
        throw new Error(`Slack error: ${error}`);
      }
      throw new NonRetryableError(
        `Slack error: ${error} (channel ${message.channel})`,
      );
    }
  },
});

let connector: SlackConnector | null = null;

export const getSlackConnector = (): SlackConnector => {
  connector ??=
    getSlackMode() === 'live' ? createLiveConnector() : createMockConnector();
  return connector;
};

export const postMessage = (message: SlackMessage): Promise<{ ts: string }> =>
  getSlackConnector().postMessage(message);
