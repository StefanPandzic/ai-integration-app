/**
 * Directory API (coaches and clients come from the seed and the review queue)
 *
 * GET   /api/clients?coachId=      clients with call stats
 * GET   /api/clients/:id           client + recent calls + call summaries
 * PATCH /api/clients/:id/slack-channel
 *                                  { slackChannelId }: checks the channel (the
 *                                  bot joins it if public), then saves it
 * GET /api/coaches                 coaches with client and call counts
 * GET /api/coaches/:id             coach + clients + recent calls + latest
 *                                  weekly report and rubric trend
 */

import { Router } from 'express';
import { z } from 'zod';
import { listCalls, listClientSummaries } from '../db/callsRepo';
import { getClient, listClients, listCoaches, updateClientChannel } from '../db/directoryRepo';
import { listReports } from '../db/reportsRepo';
import {
  SlackChannelError,
  prepareClientChannel,
  slackChannelIdSchema,
} from '../services/slack/slackChannels';
import { handle, isUuid, uuidParam } from './helpers';

const channelUpdateSchema = z.object({ slackChannelId: slackChannelIdSchema });

const RECENT_CALLS = 20;
const REPORT_TREND_WEEKS = 8;

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

directoryRouter.patch(
  '/clients/:id/slack-channel',
  handle(async (req, res) => {
    const client = isUuid(req.params.id) ? await getClient(req.params.id) : null;
    if (!client) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }
    const parsed = channelUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    try {
      const channel = await prepareClientChannel(parsed.data.slackChannelId);
      await updateClientChannel(client.id, channel.id);
      res.json({ channel });
    } catch (error) {
      if (!(error instanceof SlackChannelError)) throw error;
      res.status(error.status).json({ error: error.message });
    }
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

    const [clients, calls, reports] = await Promise.all([
      listClients({ coachId }),
      listCalls({ coachId, limit: RECENT_CALLS }),
      listReports({ type: 'coach', coachId, limit: REPORT_TREND_WEEKS }),
    ]);
    const latest = reports[0];
    res.json({
      coach,
      clients,
      calls,
      latestReport: latest
        ? {
            id: latest.id,
            period_start: latest.period_start,
            period_end: latest.period_end,
            status: latest.status,
            rubric_average: latest.rubric_average,
          }
        : null,
      // Oldest first, for the rubric trend
      reportTrend: reports
        .map(({ id, period_start, status, calls: callCount, rubric_average }) => ({
          id,
          period_start,
          status,
          calls: callCount,
          rubric_average,
        }))
        .reverse(),
    });
  }),
);
