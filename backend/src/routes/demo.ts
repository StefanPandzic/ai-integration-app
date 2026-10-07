/**
 * Demo API (mock Grain mode)
 *
 * GET  /api/demo/samples              mock Grain sample calls, integration
 *                                     modes and the demo switches
 * POST /api/demo/simulate-call        record a sample in mock Grain and send
 *                                     its webhook (unless dropped)
 * POST /api/demo/simulate-week        { count? } samples backdated across
 *                                     last week, same path
 * POST /api/demo/drop-next-webhook    { enabled } the next simulated call's
 *                                     webhook is lost (reconcile recovers it)
 * POST /api/demo/fail-next-call       { enabled } the next process_call
 *                                     fails permanently once (Retry demo)
 */

import { Response, Router } from 'express';
import { z } from 'zod';
import { getDriveMode, getSlackMode } from '../config/integrations';
import { getPeriod, localTimestamps } from '../db/reportsRepo';
import { getGrainMode } from '../services/grain/grainConnector';
import {
  isDropNextWebhookArmed,
  setDropNextWebhook,
  simulateRecording,
} from '../services/grain/mockGrain';
import { SAMPLE_CALLS, getSampleCall } from '../services/grain/sampleCalls';
import {
  isFailNextCallArmed,
  setFailNextCall,
} from '../services/pipeline/demoFaults';
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

const switchSchema = z.object({ enabled: z.boolean() });

export const demoRouter = Router();

/** Simulation needs the mock Grain connector; answers 409 otherwise */
const requireMockGrain = (res: Response): boolean => {
  if (getGrainMode() === 'mock') return true;
  res.status(409).json({ error: 'Simulation requires GRAIN_MODE=mock' });
  return false;
};

demoRouter.get('/demo/samples', (_req, res) => {
  res.json({
    grainMode: getGrainMode(),
    slackMode: getSlackMode(),
    driveMode: getDriveMode(),
    dropNextWebhook: isDropNextWebhookArmed(),
    failNextCall: isFailNextCallArmed(),
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
    if (!requireMockGrain(res)) return;

    const parsed = simulateSchema.safeParse(req.body ?? {});
    const sample = parsed.success && parsed.data.sampleId
      ? getSampleCall(parsed.data.sampleId)
      : SAMPLE_CALLS[Math.floor(Math.random() * SAMPLE_CALLS.length)];
    if (!sample) {
      res.status(404).json({ error: 'Unknown sample' });
      return;
    }

    res.status(202).json(await simulateRecording(sample.id));
  }),
);

demoRouter.post(
  '/demo/simulate-week',
  handle(async (req, res) => {
    if (!requireMockGrain(res)) return;

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
      await simulateRecording(sample.id, new Date(startedAt));
    }
    res.status(202).json({ count, ...period });
  }),
);

demoRouter.post(
  '/demo/drop-next-webhook',
  handle(async (req, res) => {
    if (!requireMockGrain(res)) return;
    const parsed = switchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'enabled must be a boolean' });
      return;
    }
    setDropNextWebhook(parsed.data.enabled);
    res.json({ dropNextWebhook: isDropNextWebhookArmed() });
  }),
);

demoRouter.post(
  '/demo/fail-next-call',
  handle(async (req, res) => {
    if (!requireMockGrain(res)) return;
    const parsed = switchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'enabled must be a boolean' });
      return;
    }
    setFailNextCall(parsed.data.enabled);
    res.json({ failNextCall: isFailNextCallArmed() });
  }),
);
