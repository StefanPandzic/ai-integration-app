/**
 * RAG Service (Backend)
 *
 * Semantic search over transcription history and intent routing
 */

import { Transcription } from '../types';

/**
 * Calculate cosine similarity between two vectors
 */
export const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
  if (vecA.length !== vecB.length || vecA.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
};

/**
 * Format transcriptions as context string for prompt
 */
export const formatContext = (transcriptions: Transcription[]): string => {
  const MAX_CHARS = 6000;
  let context = '';

  for (const t of transcriptions) {
    const timestamp = new Date(t.timestamp).toLocaleTimeString();
    const entry = `[${timestamp}] ${t.text}\n${t.aiResponse ? `AI: ${t.aiResponse}\n` : ''}---\n`;

    if (context.length + entry.length > MAX_CHARS) {
      break;
    }

    context += entry;
  }

  return context.trim();
};

/**
 * Retrieve most relevant transcriptions using semantic search
 */
export const retrieveRelevant = (
  queryEmbedding: number[],
  history: Transcription[],
  k: number = 3,
): Transcription[] => {
  const itemsWithEmbeddings = history.filter(
    (t) => t.embedding && t.embedding.length > 0,
  );

  if (itemsWithEmbeddings.length === 0) {
    console.log('  ├─ No embeddings available for RAG');
    return [];
  }

  if (queryEmbedding.length === 0) {
    console.warn('  ├─ Empty query embedding');
    return [];
  }

  const scored = itemsWithEmbeddings.map((t) => ({
    transcription: t,
    score: cosineSimilarity(queryEmbedding, t.embedding!),
  }));

  const topK = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((item) => item.transcription);

  console.log(
    `  ├─ Retrieved ${topK.length} relevant items (scores: ${scored
      .slice(0, k)
      .map((s) => s.score.toFixed(3))
      .join(', ')})`,
  );

  return topK;
};
