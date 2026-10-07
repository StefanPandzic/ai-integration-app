/**
 * Backend API Service (Frontend)
 *
 * Communicates with backend for AI queries and embeddings
 * Replaces direct Ollama integration with SSE streaming from backend
 */

import { createLogger } from '../../logging';
import type { Transcription } from '../types/transcription';
import type { Command, CommandBatch } from '../types/commands';

const logger = createLogger('ai');

interface BackendConfig {
  baseUrl: string;
}

interface QueryResponse {
  response: string;
  command?: Command;
  commandBatch?: CommandBatch;
  mode: string;
}

/**
 * Factory function that creates a backend API service instance
 */
export const BackendService = () => {
  const config: BackendConfig = {
    baseUrl: import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001',
  };

  /**
   * Query backend with SSE streaming for thinking
   *
   * @param text - User input text
   * @param history - Transcription history for RAG context
   * @param image - Optional base64-encoded image for vision queries
   * @param onThinking - Callback for thinking chunks
   * @param onComplete - Callback for final response
   * @param onError - Callback for errors
   */
  const queryWithStreaming = async (
    text: string,
    history: Transcription[],
    image?: string | null,
    onThinking?: (chunk: string) => void,
    onComplete?: (result: QueryResponse) => void,
    onError?: (error: Error) => void,
  ): Promise<void> => {
    try {
      logger.info('🌐 Sending query to backend:', text);
      if (image) {
        logger.info('🖼️ Image attached (vision mode)');
      }

      const response = await fetch(`${config.baseUrl}/api/ai/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          transcriptionHistory: history,
          ...(image && { image }),
        }),
      });

      if (!response.ok) {
        throw new Error(`Backend API error: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      // Process SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          logger.debug('🏁 SSE stream ended');
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          if (line.startsWith('event:')) {
            // Event type is on separate line, skip it
            continue;
          }

          if (line.startsWith('data:')) {
            const data = line.substring(5).trim();

            try {
              const parsed = JSON.parse(data);

              // Check which event type this is
              if (parsed.text !== undefined && onThinking) {
                // thinking event
                onThinking(parsed.text);
              } else if (parsed.response !== undefined && onComplete) {
                // complete event
                onComplete(parsed as QueryResponse);
              } else if (parsed.error && onError) {
                // error event
                onError(new Error(parsed.message || parsed.error));
              }
            } catch (e) {
              logger.warn('Failed to parse SSE data:', data);
            }
          }
        }
      }
    } catch (error) {
      logger.error('❌ Backend query error:', error);
      if (onError) {
        onError(error instanceof Error ? error : new Error('Unknown error'));
      }
    }
  };

  /**
   * Generate embeddings for texts
   *
   * @param texts - Array of texts to generate embeddings for
   * @returns Promise with array of embedding vectors
   */
  const generateEmbeddings = async (texts: string[]): Promise<number[][]> => {
    try {
      logger.debug(`📊 Generating embeddings for ${texts.length} texts`);

      const response = await fetch(`${config.baseUrl}/api/ai/embed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ texts }),
      });

      if (!response.ok) {
        throw new Error(`Backend embeddings API error: ${response.statusText}`);
      }

      const data = await response.json();
      logger.debug(`✅ Received ${data.embeddings.length} embeddings`);
      return data.embeddings;
    } catch (error) {
      logger.error('❌ Embedding generation error:', error);
      throw error;
    }
  };

  /**
   * Get available models from backend
   *
   * @returns Promise with array of model metadata
   */
  const getAvailableModels = async (): Promise<
    Array<{
      name: string;
      type: 'local' | 'cloud';
      requiresAuth: boolean;
      apiUrl: string;
    }>
  > => {
    try {
      logger.debug('🔍 Fetching available models');

      const response = await fetch(`${config.baseUrl}/api/config/models`);

      if (!response.ok) {
        throw new Error(`Backend models API error: ${response.statusText}`);
      }

      const data = await response.json();
      logger.debug(`✅ Received ${data.models.length} models`);
      return data.models;
    } catch (error) {
      logger.error('❌ Failed to fetch models:', error);
      throw error;
    }
  };

  /**
   * Set active model on backend
   *
   * @param modelName - Name of model to activate
   * @returns Promise with updated model configuration
   */
  const setActiveModel = async (
    modelName: string,
  ): Promise<{ success: boolean; model: string; apiUrl: string }> => {
    try {
      logger.info(`🔄 Setting active model to: ${modelName}`);

      const response = await fetch(`${config.baseUrl}/api/config/model`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: modelName }),
      });

      if (!response.ok) {
        throw new Error(
          `Backend model update API error: ${response.statusText}`,
        );
      }

      const data = await response.json();
      logger.info(`✅ Model updated: ${data.model} at ${data.apiUrl}`);
      return data;
    } catch (error) {
      logger.error('❌ Failed to set model:', error);
      throw error;
    }
  };

  return {
    queryWithStreaming,
    generateEmbeddings,
    getAvailableModels,
    setActiveModel,
  };
};
