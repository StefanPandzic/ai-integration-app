/**
 * Ollama Provider (fallback)
 *
 * Uses Ollama structured outputs (JSON schema passed in `format`) with the
 * model pinned in LLM_SETTINGS.ollamaModel, and validates the result with
 * zod. Schema violations get one repair retry with the validation errors
 * fed back to the model.
 */

import { z } from 'zod';
import { AVAILABLE_MODELS, LLM_SETTINGS } from '../../config/aiModels';
import { createLogger } from '../../lib/logger';
import {
  LLMOutputError,
  LLMProvider,
  StructuredRequest,
  StructuredResult,
  formatZodIssues,
} from './types';

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
// Hard cap per request; a runaway generation fails and the job retries
const REQUEST_TIMEOUT_MS = 10 * 60_000;
const MAX_OUTPUT_TOKENS = 6144;
// Prompt (~1K) + thinking (~2-4K) + JSON (~1K). Keep it small enough for the
// model to stay fully on the GPU (16K spilled 20% to CPU on an 8 GB card)
const CONTEXT_TOKENS = 8192;

const log = createLogger('llm');

/** Resolves LLM_SETTINGS.ollamaModel to its API tag, URL and capabilities */
const resolveModel = () => {
  const metadata = AVAILABLE_MODELS.find(
    (m) => m.name === LLM_SETTINGS.ollamaModel,
  );
  return {
    tag: metadata?.modelTag ?? LLM_SETTINGS.ollamaModel,
    apiUrl: metadata?.apiUrl ?? DEFAULT_OLLAMA_URL,
    requiresAuth: metadata?.requiresAuth ?? false,
    supportsThinking: metadata?.supportsThinking ?? false,
  };
};

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OllamaChatChunk {
  model?: string;
  message?: { content?: string };
  done?: boolean;
  prompt_eval_count?: number;
  eval_count?: number;
}

interface OllamaChatResult {
  model: string;
  content: string;
  promptEvalCount?: number;
  evalCount?: number;
}

type ParseAttempt<T> =
  | { ok: true; data: T }
  | { ok: false; raw: string; issues: string[] };

const parseOutput = <S extends z.ZodType>(
  schema: S,
  raw: string,
): ParseAttempt<z.infer<S>> => {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, raw, issues: ['(root): response is not valid JSON'] };
  }

  const validated = schema.safeParse(json);
  return validated.success
    ? { ok: true, data: validated.data }
    : { ok: false, raw, issues: formatZodIssues(validated.error) };
};

export const createOllamaProvider = (): LLMProvider => {
  const chat = async (
    messages: OllamaMessage[],
    jsonSchema: unknown,
  ): Promise<OllamaChatResult> => {
    const model = resolveModel();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (model.requiresAuth && process.env.OLLAMA_API_KEY) {
      headers['Authorization'] = `Bearer ${process.env.OLLAMA_API_KEY}`;
    }

    // Streamed so headers arrive immediately: a non-streaming request with a
    // long thinking phase trips fetch's 5-minute headers timeout
    const response = await fetch(`${model.apiUrl}/api/chat`, {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      body: JSON.stringify({
        model: model.tag,
        messages,
        stream: true,
        format: jsonSchema,
        // Reasoning models must think before the schema-constrained answer;
        // when deepseek-r1 skipped thinking it produced incoherent JSON
        ...(model.supportsThinking && { think: true }),
        // Sampling comes from the model's Modelfile defaults: greedy decoding
        // (temperature 0) sends Qwen3-family models such as deepseek-r1:8b
        // into repetition loops. num_predict bounds runaway generations.
        options: { num_ctx: CONTEXT_TOKENS, num_predict: MAX_OUTPUT_TOKENS },
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `Ollama chat error: ${response.status} ${response.statusText} ${body}`.trim(),
      );
    }

    if (!response.body) {
      throw new Error('Ollama chat error: empty response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let content = '';
    let final: OllamaChatChunk | null = null;

    const consume = (line: string) => {
      if (!line.trim()) return;
      const chunk = JSON.parse(line) as OllamaChatChunk;
      content += chunk.message?.content ?? '';
      if (chunk.done) final = chunk;
    };

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      lines.forEach(consume);
    }
    consume(buffer + decoder.decode());

    const last = final as OllamaChatChunk | null;
    return {
      model: last?.model ?? model.tag,
      content,
      promptEvalCount: last?.prompt_eval_count,
      evalCount: last?.eval_count,
    };
  };

  const generateStructured = async <S extends z.ZodType>(
    request: StructuredRequest<S>,
  ): Promise<StructuredResult<z.infer<S>>> => {
    const jsonSchema = z.toJSONSchema(request.schema);
    const messages: OllamaMessage[] = [
      {
        role: 'system',
        content: `${request.system}\n\nRespond with JSON only, matching this schema:\n${JSON.stringify(jsonSchema)}`,
      },
      { role: 'user', content: request.prompt },
    ];

    let response = await chat(messages, jsonSchema);
    let attempt = parseOutput(request.schema, response.content);

    if (!attempt.ok) {
      log.warn(`⚠️ Ollama output invalid for "${request.task}", repairing`, {
        issues: attempt.issues,
      });
      messages.push(
        { role: 'assistant', content: attempt.raw },
        {
          role: 'user',
          content: `Your JSON did not match the schema:\n- ${attempt.issues.join('\n- ')}\nReturn the corrected JSON only.`,
        },
      );
      response = await chat(messages, jsonSchema);
      attempt = parseOutput(request.schema, response.content);
    }

    if (!attempt.ok) {
      throw new LLMOutputError(
        `Ollama output failed schema validation for task "${request.task}"`,
        'ollama',
        attempt.issues,
      );
    }

    return {
      data: attempt.data,
      provider: 'ollama',
      model: response.model,
      usage:
        response.promptEvalCount !== undefined &&
        response.evalCount !== undefined
          ? {
              inputTokens: response.promptEvalCount,
              outputTokens: response.evalCount,
            }
          : null,
    };
  };

  return {
    name: 'ollama',
    model: () => resolveModel().tag,
    generateStructured,
  };
};
