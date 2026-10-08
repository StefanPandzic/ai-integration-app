/**
 * Slack API (RTK Query endpoint for /api/slack/channels)
 */

import { api } from '../../../store/api';
import type { SlackChannelList } from '../types';

export const slackApi = api.injectEndpoints({
  endpoints: (build) => ({
    /** Arg > 0 bypasses the backend's channel cache (Refresh button) */
    listSlackChannels: build.query<SlackChannelList, number>({
      query: (refreshKey) => ({
        url: '/api/slack/channels',
        params: refreshKey > 0 ? { refresh: 1 } : {},
      }),
      providesTags: ['SlackChannel'],
    }),
  }),
});

export const { useListSlackChannelsQuery } = slackApi;
