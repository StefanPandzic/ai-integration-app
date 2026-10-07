/**
 * Demo API (mock Grain mode)
 *
 * GET  /api/demo/samples           mock Grain sample calls + integration modes
 * POST /api/demo/simulate-call     run a sample through the webhook path
 */

import { Router } from 'express';
import { z } from 'zod';
import {
  buildMockRecordingId,
  getGrainMode,
} from '../services/grain/grainConnector';
import { SAMPLE_CALLS, getSampleCall } from '../services/grain/sampleCalls';
import { acceptGrainRecording } from '../services/pipeline/ingest';
import { isSlackDryRun } from '../services/slack/slackClient';
import { handle } from './helpers';

const simulateSchema = z.object({
  sampleId: z.string().optional(),
});

export const demoRouter = Router();

demoRouter.get('/demo/samples', (_req, res) => {
  res.json({
    grainMode: getGrainMode(),
    slackDryRun: isSlackDryRun(),
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
