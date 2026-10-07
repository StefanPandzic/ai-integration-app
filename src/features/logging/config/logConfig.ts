import type { LoggerConfig, LogLevel, FeatureName } from '../types';

const isDev = import.meta.env.DEV;

export const logConfig: LoggerConfig = {
  enabledFeatures: ['speech', 'ai', 'production', 'calls', 'app', 'rag', 'ollama'],
  logLevel: isDev ? 'debug' : 'info',
  enableVerboseOllama: isDev,
};

export function updateLogConfig(updates: Partial<LoggerConfig>): void {
  Object.assign(logConfig, updates);
}

export function enableFeature(feature: FeatureName): void {
  if (!logConfig.enabledFeatures.includes(feature)) {
    logConfig.enabledFeatures.push(feature);
  }
}

export function disableFeature(feature: FeatureName): void {
  logConfig.enabledFeatures = logConfig.enabledFeatures.filter(
    (f) => f !== feature,
  );
}

export function setLogLevel(level: LogLevel): void {
  logConfig.logLevel = level;
}

export function setVerboseOllama(enabled: boolean): void {
  logConfig.enableVerboseOllama = enabled;
}
