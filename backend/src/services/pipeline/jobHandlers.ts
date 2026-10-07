/**
 * Job Handlers: JobType → handler
 */

import { JobRow, JobType } from '../../types/pipeline';
import { getGrainConnector } from '../grain/grainConnector';
import { NonRetryableError } from '../queue/errors';
import { JobHandler } from '../queue/worker';
import { ingestCall } from './ingest';
import { processCall } from './processCall';

const requireString = (job: JobRow, key: string): string => {
  const value = job.payload[key];
  if (typeof value !== 'string') {
    throw new NonRetryableError(`Job ${job.id} payload is missing "${key}"`);
  }
  return value;
};

export const JOB_HANDLERS: Record<JobType, JobHandler> = {
  ingest_grain_recording: async (job) => {
    const recording = await getGrainConnector().fetchRecording(
      requireString(job, 'recordingId'),
    );
    const { callId, duplicate } = await ingestCall(recording);
    console.log(
      `📥 Recording ${recording.externalId} → call ${callId.slice(0, 8)}${duplicate ? ' (already stored)' : ''}`,
    );
  },

  process_call: (job) => processCall(requireString(job, 'callId')),
};
