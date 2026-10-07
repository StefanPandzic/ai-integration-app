/**
 * Reports API
 *
 * GET  /api/reports?type=&coachId=&periodStart=   list (newest first, no content)
 * GET  /api/reports/runs?limit=                    recent runs + schedule
 * GET  /api/reports/:id                            full report + outbox links
 * POST /api/reports/run  { periodStart? }          manual backfill/rerun
 */

import { Router } from 'express';
import { z } from 'zod';
import { findOutboxIdByExternalId } from '../db/outboxRepo';
import { getReport, listReports, listRuns } from '../db/reportsRepo';
import { enqueueWeeklyRun } from '../services/reports/runWeeklyReports';
import { getScheduleInfo } from '../services/reports/scheduler';
import { ReportType } from '../types/pipeline';
import { handle, isUuid, uuidParam } from './helpers';

const REPORT_TYPES: ReportType[] = ['coach', 'manager'];
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).catch(100),
});

const runsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).catch(10),
});

const runSchema = z.object({
  periodStart: dateSchema.nullable().default(null),
});

export const reportsRouter = Router();

reportsRouter.get(
  '/reports',
  handle(async (req, res) => {
    const periodStart = dateSchema.safeParse(req.query.periodStart);
    const reports = await listReports({
      type: REPORT_TYPES.find((t) => t === req.query.type) ?? null,
      coachId: uuidParam(req.query.coachId),
      periodStart: periodStart.success ? periodStart.data : null,
      limit: listSchema.parse(req.query).limit,
    });
    res.json({ reports });
  }),
);

reportsRouter.get(
  '/reports/runs',
  handle(async (req, res) => {
    const runs = await listRuns(runsSchema.parse(req.query).limit);
    res.json({ runs, schedule: getScheduleInfo() });
  }),
);

reportsRouter.get(
  '/reports/:id',
  handle(async (req, res) => {
    const report = isUuid(req.params.id) ? await getReport(req.params.id) : null;
    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }
    const [slack, drive] = await Promise.all([
      findOutboxIdByExternalId('slack', report.slack_message_ts),
      findOutboxIdByExternalId('drive', report.drive_file_id),
    ]);
    res.json({ report, outbox: { slack, drive } });
  }),
);

reportsRouter.post(
  '/reports/run',
  handle(async (req, res) => {
    const parsed = runSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: 'periodStart must be YYYY-MM-DD' });
      return;
    }
    const run = await enqueueWeeklyRun({
      trigger: 'manual',
      periodStart: parsed.data.periodStart,
    });
    res.status(202).json({
      runId: run.runId,
      periodStart: run.periodStart,
      periodEnd: run.periodEnd,
    });
  }),
);
