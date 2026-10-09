/**
 * Live Events
 *
 * Tells the dashboard what changed so it refetches at once instead of
 * waiting for its next poll. Table triggers (migration 005) send
 * pg_notify('table_changes', <table>) on every write, from this process
 * or any other (CLI scripts included). One dedicated LISTEN connection maps
 * each table to the RTK Query tags it feeds; publishChange() covers state
 * that lives in memory (the demo switches). Changes are batched for
 * FLUSH_MS and sent to every subscriber (the SSE route, /api/events).
 *
 * While the LISTEN connection is down, isLive() is false: the SSE route
 * closes its streams and the UI falls back to polling.
 */

import { Client } from 'pg';
import { connectClient } from '../../db';
import { createLogger, errorMessage } from '../../lib/logger';

/** Mirrors the frontend's RTK Query tag types (src/store/api.ts) */
export type LiveTag =
  | 'Call'
  | 'Client'
  | 'Coach'
  | 'Demo'
  | 'Report'
  | 'ReportRun'
  | 'Outbox'
  | 'Job'
  | 'Pipeline';

export type LiveListener = (event: LiveEvent) => void;

export type LiveEvent =
  | { type: 'invalidate'; tags: LiveTag[] }
  /** The LISTEN connection dropped: changes may be missed until it is back */
  | { type: 'down' };

const CHANNEL = 'table_changes';
const FLUSH_MS = 150;
const RECONNECT_MIN_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

const TABLE_TAGS: Record<string, LiveTag[]> = {
  coaches: ['Coach', 'Client'],
  clients: ['Client', 'Coach'],
  calls: ['Call', 'Client', 'Coach'],
  call_summaries: ['Call', 'Client', 'Coach'],
  reports: ['Report', 'ReportRun', 'Coach'],
  // The call detail shows its job; report runs are counted from jobs
  jobs: ['Job', 'Pipeline', 'Call', 'ReportRun'],
  integration_outbox: ['Outbox', 'Call', 'Report'],
  mock_grain_recordings: ['Demo', 'Pipeline'],
};

const log = createLogger('live');

const listeners = new Set<LiveListener>();
const pending = new Set<LiveTag>();
let flushTimer: NodeJS.Timeout | null = null;
let client: Client | null = null;
let live = false;
let reconnectDelay = RECONNECT_MIN_MS;

const emit = (event: LiveEvent): void => {
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch (error) {
      log.error('❌ Live listener failed', { error });
    }
  });
};

const flush = (): void => {
  flushTimer = null;
  if (pending.size === 0) return;
  const tags = [...pending];
  pending.clear();
  emit({ type: 'invalidate', tags });
};

/** Queues tags for the next batch sent to the UI */
export const publishChange = (tags: LiveTag[]): void => {
  tags.forEach((tag) => pending.add(tag));
  flushTimer ??= setTimeout(flush, FLUSH_MS);
};

export const subscribeLive = (listener: LiveListener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const isLive = (): boolean => live;

const scheduleReconnect = (): void => {
  const delay = reconnectDelay;
  reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS);
  setTimeout(() => void connect(), delay);
};

const handleLost = (reason: string): void => {
  if (!client) return;
  const lost = client;
  client = null;
  lost.removeAllListeners();
  void lost.end().catch(() => undefined);
  if (live) {
    live = false;
    log.warn(`⚠️ Live updates paused (UI polls until reconnected): ${reason}`);
    emit({ type: 'down' });
  }
  scheduleReconnect();
};

const connect = async (): Promise<void> => {
  if (client) return;
  try {
    const next = await connectClient();
    client = next;
    next.on('notification', ({ channel, payload }) => {
      if (channel !== CHANNEL || !payload) return;
      const tags = TABLE_TAGS[payload];
      if (tags) publishChange(tags);
    });
    next.on('error', (error) => handleLost(errorMessage(error)));
    next.on('end', () => handleLost('connection ended'));
    await next.query(`listen ${CHANNEL}`);
    live = true;
    reconnectDelay = RECONNECT_MIN_MS;
    log.info('📡 Live updates: listening for table changes');
  } catch (error) {
    if (client) {
      handleLost(errorMessage(error));
    } else {
      log.warn(`⚠️ Live updates unavailable: ${errorMessage(error)}`);
      scheduleReconnect();
    }
  }
};

/** Opens the LISTEN connection; reconnects with backoff when it drops */
export const startLiveEvents = (): void => {
  void connect();
};
