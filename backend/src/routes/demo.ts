/**
 * Demo API (mock Grain mode)
 *
 * GET  /api/demo/samples           mock Grain sample calls + integration modes
 * POST /api/demo/simulate-call     run a sample through the webhook path
 * POST /api/demo/simulate-week     { count? } samples backdated across last
 *                                  week, through the webhook path
 */

import { Router } from 'express';
import { z } from 'zod';
import { getDriveMode, getSlackMode } from '../config/integrations';
import { getPeriod, localTimestamps } from '../db/reportsRepo';
import {
  buildMockRecordingId,
  getGrainMode,
} from '../services/grain/grainConnector';
import { SAMPLE_CALLS, getSampleCall } from '../services/grain/sampleCalls';
import { acceptGrainRecording } from '../services/pipeline/ingest';
import { handle } from './helpers';

const MAX_SIMULATED_CALLS = 100;
const WORKDAYS = 5;
const FIRST_HOUR = 9;
const WORK_HOURS = 8;

const simulateSchema = z.object({
  sampleId: z.string().optional(),
});

const simulateWeekSchema = z.object({
  count: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_SIMULATED_CALLS)
    .default(SAMPLE_CALLS.length),
});

export const demoRouter = Router();

demoRouter.get('/demo/samples', (_req, res) => {
  res.json({
    grainMode: getGrainMode(),
    slackMode: getSlackMode(),
    driveMode: getDriveMode(),
    samples: SAMPLE_CALLS.map(({ id, title, scenario }) => ({
      id,
      title,
      scenario,
    })),
  });
});

demoRouter.post(
  '/demo/simulate-call',
  handle(async (req, res) => {
    if (getGrainMode() !== 'mock') {
      res.status(409).json({ error: 'Simulation requires GRAIN_MODE=mock' });
      return;
    }

    const parsed = simulateSchema.safeParse(req.body ?? {});
    const sample = parsed.success && parsed.data.sampleId
      ? getSampleCall(parsed.data.sampleId)
      : SAMPLE_CALLS[Math.floor(Math.random() * SAMPLE_CALLS.length)];
    if (!sample) {
      res.status(404).json({ error: 'Unknown sample' });
      return;
    }

    const recordingId = buildMockRecordingId(sample.id);
    const result = await acceptGrainRecording(recordingId, {
      simulated: true,
      sampleId: sample.id,
    });
    res.status(202).json({ recordingId, ...result });
  }),
);

demoRouter.post(
  '/demo/simulate-week',
  handle(async (req, res) => {
    if (getGrainMode() !== 'mock') {
      res.status(409).json({ error: 'Simulation requires GRAIN_MODE=mock' });
      return;
    }

    const parsed = simulateWeekSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: `count must be 1-${MAX_SIMULATED_CALLS}` });
      return;
    }
    const { count } = parsed.data;

    // Spread the calls over last week's workdays, business hours (Chicago)
    const period = await getPeriod();
    const slots = Array.from({ length: count }, (_, i) => ({
      dayOffset: Math.floor((i * WORKDAYS) / count),
      hour: FIRST_HOUR + (i % WORK_HOURS),
    }));
    const startTimes = await localTimestamps(period.periodStart, slots);

    for (const [i, startedAt] of startTimes.entries()) {
      const sample = SAMPLE_CALLS[i % SAMPLE_CALLS.length];
      await acceptGrainRecording(
        buildMockRecordingId(sample.id, new Date(startedAt)),
        { simulated: true, sampleId: sample.id, startedAt },
      );
    }
    res.status(202).json({ count, ...period });
  }),
);
