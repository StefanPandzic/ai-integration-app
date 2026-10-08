import dotenv from 'dotenv';

dotenv.config();

export interface ModelMetadata {
  name: string;
  type: 'local' | 'cloud';
  requiresAuth: boolean;
  supportsThinking: boolean;
  apiUrl: string;
  modelTag?: string; // Actual model tag to send to API (if different from name)
}

// Ollama models the fallback provider can resolve (see LLM_SETTINGS.ollamaModel)
export const AVAILABLE_MODELS: ModelMetadata[] = [
  {
    name: 'deepseek-r1',
    type: 'local',
    requiresAuth: false,
    supportsThinking: true,
    apiUrl: 'http://localhost:11434',
    modelTag: 'deepseek-r1:latest',
  },
];

// Structured-output LLM provider settings (call summaries, reports)
export type LLMProviderName = 'gemini' | 'gemini-lite' | 'ollama';

export interface LLMSettings {
  primary: LLMProviderName;
  /** Tried in order when the primary (or the previous fallback) fails */
  fallbacks: LLMProviderName[];
  ollamaModel: string;
  geminiModel: string;
  geminiLiteModel: string;
  maxTokens: number;
  /** Client-side caps below the API key's per-model Gemini rate limits */
  geminiRequestsPerMinute: number;
  geminiLiteRequestsPerMinute: number;
}

export const LLM_SETTINGS: LLMSettings = {
  // Gemini Flash → Flash Lite → Ollama once GEMINI_API_KEY is set; Ollama
  // (deepseek-r1) alone until then
  primary: process.env.GEMINI_API_KEY ? 'gemini' : 'ollama',
  fallbacks: process.env.GEMINI_API_KEY ? ['gemini-lite', 'ollama'] : [],
  ollamaModel: 'deepseek-r1',
  // Free-tier models (aistudio.google.com lists the current ones)
  geminiModel: 'gemini-3.5-flash',
  geminiLiteModel: 'gemini-3.5-flash-lite',
  maxTokens: 16000,
  // Free tier allows ~10 requests/min for Flash and ~15 for Flash Lite;
  // raise on a paid key
  geminiRequestsPerMinute: 8,
  geminiLiteRequestsPerMinute: 12,
};
