/**
 * LLM Service
 *
 * Entry point for structured generation. Calls the primary provider
 * (Claude) and falls back to the secondary (Ollama) on infrastructure
 * failures. Refusals are never routed to another provider.
 */

import { z } from 'zod';
import { LLM_SETTINGS, LLMProviderName } from '../../config/aiModels';
import { createClaudeProvider } from './claudeProvider';
import { createOllamaProvider } from './ollamaProvider';
import {
  LLMProvider,
  LLMRefusalError,
  StructuredRequest,
  StructuredResult,
} from './types';

export * from './types';

const providers: Record<LLMProviderName, LLMProvider> = {
  claude: createClaudeProvider(),
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
    console.log(
      `🤖 ${request.task}: ${result.provider}/${result.model} in ${Date.now() - startTime}ms`,
    );
    return result;
  } catch (error) {
    if (error instanceof LLMRefusalError || !LLM_SETTINGS.fallback) {
      throw error;
    }

    const fallback = providers[LLM_SETTINGS.fallback];
    console.warn(
      `⚠️ ${request.task}: ${primary.name} failed, falling back to ${fallback.name}:`,
      error instanceof Error ? error.message : error,
    );

    const result = await fallback.generateStructured(request);
    console.log(
      `🤖 ${request.task}: ${result.provider}/${result.model} (fallback) in ${Date.now() - startTime}ms`,
    );
    return result;
  }
};
