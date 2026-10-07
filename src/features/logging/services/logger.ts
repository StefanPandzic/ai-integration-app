import type { FeatureName, ILogger, LogLevel } from '../types';
import { logConfig } from '../config/logConfig';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(feature: FeatureName, level: LogLevel): boolean {
  if (!logConfig.enabledFeatures.includes(feature)) {
    return false;
  }

  const currentPriority = LOG_LEVEL_PRIORITY[logConfig.logLevel];
  const messagePriority = LOG_LEVEL_PRIORITY[level];

  return messagePriority >= currentPriority;
}

function formatFeaturePrefix(feature: FeatureName): string {
  const prefixes: Record<FeatureName, string> = {
    calls: '[CALLS]',
    app: '[APP]',
    clients: '[CLIENTS]',
    coaches: '[COACHES]',
    api: '[API]',
  };
  return prefixes[feature];
}

export function createLogger(feature: FeatureName): ILogger {
  const prefix = formatFeaturePrefix(feature);

  return {
    debug: (...args: unknown[]) => {
      if (shouldLog(feature, 'debug')) {
        console.log(prefix, ...args);
      }
    },

    info: (...args: unknown[]) => {
      if (shouldLog(feature, 'info')) {
        console.log(prefix, ...args);
      }
    },

    warn: (...args: unknown[]) => {
      if (shouldLog(feature, 'warn')) {
        console.warn(prefix, ...args);
      }
    },

    error: (...args: unknown[]) => {
      if (shouldLog(feature, 'error')) {
        console.error(prefix, ...args);
      }
    },

    group: (label: string) => {
      if (shouldLog(feature, 'debug')) {
        console.group(`${prefix} ${label}`);
      }
    },

    groupEnd: () => {
      if (shouldLog(feature, 'debug')) {
        console.groupEnd();
      }
    },
  };
}
