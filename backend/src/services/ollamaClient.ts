/**
 * Ollama Chat API Client (Backend)
 *
 * HTTP client for Ollama /api/chat endpoint with SSE streaming support
 * Supports both text-only and vision queries (images optional)
 * Images are only included for vision-capable models
 */

import { Response } from 'express';
import { OllamaConfig } from '../config/ollamaConfig';
import { AVAILABLE_MODELS, ModelMetadata } from '../config/aiModels';

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: string[];
}

interface OllamaChatRequest {
  model: string;
  messages: Message[];
  stream: boolean;
  think?: boolean;
  options?: {
    num_predict?: number;
    temperature?: number;
  };
}

interface OllamaChatChunk {
  model?: string;
  created_at?: string;
  message?: {
    role?: string;
    content?: string;
    thinking?: string;
  };
  done: boolean;
}

/**
 * Model feature flags based on model capabilities
 */
interface ModelFeatures {
  supportsThinking: boolean;
  supportsVision: boolean;
  requiresAuth: boolean;
  metadata: ModelMetadata | null;
}

/**
 * Detect model features from available models configuration
 */
const getModelFeatures = (modelName: string): ModelFeatures => {
  const metadata = AVAILABLE_MODELS.find(
    (m) => m.name === modelName || m.modelTag === modelName,
  );

  return {
    supportsThinking: metadata?.supportsThinking ?? false,
    supportsVision: metadata?.supportsVision ?? false,
    requiresAuth: metadata?.requiresAuth ?? false,
    metadata: metadata ?? null,
  };
};

/**
 * Build Ollama chat request with model-specific configuration
 * Images are only included if provided AND model supports vision
 */
const buildOllamaChatRequest = (
  config: OllamaConfig,
  systemPrompt: string,
  userInput: string,
  image: string | null | undefined,
  features: ModelFeatures,
): OllamaChatRequest => {
  const messages: Message[] = [
    {
      role: 'system',
      content: systemPrompt,
    },
  ];

  // Build user message
  const userMessage: Message = {
    role: 'user',
    content: `User input: "${userInput}"\n\nYour response (JSON only):`,
  };

  // Only include images if provided AND model supports vision
  if (image && features.supportsVision) {
    userMessage.images = [image];
  }

  messages.push(userMessage);

  const request: OllamaChatRequest = {
    model: config.model,
    messages,
    stream: true,
  };

  if (features.supportsThinking) {
    request.think = true;
    request.options = {
      // Cloud API requires positive max_tokens, local API accepts -1 for unlimited
      num_predict: features.metadata?.type === 'cloud' ? 8192 : -1,
      temperature: 0.7,
    };
  }

  return request;
};

/**
 * Build request headers with conditional authentication
 * Only adds Authorization for models that require it (cloud models)
 */
const buildRequestHeaders = (
  config: OllamaConfig,
  features: ModelFeatures,
): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Only add Authorization header for cloud models that require authentication
  if (features.requiresAuth && config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
    console.log('✅ Authorization header added');
  } else if (features.requiresAuth && !config.apiKey) {
    console.log('⚠️ Model requires authentication but no API key found');
  } else {
    console.log('⚠️ No API key found, skipping Authorization header');
  }

  return headers;
};

/**
 * Call Ollama Chat API and stream response via SSE
 * Supports optional image attachment for vision-capable models
 *
 * @param config - Ollama configuration
 * @param systemPrompt - System prompt for AI
 * @param userInput - User's natural language input
 * @param image - Optional base64-encoded image (only sent to vision-capable models)
 * @param res - Express Response object for SSE
 * @returns Promise<{ response: string; thinking: string }>
 */
export const callOllamaApiSSE = async (
  config: OllamaConfig,
  systemPrompt: string,
  userInput: string,
  image: string | null | undefined,
  res: Response,
): Promise<{ response: string; thinking: string }> => {
  const features = getModelFeatures(config.model);
  const request = buildOllamaChatRequest(
    config,
    systemPrompt,
    userInput,
    image,
    features,
  );

  const fetchStartTime = Date.now();
  console.log('🌐 Sending request to Ollama Chat API...');
  console.log(`📍 API URL: ${config.apiUrl}`);
  console.log(`🤖 Model: ${config.model}`);
  console.log(
    `🖼️ Image attached: ${image && features.supportsVision ? 'YES' : image ? 'NO (model does not support vision)' : 'NO'}`,
  );
  console.log(`🔑 API Key present: ${config.apiKey ? 'YES' : 'NO'}`);

  const headers = buildRequestHeaders(config, features);

  const response = await fetch(`${config.apiUrl}/api/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });

  const fetchResponseTime = Date.now();
  console.log(
    `✅ Response received after ${((fetchResponseTime - fetchStartTime) / 1000).toFixed(1)}s`,
  );
  console.log(`📊 Status: ${response.status} ${response.statusText}`);

  if (!response.ok) {
    // Try to get error details from response body
    let errorDetails = response.statusText;
    try {
      const errorBody = await response.text();
      if (errorBody) {
        console.error('❌ Error response body:', errorBody);
        errorDetails = `${response.statusText} - ${errorBody}`;
      }
    } catch (e) {
      // Ignore if we can't read the body
    }
    throw new Error(`Ollama Chat API error: ${errorDetails}`);
  }

  if (!response.body) {
    throw new Error('Response body is null');
  }

  // Process streaming response and send SSE events
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullResponse = '';
  let fullThinking = '';
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        console.log('🏁 Stream ended');
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const parsed: OllamaChatChunk = JSON.parse(line);

          // Stream thinking chunks via SSE
          if (parsed.message?.thinking) {
            fullThinking += parsed.message.thinking;
            res.write(`event: thinking\n`);
            res.write(
              `data: ${JSON.stringify({ text: parsed.message.thinking })}\n\n`,
            );
          }

          // Accumulate response (don't stream - send at end)
          if (parsed.message?.content) {
            fullResponse += parsed.message.content;
          }

          // Final chunk - send complete event
          if (parsed.done) {
            return { response: fullResponse, thinking: fullThinking };
          }
        } catch (e) {
          console.warn('Failed to parse streaming chunk:', line);
        }
      }
    }

    // Flush remaining buffer
    if (buffer.trim()) {
      buffer += decoder.decode();
      try {
        const parsed: OllamaChatChunk = JSON.parse(buffer);
        if (parsed.message?.thinking && parsed.message.thinking.length > 0) {
          fullThinking += parsed.message.thinking;
        }
        if (parsed.message?.content && parsed.message.content.length > 0) {
          fullResponse += parsed.message.content;
        }
      } catch (e) {
        console.warn('Failed to parse final buffer chunk');
      }
    }

    return { response: fullResponse, thinking: fullThinking };
  } catch (error) {
    console.error('Error processing stream:', error);
    throw error;
  }
};
