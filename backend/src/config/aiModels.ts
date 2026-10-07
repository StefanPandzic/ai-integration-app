import dotenv from 'dotenv';

dotenv.config();

export interface ModelMetadata {
  name: string;
  type: 'local' | 'cloud';
  requiresAuth: boolean;
  supportsThinking: boolean;
  supportsVision: boolean;
  apiUrl: string;
  modelTag?: string; // Actual model tag to send to API (if different from name)
}

// Available Ollama models (first entry is the default)
export const AVAILABLE_MODELS: ModelMetadata[] = [
  {
    name: 'deepseek-r1',
    type: 'local',
    requiresAuth: false,
    supportsThinking: true,
    supportsVision: false,
    apiUrl: 'http://localhost:11434',
    modelTag: 'deepseek-r1:latest',
  },
];

export const EMBEDDING_MODEL: ModelMetadata = {
  name: 'nomic-embed-text',
  type: 'local',
  requiresAuth: false,
  supportsThinking: false,
  supportsVision: false,
  apiUrl: 'http://localhost:11434',
  modelTag: 'nomic-embed-text:latest',
};

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
  // Pinned for the call pipeline (independent of the voice UI's model picker)
  ollamaModel: 'deepseek-r1',
  claudeModel: 'claude-opus-5-5',
  claudeEffort: 'medium',
  maxTokens: 16000,
};

export const getAvailableModels = (): ModelMetadata[] => {
  return AVAILABLE_MODELS;
};

export const getEmbeddingModel = (): ModelMetadata => {
  return EMBEDDING_MODEL;
};
