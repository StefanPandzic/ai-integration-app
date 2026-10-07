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
export type LLMProviderName = 'claude' | 'ollama';
export type ClaudeEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export interface LLMSettings {
  primary: LLMProviderName;
  fallback: LLMProviderName | null;
  ollamaModel: string;
  claudeModel: string;
  claudeEffort: ClaudeEffort;
  maxTokens: number;
}

export const LLM_SETTINGS: LLMSettings = {
  // deepseek-r1 only for now. Target setup once ANTHROPIC_API_KEY is
  // configured: primary 'claude', fallback 'ollama' (deepseek-r1)
  primary: 'ollama',
  fallback: null,
  ollamaModel: 'deepseek-r1',
  claudeModel: 'claude-opus-5-5',
  claudeEffort: 'medium',
  maxTokens: 16000,
};
