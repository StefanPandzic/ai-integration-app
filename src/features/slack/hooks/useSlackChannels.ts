/**
 * useSlackChannels
 *
 * Workspace channels for SlackChannelSelect. Refresh asks the backend to
 * skip its few-minute cache, e.g. after inviting the bot to a private channel.
 */

import { useCallback, useState } from 'react';
import { getErrorMessage } from '../../../store/api';
import { useListSlackChannelsQuery } from '../services/slackApi';
import type { SlackChannelOptions } from '../types';

export const useSlackChannels = (): SlackChannelOptions => {
  const [refreshKey, setRefreshKey] = useState(0);
  const { data, isFetching, error } = useListSlackChannelsQuery(refreshKey);
  const onRefresh = useCallback(() => setRefreshKey((key) => key + 1), []);

  return {
    channels: data?.channels ?? [],
    mode: data?.mode ?? null,
    isLoading: isFetching,
    error: getErrorMessage(error),
    onRefresh,
  };
};
