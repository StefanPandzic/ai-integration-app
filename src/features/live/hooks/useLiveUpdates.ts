/**
 * useLiveUpdates
 *
 * Opens the backend's Server-Sent Events stream (/api/events) and
 * invalidates the tags each event names, so pages refetch the moment the
 * pipeline changes something. Tracks the connection in the `live` slice
 * (useLivePollInterval polls fast only while it is down). The browser
 * reconnects dropped streams itself; a refused one (503: the backend lost
 * its database listener) is retried after RETRY_MS. After any gap,
 * everything is refetched once, since events may have been missed.
 */

import { useEffect } from 'react';
import { api, BACKEND_URL } from '../../../store/api';
import { useAppDispatch } from '../../../store/hooks';
import { setLiveConnected } from '../../../store/slices/liveSlice';
import { createLogger } from '../../logging';
import { LIVE_TAGS, type InvalidateEvent, type LiveTag } from '../types';

const RETRY_MS = 5_000;

const logger = createLogger('live');

const isLiveTag = (value: unknown): value is LiveTag =>
  LIVE_TAGS.some((tag) => tag === value);

const parseTags = (data: string): LiveTag[] => {
  try {
    const parsed = JSON.parse(data) as Partial<InvalidateEvent>;
    return Array.isArray(parsed.tags) ? parsed.tags.filter(isLiveTag) : [];
  } catch {
    logger.warn('Ignoring malformed live event:', data);
    return [];
  }
};

export const useLiveUpdates = () => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let hadGap = false;

    const open = () => {
      source = new EventSource(`${BACKEND_URL}/api/events`);

      source.onopen = () => {
        logger.debug('Live updates connected');
        if (hadGap) dispatch(api.util.invalidateTags([...LIVE_TAGS]));
        hadGap = false;
        dispatch(setLiveConnected(true));
      };

      source.addEventListener('invalidate', (event: MessageEvent<string>) => {
        const tags = parseTags(event.data);
        if (tags.length > 0) dispatch(api.util.invalidateTags(tags));
      });

      source.onerror = () => {
        hadGap = true;
        dispatch(setLiveConnected(false));
        if (source?.readyState === EventSource.CLOSED) {
          logger.debug(`Live updates refused; retrying in ${RETRY_MS / 1000}s`);
          source.close();
          retryTimer = setTimeout(open, RETRY_MS);
        }
      };
    };

    open();
    return () => {
      clearTimeout(retryTimer);
      source?.close();
      dispatch(setLiveConnected(false));
    };
  }, [dispatch]);
};
