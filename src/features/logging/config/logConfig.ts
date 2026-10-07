import type { LoggerConfig } from '../types';

const isDev = import.meta.env.DEV;

export const logConfig: LoggerConfig = {
  enabledFeatures: ['calls', 'clients', 'coaches', 'reports', 'outbox', 'pipeline', 'app', 'api'],
  logLevel: isDev ? 'debug' : 'info',
};
