/**
 * Calls API
 *
 * GET  /api/calls?status=          list calls (review queue: status=needs_review)
 * GET  /api/calls/:id              call + summary
 * POST /api/calls                  ingest a browser-recorded call
 * POST /api/calls/:id/assign       resolve a review-queue call
 * GET  /api/clients                clients for the assign picker
 * GET  /api/demo/samples           mock Grain sample calls
 * POST /api/demo/simulate-call     run a sample through the webhook path
 */

import crypto from 'crypto';
import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { getCall, getSummary, listCalls } from '../db/callsRepo';
import { listClients } from '../db/directoryRepo';
import {
  buildMockRecordingId,
  getGrainMode,
} from '../services/grain/grainConnector';
import { SAMPLE_CALLS, getSampleCall } from '../services/grain/sampleCalls';
import {
  AssignError,
  acceptGrainRecording,
  assignCall,
  ingestCall,
} from '../services/pipeline/ingest';
import { isSlackDryRun } from '../services/slack/slackClient';
import { CallStatus, participantSchema } from '../types/pipeline';

const CALL_STATUSES: CallStatus[] = [
  'received',
  'needs_review',
  'summarized',
  'posted',
  'failed',
];

const browserCallSchema = z.object({
  title: z.string().nullable().default(null),
  participants: z.array(participantSchema).min(1),
  transcript: z.string().min(1),
  durationSeconds: z.number().int().nonnegative().nullable().default(null),
});

const assignSchema = z.object({
  clientId: z.uuid(),
  coachId: z.uuid().nullable().default(null),
});

const simulateSchema = z.object({
  sampleId: z.string().optional(),
});

type AsyncHandler = (req: Request, res: Response) => Promise<void>;

const handle =
  (fn: AsyncHandler) => (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

const isUuid = (value: string): boolean => z.uuid().safeParse(value).success;

export const callsRouter = Router();

callsRouter.get(
  '/calls',
  handle(async (req, res) => {
    const status = CALL_STATUSES.find((s) => s === req.query.status) ?? null;
    res.json({ calls: await listCalls(status) });
  }),
);

callsRouter.get(
  '/calls/:id',
  handle(async (req, res) => {
    if (!isUuid(req.params.id)) {
      res.status(404).json({ error: 'Call not found' });
      return;
    }
    const call = await getCall(req.params.id);
    if (!call) {
      res.status(404).json({ error: 'Call not found' });
      return;
    }
    res.json({ call, summary: await getSummary(call.id) });
  }),
);

callsRouter.post(
  '/calls',
  handle(async (req, res) => {
    const parsed = browserCallSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid call', issues: parsed.error.issues });
      return;
    }

    const result = await ingestCall({
      ...parsed.data,
      externalId: `browser-${crypto.randomUUID()}`,
      source: 'browser',
      startedAt: new Date().toISOString(),
    });
    res.status(202).json(result);
  }),
);

callsRouter.post(
  '/calls/:id/assign',
  handle(async (req, res) => {
    const parsed = assignSchema.safeParse(req.body);
    if (!parsed.success || !isUuid(req.params.id)) {
      res.status(400).json({ error: 'Invalid assignment' });
      return;
    }
    try {
      await assignCall(req.params.id, parsed.data.clientId, parsed.data.coachId);
      res.status(202).json({ ok: true });
    } catch (error) {
      if (!(error instanceof AssignError)) throw error;
      res.status(error.status).json({ error: error.message });
    }
  }),
);

callsRouter.get(
  '/clients',
  handle(async (_req, res) => {
    res.json({ clients: await listClients() });
  }),
);

callsRouter.get('/demo/samples', (_req, res) => {
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

callsRouter.post(
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
