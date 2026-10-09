/**
 * useCallDetail
 *
 * Fetches one call and keeps polling only while the pipeline is still
 * working on it (no job running or queued for a retry).
 */

import { skipToken } from '@reduxjs/toolkit/query';
import { useEffect, useState } from 'react';
import { useLivePollInterval } from '../../live';
import { useGetCallQuery } from '../services/callsApi';
import type { CallDetail } from '../types';

const isSettled = (detail: CallDetail): boolean =>
  detail.call.status !== 'received' &&
  detail.job?.status !== 'running' &&
  detail.job?.status !== 'pending';

export const useCallDetail = (callId: string | undefined) => {
  const pollingInterval = useLivePollInterval();
  const [isLive, setIsLive] = useState(true);
  const query = useGetCallQuery(callId ?? skipToken, {
    pollingInterval: isLive ? pollingInterval : 0,
  });

  const { data } = query;
  useEffect(() => {
    if (data) setIsLive(!isSettled(data));
  }, [data]);

  return query;
};
