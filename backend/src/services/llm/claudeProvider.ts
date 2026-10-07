/**
 * Claude Provider
 *
 * Uses structured outputs (output_config.format) so the response is
 * constrained to the zod schema by the API, then re-validates with zod.
 * Server-side refusal fallbacks are enabled ('default' routing).
 */

import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { LLM_SETTINGS } from '../../config/aiModels';
import {
  LLMOutputError,
  LLMProvider,
  LLMRefusalError,
  StructuredRequest,
  StructuredResult,
  formatZodIssues,
} from './types';

export const createClaudeProvider = (): LLMProvider => {
  // Resolves credentials from ANTHROPIC_API_KEY (or an `ant auth login` profile)
  let client: Anthropic | null = null;
  const getClient = (): Anthropic => {
    client ??= new Anthropic();
    return client;
  };

  const generateStructured = async <S extends z.ZodType>(
    request: StructuredRequest<S>,
  ): Promise<StructuredResult<z.infer<S>>> => {
    const response = await getClient().beta.messages.parse({
      model: LLM_SETTINGS.claudeModel,
      max_tokens: LLM_SETTINGS.maxTokens,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: {
        effort: LLM_SETTINGS.claudeEffort,
        format: betaZodOutputFormat(request.schema),
      },
      system: request.system,
      messages: [{ role: 'user', content: request.prompt }],
    });

    if (response.stop_reason === 'refusal') {
      const category = response.stop_details?.category ?? 'unknown';
      throw new LLMRefusalError(
        `Claude declined task "${request.task}" (category: ${category})`,
        'claude',
      );
    }

    if (response.stop_reason === 'max_tokens') {
      throw new LLMOutputError(
        `Claude output truncated at max_tokens for task "${request.task}"`,
        'claude',
        ['stop_reason: max_tokens'],
      );
    }

    // Re-validate: structured outputs guarantee shape, zod also enforces
    // constraints JSON schema can't express (refinements, transforms)
    const validated = request.schema.safeParse(response.parsed_output);
    if (!validated.success) {
      throw new LLMOutputError(
        `Claude output failed schema validation for task "${request.task}"`,
        'claude',
        formatZodIssues(validated.error),
      );
    }

    return {
      data: validated.data,
      provider: 'claude',
      model: response.model,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  };

  return {
    name: 'claude',
    model: () => LLM_SETTINGS.claudeModel,
    generateStructured,
  };
};
