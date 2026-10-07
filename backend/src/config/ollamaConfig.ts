import dotenv from 'dotenv';
import { AVAILABLE_MODELS, EMBEDDING_MODEL } from './aiModels';

dotenv.config();

export interface OllamaConfig {
  apiUrl: string;
  embedApiUrl: string;
  model: string;
  embedModel: string;
  apiKey?: string;
}

interface ModelOverrides {
  modelName: string | null;
  apiUrl: string | null;
  modelTag: string | null;
}

const modelOverrides: ModelOverrides = {
  modelName: null,
  apiUrl: null,
  modelTag: null,
};

const getDefaults = () => {
  const defaultModel = AVAILABLE_MODELS[0];
  const embedModel = EMBEDDING_MODEL;

  return {
    apiUrl: defaultModel.apiUrl,
    embedApiUrl: embedModel.apiUrl,
    model: defaultModel.modelTag ?? defaultModel.name,
    embedModel: embedModel.modelTag ?? embedModel.name,
    apiKey: process.env.OLLAMA_API_KEY,
  };
};

export const getOllamaConfig = (): OllamaConfig => {
  const defaults = getDefaults();

  return {
    apiUrl: modelOverrides.apiUrl ?? defaults.apiUrl,
    embedApiUrl: defaults.embedApiUrl,
    model: modelOverrides.modelTag ?? defaults.model,
    embedModel: defaults.embedModel,
    apiKey: defaults.apiKey,
  };
};

export const setModelConfig = (modelName: string): void => {
  const modelMetadata = AVAILABLE_MODELS.find((m) => m.name === modelName);

  if (!modelMetadata) {
    throw new Error(`Unknown model: ${modelName}`);
  }

  Object.assign(modelOverrides, {
    modelName,
    apiUrl: modelMetadata.apiUrl,
    modelTag: modelMetadata.modelTag,
  });

  console.log(
    `✅ Model configuration updated: ${modelName} (${modelMetadata.type})`,
  );
  console.log(`📝 API tag: ${modelOverrides.modelTag}`);
};
