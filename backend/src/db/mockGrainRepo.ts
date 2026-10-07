/**
 * Mock Grain Repository
 *
 * Every recording the mock Grain connector "has", whether or not its
 * webhook was delivered, the way real Grain knows about every recording.
 * The nightly reconcile lists from here.
 */

import { query } from './index';

export interface MockRecordingRow {
  recording_id: string;
  sample_id: string;
  started_at: Date;
  webhook_dropped: boolean;
  created_at: Date;
}

export const recordMockRecording = async (input: {
  recordingId: string;
  sampleId: string;
  startedAt: Date;
  webhookDropped: boolean;
}): Promise<void> => {
  await query(
    `insert into mock_grain_recordings (recording_id, sample_id, started_at, webhook_dropped)
     values ($1, $2, $3, $4)
     on conflict (recording_id) do nothing`,
    [input.recordingId, input.sampleId, input.startedAt, input.webhookDropped],
  );
};

/** Recordings that reached Grain since `since`, oldest first */
export const listMockRecordings = (since: Date): Promise<MockRecordingRow[]> =>
  query<MockRecordingRow>(
    `select * from mock_grain_recordings
      where created_at >= $1
      order by created_at`,
    [since],
  );
