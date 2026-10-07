// Shared types between backend and frontend

export interface Transcription {
  id: string;
  text: string;
  timestamp: number;
  embedding?: number[];
  aiResponse?: string;
}

export enum CommandAction {
  NONE = 'NONE',
  TOGGLE_THEME = 'TOGGLE_THEME',
  SET_THEME = 'SET_THEME',
  CLEAR_TRANSCRIPTION = 'CLEAR_TRANSCRIPTION',
  CHANGE_LANGUAGE = 'CHANGE_LANGUAGE',
  CHANGE_APP_TEXT = 'CHANGE_APP_TEXT',
  TOGGLE_PRODUCTION_LINE = 'TOGGLE_PRODUCTION_LINE',
  TOGGLE_PRINTER = 'TOGGLE_PRINTER',
}

export interface CommandParameters {
  theme?: 'light' | 'dark';
  language?: string;
  lineId?: number;
  printerId?: number;
  title?: string;
  subtitle?: string;
}

export interface Command {
  action: CommandAction;
  parameters?: CommandParameters;
  interpretation: string;
  aiResponse: string;
}

export interface CommandBatch {
  commands: Command[];
  interpretation: string;
  aiResponse: string;
}

export interface QueryRequest {
  text: string;
  transcriptionHistory: Transcription[];
  featureEmbeddings?: number[][];
  /** Optional base64-encoded image (PNG/JPG/WEBP, max 5MB) for vision-capable models */
  image?: string;
}

export interface EmbedRequest {
  texts: string[];
}

export interface EmbedResponse {
  embeddings: number[][];
}
