/**
 * Calls API
 *
 * GET  /api/calls?status=&clientId=&coachId=&limit=&offset=
 *                                  list calls (review queue: status=needs_review)
 * GET  /api/calls/:id              call + summary + client/coach + latest job
 *                                  + outbox entries (Slack message, Drive doc)
 * POST /api/calls                  ingest a call from another source (API)
 * POST /api/calls/:id/assign       resolve a review-queue call
 */

import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { getCall, getSummary, listCalls } from '../db/callsRepo';
import { getClient, getCoach } from '../db/directoryRepo';
import { getLatestJobForCall } from '../db/jobsRepo';
import { findOutboxIdByExternalId } from '../db/outboxRepo';
import {
  AssignError,
  assignCall,
  ingestCall,
} from '../services/pipeline/ingest';
import { CallStatus, participantSchema } from '../types/pipeline';
import { handle, isUuid, uuidParam } from './helpers';

const CALL_STATUSES: CallStatus[] = [
  'received',
  'needs_review',
  'summarized',
  'posted',
  'failed',
];

const MAX_PAGE_SIZE = 200;

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

const pageSchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).catch(50),
  offset: z.coerce.number().int().min(0).catch(0),
});

export const callsRouter = Router();

callsRouter.get(
  '/calls',
  handle(async (req, res) => {
    const { limit, offset } = pageSchema.parse(req.query);
    const calls = await listCalls({
      status: CALL_STATUSES.find((s) => s === req.query.status) ?? null,
      clientId: uuidParam(req.query.clientId),
      coachId: uuidParam(req.query.coachId),
      limit,
      offset,
    });
    res.json({ calls });
  }),
);

callsRouter.get(
  '/calls/:id',
  handle(async (req, res) => {
    const call = isUuid(req.params.id) ? await getCall(req.params.id) : null;
    if (!call) {
      res.status(404).json({ error: 'Call not found' });
      return;
    }
    const [summary, client, coach, job, slackOutboxId, driveOutboxId] = await Promise.all([
      getSummary(call.id),
      call.client_id ? getClient(call.client_id) : null,
      call.coach_id ? getCoach(call.coach_id) : null,
      getLatestJobForCall(call.id),
      findOutboxIdByExternalId('slack', call.slack_message_ts),
      findOutboxIdByExternalId('drive', call.drive_file_id),
    ]);
    res.json({
      call,
      summary,
      client: client && { id: client.id, name: client.name },
      coach: coach && { id: coach.id, name: coach.name },
      job,
      outbox: { slack: slackOutboxId, drive: driveOutboxId },
    });
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
