/**
 * Grain Connector
 *
 * Turns a Grain recording ID into an IncomingCall, and lists recordings
 * (the nightly reconcile).
 * - mock (default): serves SAMPLE_CALLS; recording IDs look like
 *   `mock-<sampleId>-<suffix>`. Recordings are listed from
 *   mock_grain_recordings (see mockGrain.ts)
 * - live: real Grain API client (not implemented; design in
 *   docs/INTEGRATIONS.md)
 *
 * GRAIN_MODE=mock|live selects the connector.
 */

import crypto from 'crypto';
import { listMockRecordings } from '../../db/mockGrainRepo';
import { IncomingCall } from '../../types/pipeline';
import { NonRetryableError } from '../queue/errors';
import { SAMPLE_CALLS, getSampleCall } from './sampleCalls';

export type GrainMode = 'mock' | 'live';

export interface RecordingRef {
  id: string;
  createdAt: Date;
}

export interface GrainConnector {
  mode: GrainMode;
  fetchRecording: (recordingId: string) => Promise<IncomingCall>;
  /** Recordings created since `since` (Grain: list recordings, updated_after) */
  listRecordings: (since: Date) => Promise<RecordingRef[]>;
}

export const getGrainMode = (): GrainMode =>
  process.env.GRAIN_MODE === 'live' ? 'live' : 'mock';

// mock-<sampleId>-<unique>[.<startedAt ms, base36>]
const MOCK_ID_PATTERN = /^mock-(.+)-[a-z0-9]+(?:\.([a-z0-9]+))?$/;

/**
 * A mock recording ID. `startedAt` backdates the call (simulate-week);
 * it is encoded in the ID because the connector only ever sees the ID.
 */
export const buildMockRecordingId = (sampleId: string, startedAt?: Date): string => {
  const unique = `${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
  return startedAt
    ? `mock-${sampleId}-${unique}.${startedAt.getTime().toString(36)}`
    : `mock-${sampleId}-${unique}`;
};

const createMockConnector = (): GrainConnector => ({
  mode: 'mock',
  fetchRecording: async (recordingId) => {
    const match = MOCK_ID_PATTERN.exec(recordingId);
    const sampleId = match?.[1];
    const startedAtMs = match?.[2] ? parseInt(match[2], 36) : Date.now();
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
      startedAt: new Date(startedAtMs).toISOString(),
      durationSeconds: sample.durationSeconds,
      participants: sample.participants,
      transcript: sample.transcript,
      rawPayload: { sampleId: sample.id },
    };
  },
  listRecordings: async (since) =>
    (await listMockRecordings(since)).map((r) => ({
      id: r.recording_id,
      createdAt: r.created_at,
    })),
});

const notImplemented = async (): Promise<never> => {
  throw new NonRetryableError(
    'Live Grain connector is not implemented yet; set GRAIN_MODE=mock',
  );
};

const createLiveConnector = (): GrainConnector => ({
  mode: 'live',
  fetchRecording: notImplemented,
  listRecordings: notImplemented,
});

let connector: GrainConnector | null = null;

export const getGrainConnector = (): GrainConnector => {
  connector ??=
    getGrainMode() === 'live' ? createLiveConnector() : createMockConnector();
  return connector;
};
