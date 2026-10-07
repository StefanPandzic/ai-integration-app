/**
 * Mock Grain: recording a new call
 *
 * What real Grain does when a meeting ends: the recording exists in Grain
 * (mock_grain_recordings) and a webhook is sent (acceptGrainRecording,
 * the same path as POST /webhooks/grain). The "drop next webhook" demo
 * switch skips the webhook once, so the nightly reconcile has a missed
 * call to recover.
 */

import { recordMockRecording } from '../../db/mockGrainRepo';
import { createLogger } from '../../lib/logger';
import { acceptGrainRecording } from '../pipeline/ingest';
import { buildMockRecordingId } from './grainConnector';

const log = createLogger('grain-mock');

let dropNextWebhook = false;

export const setDropNextWebhook = (enabled: boolean): void => {
  dropNextWebhook = enabled;
};

export const isDropNextWebhookArmed = (): boolean => dropNextWebhook;

export interface SimulatedRecording {
  recordingId: string;
  /** null when the webhook was dropped */
  jobId: string | null;
  duplicate: boolean;
  webhookDropped: boolean;
}

export const simulateRecording = async (
  sampleId: string,
  startedAt?: Date,
): Promise<SimulatedRecording> => {
  const recordingId = buildMockRecordingId(sampleId, startedAt);
  const webhookDropped = dropNextWebhook;
  dropNextWebhook = false;

  await recordMockRecording({
    recordingId,
    sampleId,
    startedAt: startedAt ?? new Date(),
    webhookDropped,
  });

  if (webhookDropped) {
    log.warn('🕳️ Webhook dropped (demo): only the nightly reconcile will find this call', {
      recordingId,
    });
    return { recordingId, jobId: null, duplicate: false, webhookDropped };
  }

  const { jobId, duplicate } = await acceptGrainRecording(recordingId, {
    simulated: true,
    sampleId,
    startedAt: startedAt?.toISOString(),
  });
  return { recordingId, jobId, duplicate, webhookDropped };
};
