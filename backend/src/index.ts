import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import {
  processQuery,
  initializeFeatureEmbeddings,
  invalidateEmbeddingsCache,
} from './services/queryService';
import { batchEmbeddings } from './services/embedClient';
import { getOllamaConfig, setModelConfig } from './config/ollamaConfig';
import { getAvailableModels, LLM_SETTINGS } from './config/aiModels';
import { checkDatabase, isDatabaseConfigured } from './db';
import { getProvider } from './services/llm';
import { callsRouter } from './routes/calls';
import { RawBodyRequest, webhooksRouter } from './routes/webhooks';
import { JOB_HANDLERS } from './services/pipeline/jobHandlers';
import { createWorker } from './services/queue/worker';
import { QueryRequest, EmbedRequest, EmbedResponse } from './types';

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

// SSE endpoint for AI queries with streaming
app.post('/api/ai/query', async (req: Request, res: Response) => {
  try {
    const { text, transcriptionHistory, image } = req.body as QueryRequest;

    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'Invalid request: text is required' });
      return;
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Process query with streaming (with optional image)
    const result = await processQuery(
      text,
      transcriptionHistory || [],
      res,
      image,
    );

    // Send final complete event
    res.write(`event: complete\n`);
    res.write(
      `data: ${JSON.stringify({
        response: result.response,
        command: result.command,
        commandBatch: result.commandBatch,
        mode: result.mode,
      })}\n\n`,
    );

    res.end();
  } catch (error) {
    console.error('Error processing query:', error);

    // Send error event via SSE
    res.write(`event: error\n`);
    res.write(
      `data: ${JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      })}\n\n`,
    );
    res.end();
  }
});

// Embedding endpoint for batch embedding generation
app.post('/api/ai/embed', async (req: Request, res: Response) => {
  try {
    const { texts } = req.body as EmbedRequest;

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      res
        .status(400)
        .json({ error: 'Invalid request: texts array is required' });
      return;
    }

    const config = getOllamaConfig();
    const embeddings = await batchEmbeddings(config, texts);

    const response: EmbedResponse = { embeddings };
    res.json(response);
  } catch (error) {
    console.error('Error generating embeddings:', error);
    res.status(500).json({
      error: 'Failed to generate embeddings',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get available models endpoint
app.get('/api/config/models', (_req: Request, res: Response) => {
  try {
    const models = getAvailableModels();
    res.json({ models });
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json({
      error: 'Failed to fetch available models',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Set active model endpoint
app.put('/api/config/model', async (req: Request, res: Response) => {
  try {
    const { model } = req.body;

    if (!model || typeof model !== 'string') {
      res.status(400).json({ error: 'Invalid request: model is required' });
      return;
    }

    // Update model configuration
    setModelConfig(model);

    // Invalidate embeddings cache (will be regenerated on next query)
    invalidateEmbeddingsCache();

    // Reinitialize embeddings with new model
    await initializeFeatureEmbeddings();

    const config = getOllamaConfig();
    res.json({
      success: true,
      model: config.model,
      apiUrl: config.apiUrl,
    });
  } catch (error) {
    console.error('Error setting model:', error);
    res.status(400).json({
      error: 'Failed to set model',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
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

// Initialize feature embeddings cache and start server
const startServer = async () => {
  try {
    console.log('🔄 Initializing backend...');
    await initializeFeatureEmbeddings();

    app.listen(PORT, () => {
      console.log(`🚀 Backend server running on http://localhost:${PORT}`);
      console.log(`📡 CORS enabled for: ${CORS_ORIGIN}`);
      console.log(
        `🤖 Ollama API: ${process.env.OLLAMA_API_URL || 'http://localhost:11434'}`,
      );
      console.log('✅ Ready to accept requests');

      if (isDatabaseConfigured()) {
        createWorker(JOB_HANDLERS).start();
      } else {
        console.warn('⚠️ DATABASE_URL not set: call pipeline worker disabled');
      }
    });
  } catch (error) {
    console.error('❌ Failed to initialize backend:', error);
    process.exit(1);
  }
};

startServer();
