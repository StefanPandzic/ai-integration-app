export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type FeatureName =
  | 'speech'
  | 'ai'
  | 'production'
  | 'calls'
  | 'app'
  | 'rag'
  | 'ollama';

export interface ILogger {
  debug: (...args: any[]) => void;
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
  group: (label: string) => void;
  groupEnd: () => void;
}

export interface LoggerConfig {
  enabledFeatures: FeatureName[];
  logLevel: LogLevel;
  enableVerboseOllama: boolean;
}
