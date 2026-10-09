/**
 * useDemoInfo
 *
 * Mock integration modes, samples and the demo failure switches. The
 * switches clear on the server when used (the next call), so this polls
 * only while one is armed.
 */

import { useEffect, useState } from 'react';
import { useLivePollInterval } from '../../live';
import { useGetDemoInfoQuery } from '../services/callsApi';

export const useDemoInfo = () => {
  const pollingInterval = useLivePollInterval();
  const [isArmed, setIsArmed] = useState(false);
  const query = useGetDemoInfoQuery(undefined, {
    pollingInterval: isArmed ? pollingInterval : 0,
  });

  const { data } = query;
  useEffect(() => {
    setIsArmed(Boolean(data?.dropNextWebhook || data?.failNextCall));
  }, [data]);

  return query;
};
