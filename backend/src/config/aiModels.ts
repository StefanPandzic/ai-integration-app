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

// Available models configuration
export const AVAILABLE_MODELS: ModelMetadata[] = [
  {
    name: 'llama3',
    type: 'local',
    requiresAuth: false,
    supportsThinking: false,
    supportsVision: false,
    apiUrl: 'http://localhost:11434',
    modelTag: 'llama3:latest',
  },
  {
    name: 'deepseek-r1',
    type: 'local',
    requiresAuth: false,
    supportsThinking: true,
    supportsVision: false,
    apiUrl: 'http://localhost:11434',
    modelTag: 'deepseek-r1:latest',
  },
  {
    name: 'gemma4:31b',
    type: 'cloud',
    requiresAuth: true,
    supportsThinking: true,
    supportsVision: true,
    apiUrl: 'https://api.ollama.com',
    modelTag: 'gemma4:31b-cloud',
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

export const getAvailableModels = (): ModelMetadata[] => {
  return AVAILABLE_MODELS;
};

export const getEmbeddingModel = (): ModelMetadata => {
  return EMBEDDING_MODEL;
};
