/**
 * AI Query Service (Backend)
 *
 * Orchestrates the three-stage AI pipeline:
 * 1. Intent Routing (RAG-based semantic routing)
 * 2. RAG Context Retrieval
 * 3. Ollama Call + Response Parsing
 */

import { Response } from 'express';
import { getOllamaConfig } from '../config/ollamaConfig';
import { callOllamaEmbedApi } from './embedClient';
import { callOllamaApiSSE } from './ollamaClient';
import {
  cosineSimilarity,
  retrieveRelevant,
  formatContext,
} from './ragService';
import {
  isKnowledgeQuestion,
  adjustThreshold,
  hasInformationalIntent,
} from './intentRouting';
import { buildSystemPrompt } from './promptBuilder';
import { extractAndParseCommand } from './jsonParser';
import { APP_FEATURES } from '../config/appKnowledgeBase';
import { INTENT_ROUTING_THRESHOLD } from '../constants';
import { Transcription, Command, CommandBatch } from '../types';

interface QueryResult {
  command?: Command;
  commandBatch?: CommandBatch;
  response: string;
  thinking: string;
  mode: '💬 general' | '📚 app-info' | '⚡ commands';
}

// Cache feature embeddings in memory (generated once on startup)
let featureEmbeddingsCache: number[][] | null = null;

/**
 * Initialize feature embeddings cache
 */
export const initializeFeatureEmbeddings = async (): Promise<void> => {
  if (featureEmbeddingsCache) {
    return; // Already initialized
  }

  console.log('🔄 Generating feature embeddings...');
  const config = getOllamaConfig();
  const startTime = Date.now();

  const embeddings: number[][] = [];
  for (const feature of APP_FEATURES) {
    const embedding = await callOllamaEmbedApi(config, feature.description);
    embeddings.push(embedding);
  }

  featureEmbeddingsCache = embeddings;
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(
    `✅ Feature embeddings cached (${embeddings.length} features, ${duration}s)`,
  );
};

/**
 * Invalidate feature embeddings cache (forces re-initialization on next query)
 */
export const invalidateEmbeddingsCache = (): void => {
  featureEmbeddingsCache = null;
  console.log('🔄 Feature embeddings cache invalidated');
};

/**
 * Process AI query with SSE streaming
 * Supports optional image attachment for vision-capable models
 *
 * @param text - User's natural language input
 * @param transcriptionHistory - Previous conversation history for RAG
 * @param res - Express Response object for SSE
 * @param image - Optional base64-encoded image for vision queries
 */
export const processQuery = async (
  text: string,
  transcriptionHistory: Transcription[],
  res: Response,
  image?: string,
): Promise<QueryResult> => {
  const config = getOllamaConfig();

  console.log('\n━━━ AI Query Pipeline ━━━');
  console.log(`📥 Input: "${text}"`);

  // STAGE 1: Intent Routing (RAG-based semantic routing)
  console.log('\n📍 STAGE 1: Intent Routing');

  // Generate query embedding
  const queryEmbedding = await callOllamaEmbedApi(config, text);
  console.log(`  ├─ Query embedding generated (${queryEmbedding.length}D)`);

  // Ensure feature embeddings are cached
  if (!featureEmbeddingsCache) {
    await initializeFeatureEmbeddings();
  }

  // Calculate similarity to each app feature
  const similarities = featureEmbeddingsCache!.map((featureEmbed, idx) => ({
    feature: APP_FEATURES[idx],
    score: cosineSimilarity(queryEmbedding, featureEmbed),
  }));

  const maxSimilarity = Math.max(...similarities.map((s) => s.score));
  const isQuestion = isKnowledgeQuestion(text);
  const threshold = adjustThreshold(INTENT_ROUTING_THRESHOLD, isQuestion);

  console.log(
    `  ├─ Max similarity: ${maxSimilarity.toFixed(3)} (threshold: ${threshold.toFixed(3)})`,
  );
  console.log(`  ├─ Is question: ${isQuestion}`);

  // Route based on similarity
  let mode: '💬 general' | '📚 app-info' | '⚡ commands';
  let isRegularText: boolean;
  let appContext: string | undefined;

  if (maxSimilarity < threshold) {
    // Low similarity → 💬 General Questions
    mode = '💬 general';
    isRegularText = true;
    appContext = undefined;
    console.log(`  └─ Routed to: ${mode} (low similarity)`);
  } else if (hasInformationalIntent(text) || isQuestion) {
    // High similarity + informational → 📚 App Related Questions
    mode = '📚 app-info';
    isRegularText = true;
    const topFeature = similarities.find((s) => s.score === maxSimilarity);
    appContext = topFeature ? topFeature.feature.description : undefined;
    console.log(
      `  └─ Routed to: ${mode} (informational intent, feature: ${topFeature?.feature.id})`,
    );
  } else {
    // High similarity + action → ⚡ Commands
    mode = '⚡ commands';
    isRegularText = false;
    appContext = undefined;
    console.log(`  └─ Routed to: ${mode} (action intent)`);
  }

  // STAGE 2: RAG Context Retrieval
  console.log('\n📚 STAGE 2: RAG Context Retrieval');
  const relevantTranscriptions = retrieveRelevant(
    queryEmbedding,
    transcriptionHistory,
    3,
  );
  const ragContext =
    relevantTranscriptions.length > 0
      ? formatContext(relevantTranscriptions)
      : undefined;

  if (ragContext) {
    console.log(
      `  └─ Context length: ${ragContext.length} chars (~${Math.round(ragContext.length / 4)} tokens)`,
    );
  } else {
    console.log(`  └─ No relevant context found`);
  }

  // STAGE 3: Ollama Call + Response Parsing
  console.log('\n🤖 STAGE 3: Ollama Call');
  const systemPrompt = buildSystemPrompt(isRegularText, ragContext, appContext);

  console.log(`  ├─ Prompt tokens: ~${Math.round(systemPrompt.length / 4)}`);
  console.log(`  ├─ Mode: ${mode}`);
  console.log(`  ├─ Image attached: ${image ? 'YES' : 'NO'}`);
  console.log(`  ├─ Calling Ollama with streaming...`);

  // Call Ollama Chat API (supports both text-only and vision queries)
  const { response, thinking } = await callOllamaApiSSE(
    config,
    systemPrompt,
    text,
    image || null,
    res,
  );

  console.log(`  └─ Response received (${response.length} chars)`);

  // Parse response for commands
  const parseResult = extractAndParseCommand(response);
  let command: Command | undefined;
  let commandBatch: CommandBatch | undefined;

  if (parseResult.success) {
    command = parseResult.command;
    commandBatch = parseResult.commandBatch;
  } else if (parseResult.error) {
    console.error('❌ Command parsing failed:', parseResult.error);
    // Surface error to frontend via response
    res.write(`event: parseError\n`);
    res.write(
      `data: ${JSON.stringify({ error: parseResult.error, rawResponse: response })}\n\n`,
    );
  }

  console.log('━━━ Pipeline Complete ━━━\n');

  return {
    command,
    commandBatch,
    response,
    thinking,
    mode,
  };
};
