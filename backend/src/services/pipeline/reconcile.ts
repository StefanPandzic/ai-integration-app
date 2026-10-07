/**
 * Nightly Reconcile against Grain
 *
 * Webhooks get lost (deploys, outages, misconfiguration). Each night the
 * reconcile_grain job lists Grain's recordings from the last
 * RECONCILE_LOOKBACK_HOURS and feeds every one through
 * acceptGrainRecording. The grain:<id> idempotency key turns recordings
 * already received into no-ops, so only missed ones are queued; any it
 * recovers raise an ops alert. Overlapping lookbacks mean a missed night
 * is covered by the next one.
 */

import crypto from 'crypto';
import { getReconcileLookbackHours } from '../../config/integrations';
import { enqueueJob, setJobResult } from '../../db/jobsRepo';
import { createLogger } from '../../lib/logger';
import { JobRow } from '../../types/pipeline';
import { notifyRecovered } from '../alerts/opsAlerts';
import { getGrainConnector } from '../grain/grainConnector';
import { acceptGrainRecording } from './ingest';

export type ReconcileTrigger = 'cron' | 'catch-up' | 'manual';

const log = createLogger('reconcile');

/**
 * Scheduled and catch-up runs share the key reconcile:<UTC date>, so a
 * restart doesn't run it twice in a day. Manual runs always enqueue.
 */
export const enqueueReconcile = async (
  trigger: ReconcileTrigger,
): Promise<{ jobId: string; created: boolean }> => {
  const today = new Date().toISOString().slice(0, 10);
  return enqueueJob({
    type: 'reconcile_grain',
    payload: { trigger, lookbackHours: getReconcileLookbackHours() },
    idempotencyKey:
      trigger === 'manual'
        ? `reconcile:manual:${crypto.randomUUID()}`
        : `reconcile:${today}`,
  });
};

export const handleReconcile = async (job: JobRow): Promise<void> => {
  const hours =
    typeof job.payload.lookbackHours === 'number'
      ? job.payload.lookbackHours
      : getReconcileLookbackHours();
  const since = new Date(Date.now() - hours * 3_600_000);

  const recordings = await getGrainConnector().listRecordings(since);
  const recovered: string[] = [];
  for (const recording of recordings) {
    const { duplicate } = await acceptGrainRecording(recording.id, {
      reconciled: true,
    });
    if (!duplicate) recovered.push(recording.id);
  }

  await setJobResult(job.id, {
    listed: recordings.length,
    recovered: recovered.length,
    recordingIds: recovered,
  });
  log.info(`🔁 Reconcile: ${recordings.length} recordings in the last ${hours}h, ${recovered.length} recovered`);

  if (recovered.length > 0) {
    await notifyRecovered(job.id, recovered);
  }
};
