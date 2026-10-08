/**
 * Slack API (client channel picker)
 *
 * GET /api/slack/channels?refresh=1   workspace channels by name, with whether
 *                                     the bot is in each ({ mode, channels });
 *                                     cached a few minutes unless refresh=1
 */

import { Router } from 'express';
import { getSlackMode } from '../config/integrations';
import { SlackChannelError, listSlackChannels } from '../services/slack/slackChannels';
import { handle } from './helpers';

export const slackRouter = Router();

slackRouter.get(
  '/slack/channels',
  handle(async (req, res) => {
    try {
      const channels = await listSlackChannels(req.query.refresh === '1');
      res.json({ mode: getSlackMode(), channels });
    } catch (error) {
      if (!(error instanceof SlackChannelError)) throw error;
      res.status(error.status).json({ error: error.message });
    }
  }),
);
