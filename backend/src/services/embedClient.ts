/**
 * Ollama Embeddings API Client (Backend)
 *
 * HTTP client for Ollama /api/embeddings endpoint
 */

import { OllamaConfig } from '../config/ollamaConfig';

interface OllamaEmbedRequest {
  model: string;
  prompt: string;
}

interface OllamaEmbedResponse {
  embedding: number[];
}

/**
 * Call Ollama API embeddings endpoint
 *
 * @param config - Ollama configuration (API URL and embed model)
 * @param text - Text to generate embedding for
 * @returns Promise with embedding vector
 * @throws Error if API call fails
 */
export const callOllamaEmbedApi = async (
  config: OllamaConfig,
  text: string,
): Promise<number[]> => {
  const request: OllamaEmbedRequest = {
    model: config.embedModel,
    prompt: text,
  };

  // Always use local embedApiUrl (no auth needed)
  const response = await fetch(`${config.embedApiUrl}/api/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Ollama embeddings API error: ${response.statusText}`);
  }

  const data = (await response.json()) as OllamaEmbedResponse;
  return data.embedding;
};

/**
 * Batch generate embeddings for multiple texts
 *
 * @param config - Ollama configuration
 * @param texts - Array of texts to generate embeddings for
 * @returns Promise with array of embedding vectors
 */
export const batchEmbeddings = async (
  config: OllamaConfig,
  texts: string[],
): Promise<number[][]> => {
  const embeddings: number[][] = [];

  for (const text of texts) {
    const embedding = await callOllamaEmbedApi(config, text);
    embeddings.push(embedding);
  }

  return embeddings;
};
