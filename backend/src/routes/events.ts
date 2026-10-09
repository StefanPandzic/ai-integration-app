/**
 * Live Events API (Server-Sent Events)
 *
 * GET /api/events   text/event-stream
 *   event: invalidate   data: {"tags":["Call","Job",...]}   refetch these
 *   `: ping` comments every HEARTBEAT_MS keep proxies from closing it
 *
 * 503 while the LISTEN connection is down (and open streams are closed
 * then), so the UI knows to poll instead.
 */

import { Router } from 'express';
import { isLive, subscribeLive } from '../services/live/liveEvents';

const HEARTBEAT_MS = 25_000;

export const eventsRouter = Router();

eventsRouter.get('/events', (_req, res) => {
  if (!isLive()) {
    res.status(503).json({ error: 'Live updates unavailable' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 3000\n\n');

  const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS);
  const unsubscribe = subscribeLive((event) => {
    if (event.type === 'down') {
      res.end();
      return;
    }
    res.write(`event: invalidate\ndata: ${JSON.stringify({ tags: event.tags })}\n\n`);
  });

  res.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});
