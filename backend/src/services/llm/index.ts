/**
 * LLM Service
 *
 * Entry point for structured generation. Calls the primary provider
 * (Gemini) and falls back to the secondary (Ollama) on infrastructure
 * failures. Refusals are never routed to another provider.
 */

import { z } from 'zod';
import { LLM_SETTINGS, LLMProviderName } from '../../config/aiModels';
import { createLogger } from '../../lib/logger';
import { createGeminiProvider } from './geminiProvider';
import { createOllamaProvider } from './ollamaProvider';
import {
  LLMProvider,
  LLMRefusalError,
  StructuredRequest,
  StructuredResult,
} from './types';

export * from './types';

const log = createLogger('llm');

const providers: Record<LLMProviderName, LLMProvider> = {
  gemini: createGeminiProvider(),
  ollama: createOllamaProvider(),
};

export const getProvider = (name: LLMProviderName): LLMProvider =>
  providers[name];

export const generateStructured = async <S extends z.ZodType>(
  request: StructuredRequest<S>,
): Promise<StructuredResult<z.infer<S>>> => {
  const primary = providers[LLM_SETTINGS.primary];
  const startTime = Date.now();

  try {
    const result = await primary.generateStructured(request);
    log.info(`🤖 ${request.task}: ${result.provider}/${result.model}`, {
      ms: Date.now() - startTime,
    });
    return result;
  } catch (error) {
    if (error instanceof LLMRefusalError || !LLM_SETTINGS.fallback) {
      throw error;
    }

    const fallback = providers[LLM_SETTINGS.fallback];
    log.warn(
      `⚠️ ${request.task}: ${primary.name} failed, falling back to ${fallback.name}`,
      { error },
    );

    const result = await fallback.generateStructured(request);
    log.info(`🤖 ${request.task}: ${result.provider}/${result.model} (fallback)`, {
      ms: Date.now() - startTime,
    });
    return result;
  }
};
