/**
 * Outbox API: what the mock Slack and Drive connectors sent and saved
 *
 * GET /api/outbox?service=slack|drive&target=&limit=   newest first (no Drive HTML)
 * GET /api/outbox/:id                                   one item, full payload
 */

import { Router } from 'express';
import { z } from 'zod';
import { OutboxService, getOutboxItem, listOutbox } from '../db/outboxRepo';
import { handle, isUuid } from './helpers';

const SERVICES: OutboxService[] = ['slack', 'drive'];

const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).catch(200),
  target: z.string().min(1).max(200).optional().catch(undefined),
});

export const outboxRouter = Router();

outboxRouter.get(
  '/outbox',
  handle(async (req, res) => {
    const { limit, target } = listSchema.parse(req.query);
    const items = await listOutbox({
      service: SERVICES.find((s) => s === req.query.service) ?? null,
      target: target ?? null,
      limit,
    });
    res.json({ items });
  }),
);

outboxRouter.get(
  '/outbox/:id',
  handle(async (req, res) => {
    const item = isUuid(req.params.id) ? await getOutboxItem(req.params.id) : null;
    if (!item) {
      res.status(404).json({ error: 'Outbox item not found' });
      return;
    }
    res.json({ item });
  }),
);
