import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { LLM_SETTINGS } from './config/aiModels';
import { checkDatabase, isDatabaseConfigured } from './db';
import { getProvider } from './services/llm';
import { callsRouter } from './routes/calls';
import { demoRouter } from './routes/demo';
import { directoryRouter } from './routes/directory';
import { RawBodyRequest, webhooksRouter } from './routes/webhooks';
import { JOB_HANDLERS } from './services/pipeline/jobHandlers';
import { createWorker } from './services/queue/worker';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

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

// Call pipeline
app.use('/webhooks', webhooksRouter);
app.use('/api', callsRouter);
app.use('/api', directoryRouter);
app.use('/api', demoRouter);

// Health check endpoint
app.get('/health', async (_req: Request, res: Response) => {
  const database = isDatabaseConfigured()
    ? (await checkDatabase())
      ? 'ok'
      : 'unreachable'
    : 'not_configured';

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database,
    llm: {
      primary: `${LLM_SETTINGS.primary}/${getProvider(LLM_SETTINGS.primary).model()}`,
      fallback: LLM_SETTINGS.fallback
        ? `${LLM_SETTINGS.fallback}/${getProvider(LLM_SETTINGS.fallback).model()}`
        : null,
    },
  });
});

// Error handling middleware
app.use(
  (err: Error, _req: Request, res: Response, _next: express.NextFunction) => {
    console.error('Server error:', err);
    res
      .status(500)
      .json({ error: 'Internal server error', message: err.message });
  },
);

app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📡 CORS enabled for: ${CORS_ORIGIN}`);
  console.log(
    `🤖 LLM: ${LLM_SETTINGS.primary}${LLM_SETTINGS.fallback ? ` (fallback ${LLM_SETTINGS.fallback})` : ''}`,
  );

  if (isDatabaseConfigured()) {
    createWorker(JOB_HANDLERS).start();
  } else {
    console.warn('⚠️ DATABASE_URL not set: call pipeline worker disabled');
  }
});
