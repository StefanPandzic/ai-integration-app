/**
 * Job Handlers: JobType → handler
 */

import { createLogger, withLogContext } from '../../lib/logger';
import { JobRow, JobType } from '../../types/pipeline';
import { getGrainConnector } from '../grain/grainConnector';
import { NonRetryableError } from '../queue/errors';
import { JobHandler } from '../queue/worker';
import {
  handleCoachReport,
  handleManagerReport,
  handleWeeklyReports,
} from '../reports/runWeeklyReports';
import { ingestCall } from './ingest';
import { processCall } from './processCall';
import { handleReconcile } from './reconcile';

const log = createLogger('pipeline');

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
    withLogContext({ callId }, () =>
      log.info(`📥 Recording stored${duplicate ? ' (already stored)' : ''}`, {
        recordingId: recording.externalId,
      }),
    );
  },

  process_call: (job) => processCall(requireString(job, 'callId')),

  weekly_reports: handleWeeklyReports,
  coach_report: handleCoachReport,
  manager_report: handleManagerReport,

  reconcile_grain: handleReconcile,
};
