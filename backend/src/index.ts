import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { LLM_SETTINGS } from './config/aiModels';
import { checkDatabase, isDatabaseConfigured } from './db';
import { createLogger, errorMessage } from './lib/logger';
import { getProvider, providerChain } from './services/llm';
import { callsRouter } from './routes/calls';
import { demoRouter } from './routes/demo';
import { directoryRouter } from './routes/directory';
import { outboxRouter } from './routes/outbox';
import { getPipelineHealth, pipelineRouter } from './routes/pipeline';
import { reportsRouter } from './routes/reports';
import { slackRouter } from './routes/slack';
import { RawBodyRequest, webhooksRouter } from './routes/webhooks';
import { notifyDeadJob } from './services/alerts/opsAlerts';
import { JOB_HANDLERS } from './services/pipeline/jobHandlers';
import { createWorker } from './services/queue/worker';
import { startScheduler } from './services/scheduler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
const log = createLogger('server');

// Middleware
app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: true,
  }),
);
app.use(
  express.json({
    limit: '10mb',
    // Keep the raw bytes for webhook signature verification
    verify: (req, _res, buf) => {
      (req as RawBodyRequest).rawBody = buf;
    },
  }),
);

// Call pipeline, weekly reports, pipeline health and the mock integration outbox
app.use('/webhooks', webhooksRouter);
app.use('/api', callsRouter);
app.use('/api', directoryRouter);
app.use('/api', demoRouter);
app.use('/api', reportsRouter);
app.use('/api', outboxRouter);
app.use('/api', pipelineRouter);
app.use('/api', slackRouter);

/**
 * Health check for uptime monitors: 503 when the database is configured
 * but unreachable. Includes queue depth, the oldest due job, the last
 * reconcile and the last report run.
 */
app.get('/health', async (_req: Request, res: Response) => {
  const configured = isDatabaseConfigured();
  const database = configured
    ? (await checkDatabase())
      ? 'ok'
      : 'unreachable'
    : 'not_configured';

  let pipeline = null;
  if (database === 'ok') {
    try {
      const health = await getPipelineHealth();
      pipeline = {
        queue: {
          depth: health.queue.pending,
          ready: health.queue.ready,
          running: health.queue.running,
          dead: health.queue.dead,
          oldestReadyAgeSeconds: health.queue.oldest_ready_age_seconds,
        },
        lastReconcile: health.lastReconcile,
        lastReportRun: health.lastReportRun,
        nextRuns: {
          reports: health.schedules.reports.nextRunAt,
          reconcile: health.schedules.reconcile.nextRunAt,
        },
      };
    } catch (error) {
      log.error('❌ Health check could not read the queue', { error });
    }
  }

  res.status(database === 'unreachable' ? 503 : 200).json({
    status: database === 'unreachable' ? 'degraded' : 'ok',
    timestamp: new Date().toISOString(),
    database,
    ...pipeline,
    llm: {
      primary: `${LLM_SETTINGS.primary}/${getProvider(LLM_SETTINGS.primary).model()}`,
      fallbacks: LLM_SETTINGS.fallbacks.map(
        (name) => `${name}/${getProvider(name).model()}`,
      ),
    },
  });
});

// Error handling middleware
app.use(
  (err: Error, req: Request, res: Response, _next: express.NextFunction) => {
    log.error(`Server error on ${req.method} ${req.path}`, { error: errorMessage(err) });
    res
      .status(500)
      .json({ error: 'Internal server error', message: err.message });
  },
);

app.listen(PORT, () => {
  log.info(`🚀 Backend server running on http://localhost:${PORT}`);
  log.info(`📡 CORS enabled for: ${CORS_ORIGIN}`);
  log.info(
    `🤖 LLM: ${providerChain().join(' → ')}`,
  );

  if (isDatabaseConfigured()) {
    createWorker(JOB_HANDLERS, { onDead: notifyDeadJob }).start();
    void startScheduler();
  } else {
    log.warn('⚠️ DATABASE_URL not set: call pipeline worker and schedulers disabled');
  }
});
