/**
 * Directory API (read-only; coaches and clients come from the seed)
 *
 * GET /api/clients?coachId=        clients with call stats
 * GET /api/clients/:id             client + recent calls + call summaries
 * GET /api/coaches                 coaches with client and call counts
 * GET /api/coaches/:id             coach + clients + recent calls
 */

import { Router } from 'express';
import { listCalls, listClientSummaries } from '../db/callsRepo';
import { listClients, listCoaches } from '../db/directoryRepo';
import { handle, isUuid, uuidParam } from './helpers';

const RECENT_CALLS = 20;

export const directoryRouter = Router();

directoryRouter.get(
  '/clients',
  handle(async (req, res) => {
    res.json({ clients: await listClients({ coachId: uuidParam(req.query.coachId) }) });
  }),
);

directoryRouter.get(
  '/clients/:id',
  handle(async (req, res) => {
    const clientId = req.params.id;
    const [client] = isUuid(clientId) ? await listClients({ clientId }) : [];
    if (!client) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    const [calls, summaries] = await Promise.all([
      listCalls({ clientId, limit: RECENT_CALLS }),
      listClientSummaries(clientId),
    ]);
    res.json({ client, calls, summaries });
  }),
);

directoryRouter.get(
  '/coaches',
  handle(async (_req, res) => {
    res.json({ coaches: await listCoaches() });
  }),
);

directoryRouter.get(
  '/coaches/:id',
  handle(async (req, res) => {
    const coachId = req.params.id;
    const coach = isUuid(coachId)
      ? (await listCoaches()).find((c) => c.id === coachId)
      : undefined;
    if (!coach) {
      res.status(404).json({ error: 'Coach not found' });
      return;
    }

    const [clients, calls] = await Promise.all([
      listClients({ coachId }),
      listCalls({ coachId, limit: RECENT_CALLS }),
    ]);
    res.json({ coach, clients, calls });
  }),
);
