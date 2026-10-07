/**
 * Grain Connector
 *
 * Turns a Grain recording ID into an IncomingCall.
 * - mock (default): serves SAMPLE_CALLS; recording IDs look like
 *   `mock-<sampleId>-<suffix>`
 * - live: real Grain API client (stretch goal, not implemented yet)
 *
 * GRAIN_MODE=mock|live selects the connector.
 */

import { IncomingCall } from '../../types/pipeline';
import { NonRetryableError } from '../queue/errors';
import { SAMPLE_CALLS, getSampleCall } from './sampleCalls';

export type GrainMode = 'mock' | 'live';

export interface GrainConnector {
  mode: GrainMode;
  fetchRecording: (recordingId: string) => Promise<IncomingCall>;
}

export const getGrainMode = (): GrainMode =>
  process.env.GRAIN_MODE === 'live' ? 'live' : 'mock';

const MOCK_ID_PATTERN = /^mock-(.+)-[^-]+$/;

export const buildMockRecordingId = (sampleId: string): string =>
  `mock-${sampleId}-${Date.now().toString(36)}`;

const createMockConnector = (): GrainConnector => ({
  mode: 'mock',
  fetchRecording: async (recordingId) => {
    const sampleId = MOCK_ID_PATTERN.exec(recordingId)?.[1];
    const sample = sampleId ? getSampleCall(sampleId) : undefined;
    if (!sample) {
      throw new NonRetryableError(
        `Unknown mock recording "${recordingId}". Known samples: ${SAMPLE_CALLS.map((s) => s.id).join(', ')}`,
      );
    }

    return {
      externalId: recordingId,
      source: 'mock',
      title: sample.title,
      startedAt: new Date().toISOString(),
      durationSeconds: sample.durationSeconds,
      participants: sample.participants,
      transcript: sample.transcript,
      rawPayload: { sampleId: sample.id },
    };
  },
});

const createLiveConnector = (): GrainConnector => ({
  mode: 'live',
  fetchRecording: async () => {
    throw new NonRetryableError(
      'Live Grain connector is not implemented yet; set GRAIN_MODE=mock',
    );
  },
});

let connector: GrainConnector | null = null;

export const getGrainConnector = (): GrainConnector => {
  connector ??=
    getGrainMode() === 'live' ? createLiveConnector() : createMockConnector();
  return connector;
};
