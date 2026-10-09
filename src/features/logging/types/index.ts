export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type FeatureName =
  | 'calls'
  | 'clients'
  | 'coaches'
  | 'reports'
  | 'outbox'
  | 'pipeline'
  | 'live'
  | 'app'
  | 'api';

export interface ILogger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  group: (label: string) => void;
  groupEnd: () => void;
}

export interface LoggerConfig {
  enabledFeatures: FeatureName[];
  logLevel: LogLevel;
}
