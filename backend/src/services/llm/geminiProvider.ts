/**
 * Gemini Provider
 *
 * Uses Gemini structured outputs (responseJsonSchema) so the response is
 * constrained to the zod schema by the API, then re-validates with zod.
 * Safety blocks are reported as refusals. One factory serves every Gemini
 * model (Flash, Flash Lite), each rate limited client-side.
 */

import type { GoogleGenAI } from '@google/genai' with { 'resolution-mode': 'import' };
import { z } from 'zod';
import { LLM_SETTINGS, LLMProviderName } from '../../config/aiModels';
import { acquire } from '../rateLimit';
import {
  LLMOutputError,
  LLMProvider,
  LLMRefusalError,
  StructuredRequest,
  StructuredResult,
  formatZodIssues,
} from './types';

const GEMINI_BURST = 2;

// Finish reasons where Gemini declined to answer (vs. a broken answer)
const REFUSAL_REASONS = new Set<string>([
  'SAFETY',
  'BLOCKLIST',
  'PROHIBITED_CONTENT',
  'SPII',
  'RECITATION',
]);

// Created on first use so a missing GEMINI_API_KEY only fails Gemini calls,
// and shared by every Gemini model. The SDK's types are ESM-only, so it is
// loaded with a dynamic import
let client: GoogleGenAI | null = null;
const getClient = async (): Promise<GoogleGenAI> => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set');
  }
  if (!client) {
    const { GoogleGenAI } = await import('@google/genai');
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return client;
};

interface GeminiProviderOptions {
  name: Extract<LLMProviderName, 'gemini' | 'gemini-lite'>;
  /** Read per call so scripts can override LLM_SETTINGS at runtime */
  model: () => string;
  requestsPerMinute: () => number;
}

export const createGeminiProvider = ({
  name,
  model,
  requestsPerMinute,
}: GeminiProviderOptions): LLMProvider => {
  const generateStructured = async <S extends z.ZodType>(
    request: StructuredRequest<S>,
  ): Promise<StructuredResult<z.infer<S>>> => {
    // Gemini quotas are per model, so each model has its own bucket
    await acquire(name, {
      perSecond: requestsPerMinute() / 60,
      burst: GEMINI_BURST,
    });
    const response = await (await getClient()).models.generateContent({
      model: model(),
      contents: request.prompt,
      config: {
        systemInstruction: request.system,
        maxOutputTokens: LLM_SETTINGS.maxTokens,
        responseMimeType: 'application/json',
        responseJsonSchema: z.toJSONSchema(request.schema),
      },
    });

    const blockReason = response.promptFeedback?.blockReason;
    if (blockReason && blockReason !== 'BLOCKED_REASON_UNSPECIFIED') {
      throw new LLMRefusalError(
        `Gemini blocked the prompt for task "${request.task}" (reason: ${blockReason})`,
        name,
      );
    }

    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason && REFUSAL_REASONS.has(finishReason)) {
      throw new LLMRefusalError(
        `Gemini declined task "${request.task}" (reason: ${finishReason})`,
        name,
      );
    }

    if (finishReason === 'MAX_TOKENS') {
      throw new LLMOutputError(
        `Gemini output truncated at maxOutputTokens for task "${request.task}"`,
        name,
        ['finishReason: MAX_TOKENS'],
      );
    }

    let json: unknown;
    try {
      json = JSON.parse(response.text ?? '');
    } catch {
      throw new LLMOutputError(
        `Gemini output is not valid JSON for task "${request.task}"`,
        name,
        ['(root): response is not valid JSON'],
      );
    }

    // Re-validate: structured outputs constrain shape, zod also enforces
    // constraints JSON schema can't express (refinements, transforms)
    const validated = request.schema.safeParse(json);
    if (!validated.success) {
      throw new LLMOutputError(
        `Gemini output failed schema validation for task "${request.task}"`,
        name,
        formatZodIssues(validated.error),
      );
    }

    const usage = response.usageMetadata;
    return {
      data: validated.data,
      provider: name,
      model: response.modelVersion ?? model(),
      usage: usage
        ? {
            inputTokens: usage.promptTokenCount ?? 0,
            // Thinking tokens are billed as output
            outputTokens:
              (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0),
          }
        : null,
    };
  };

  return {
    name,
    model,
    generateStructured,
  };
};
