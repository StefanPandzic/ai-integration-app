/**
 * useLivePollInterval
 *
 * The polling interval for live server state: a slow safety net while the
 * live-updates stream is open (events trigger the refetches), LIVE_POLL_MS
 * while it is down.
 */

import { LIVE_POLL_MS, LIVE_SAFETY_POLL_MS } from '../../../store/api';
import { useAppSelector } from '../../../store/hooks';

export const useLivePollInterval = (): number => {
  const connected = useAppSelector((state) => state.live.connected);
  return connected ? LIVE_SAFETY_POLL_MS : LIVE_POLL_MS;
};
