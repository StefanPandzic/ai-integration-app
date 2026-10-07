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
export type LLMProviderName = 'gemini' | 'ollama';

export interface LLMSettings {
  primary: LLMProviderName;
  fallback: LLMProviderName | null;
  ollamaModel: string;
  geminiModel: string;
  maxTokens: number;
  /** Client-side cap below the API key's Gemini rate limit */
  geminiRequestsPerMinute: number;
}

export const LLM_SETTINGS: LLMSettings = {
  // Gemini with an Ollama fallback once GEMINI_API_KEY is set; Ollama
  // (deepseek-r1) alone until then
  primary: process.env.GEMINI_API_KEY ? 'gemini' : 'ollama',
  fallback: process.env.GEMINI_API_KEY ? 'ollama' : null,
  ollamaModel: 'deepseek-r1',
  // Free-tier model (aistudio.google.com lists the current ones)
  geminiModel: 'gemini-3.5-flash',
  maxTokens: 16000,
  // Free tier allows ~10 requests/min for Flash; raise on a paid key
  geminiRequestsPerMinute: 8,
};
