import { AppDispatch } from '../../../store';

export enum CommandAction {
  TOGGLE_THEME = 'TOGGLE_THEME',
  SET_THEME = 'SET_THEME',
  CLEAR_TRANSCRIPTION = 'CLEAR_TRANSCRIPTION',
  CHANGE_LANGUAGE = 'CHANGE_LANGUAGE',
  CHANGE_APP_TEXT = 'CHANGE_APP_TEXT',
  TOGGLE_PRODUCTION_LINE = 'TOGGLE_PRODUCTION_LINE',
  TOGGLE_PRINTER = 'TOGGLE_PRINTER',
  NONE = 'NONE',
}

export interface Command {
  action: CommandAction;
  parameters?: {
    theme?: 'light' | 'dark';
    language?: string;
    title?: string;
    subtitle?: string;
    lineId?: number;
    deviceType?: 'line' | 'printer';
  };
  interpretation: string;
  aiResponse: string;
}

export interface CommandBatch {
  commands: Command[];
  interpretation: string;
  aiResponse: string;
}

export interface CommandResult {
  success: boolean;
  message: string;
  command: Command | null;
  error?: string;
}

export interface BatchCommandResult {
  success: boolean;
  message: string;
  results: CommandResult[];
  command: CommandBatch | null;
  error?: string;
}

export interface CommandExecutionContext {
  dispatch: AppDispatch;
}
