/**
 * LLM Service
 *
 * Entry point for structured generation. Calls the primary provider
 * (Gemini Flash) and falls back through LLM_SETTINGS.fallbacks (Gemini Flash
 * Lite, then Ollama) on infrastructure failures. Refusals are never routed to another provider.
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
  gemini: createGeminiProvider({
    name: 'gemini',
    model: () => LLM_SETTINGS.geminiModel,
    requestsPerMinute: () => LLM_SETTINGS.geminiRequestsPerMinute,
  }),
  'gemini-lite': createGeminiProvider({
    name: 'gemini-lite',
    model: () => LLM_SETTINGS.geminiLiteModel,
    requestsPerMinute: () => LLM_SETTINGS.geminiLiteRequestsPerMinute,
  }),
  ollama: createOllamaProvider(),
};

export const getProvider = (name: LLMProviderName): LLMProvider =>
  providers[name];

/** Primary followed by the fallbacks, in the order they are tried */
export const providerChain = (): LLMProviderName[] => [
  LLM_SETTINGS.primary,
  ...LLM_SETTINGS.fallbacks,
];

export const generateStructured = async <S extends z.ZodType>(
  request: StructuredRequest<S>,
): Promise<StructuredResult<z.infer<S>>> => {
  const chain = providerChain().map(getProvider);
  const startTime = Date.now();

  for (const [index, provider] of chain.entries()) {
    try {
      const result = await provider.generateStructured(request);
      log.info(
        `🤖 ${request.task}: ${result.provider}/${result.model}${index > 0 ? ' (fallback)' : ''}`,
        { ms: Date.now() - startTime },
      );
      return result;
    } catch (error) {
      const next = chain[index + 1];
      if (error instanceof LLMRefusalError || !next) {
        throw error;
      }
      log.warn(
        `⚠️ ${request.task}: ${provider.name} failed, falling back to ${next.name}`,
        { error },
      );
    }
  }

  // Unreachable: the chain always holds the primary, and the last provider rethrows
  throw new Error(`No LLM provider configured for task "${request.task}"`);
};
