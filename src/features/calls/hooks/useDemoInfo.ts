/**
 * useDemoInfo
 *
 * Mock integration modes, samples and the demo failure switches. The
 * switches clear on the server when used (the next call), so this polls
 * only while one is armed.
 */

import { useEffect, useState } from 'react';
import { LIVE_POLL_MS } from '../../../store/api';
import { useGetDemoInfoQuery } from '../services/callsApi';

export const useDemoInfo = () => {
  const [isArmed, setIsArmed] = useState(false);
  const query = useGetDemoInfoQuery(undefined, {
    pollingInterval: isArmed ? LIVE_POLL_MS : 0,
  });

  const { data } = query;
  useEffect(() => {
    setIsArmed(Boolean(data?.dropNextWebhook || data?.failNextCall));
  }, [data]);

  return query;
};
