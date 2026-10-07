/**
 * Pipeline API (queue health, job feed, recovery actions)
 *
 * GET  /api/pipeline/health          queue counts, oldest due job, last hour,
 *                                    last reconcile and report run, next crons
 * POST /api/pipeline/reconcile       manual Grain reconcile → 202 { jobId }
 * GET  /api/jobs?status=&type=&limit=  job feed, most recently changed first
 * POST /api/jobs/:id/retry           dead job → pending (failed call resumes)
 */

import { Router } from 'express';
import { z } from 'zod';
import {
  getLastReconcile,
  getQueueHealth,
  listJobs,
  retryJob,
} from '../db/jobsRepo';
import { listRuns } from '../db/reportsRepo';
import { createLogger } from '../lib/logger';
import { enqueueReconcile } from '../services/pipeline/reconcile';
import {
  getReconcileScheduleInfo,
  getScheduleInfo,
} from '../services/scheduler';
import { JobStatus, JobType } from '../types/pipeline';
import { handle, isUuid } from './helpers';

const JOB_STATUSES: JobStatus[] = ['pending', 'running', 'succeeded', 'failed', 'dead'];
const JOB_TYPES: JobType[] = [
  'ingest_grain_recording',
  'process_call',
  'weekly_reports',
  'coach_report',
  'manager_report',
  'reconcile_grain',
];
const MAX_JOBS = 200;

const limitSchema = z.coerce.number().int().min(1).max(MAX_JOBS).catch(50);

const log = createLogger('pipeline');

/** Everything the Pipeline page and /health report */
export const getPipelineHealth = async () => {
  const [queue, lastReconcile, [lastReportRun]] = await Promise.all([
    getQueueHealth(),
    getLastReconcile(),
    listRuns(1),
  ]);
  return {
    queue,
    lastReconcile,
    lastReportRun: lastReportRun
      ? {
          run_id: lastReportRun.run_id,
          period_start: lastReportRun.period_start,
          state: lastReportRun.state,
          updated_at: lastReportRun.updated_at,
        }
      : null,
    schedules: {
      reports: getScheduleInfo(),
      reconcile: getReconcileScheduleInfo(),
    },
  };
};

export const pipelineRouter = Router();

pipelineRouter.get(
  '/pipeline/health',
  handle(async (_req, res) => {
    res.json(await getPipelineHealth());
  }),
);

pipelineRouter.post(
  '/pipeline/reconcile',
  handle(async (_req, res) => {
    const { jobId } = await enqueueReconcile('manual');
    log.info('🔁 Manual reconcile requested', { jobId });
    res.status(202).json({ jobId });
  }),
);

pipelineRouter.get(
  '/jobs',
  handle(async (req, res) => {
    const jobs = await listJobs({
      status: JOB_STATUSES.find((s) => s === req.query.status) ?? null,
      type: JOB_TYPES.find((t) => t === req.query.type) ?? null,
      limit: limitSchema.parse(req.query.limit),
    });
    res.json({ jobs });
  }),
);

pipelineRouter.post(
  '/jobs/:id/retry',
  handle(async (req, res) => {
    if (!isUuid(req.params.id)) {
      res.status(400).json({ error: 'Invalid job ID' });
      return;
    }
    const outcome = await retryJob(req.params.id);
    if (outcome === 'not_found') {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    if (outcome === 'not_dead') {
      res.status(409).json({ error: 'Only dead jobs can be retried' });
      return;
    }
    log.info('🔄 Job retried by hand', { jobId: req.params.id });
    res.status(202).json({ ok: true });
  }),
);
