/**
 * Structured Logger
 *
 * createLogger(scope) → debug/info/warn/error(message, fields?). Context
 * set with withLogContext() (the worker sets jobId/callId/runId per job)
 * is added to every line logged inside it, so a call can be followed
 * through the logs without passing IDs around.
 *
 * LOG_FORMAT=pretty (default): `HH:MM:SS [scope] [call 1a2b3c4d] message k=v`
 * LOG_FORMAT=json: one object per line {ts, level, scope, msg, ...context, ...fields}
 * LOG_LEVEL=debug|info|warn|error (default info)
 */

import { AsyncLocalStorage } from 'async_hooks';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  jobId?: string;
  callId?: string;
  runId?: string;
  recordingId?: string;
}

export type LogFields = Record<string, unknown>;

export interface Logger {
  debug: (message: string, fields?: LogFields) => void;
  info: (message: string, fields?: LogFields) => void;
  warn: (message: string, fields?: LogFields) => void;
  error: (message: string, fields?: LogFields) => void;
}

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const storage = new AsyncLocalStorage<LogContext>();

/** Runs `fn` with `context` merged into the current log context */
export const withLogContext = <T>(context: LogContext, fn: () => T): T =>
  storage.run({ ...storage.getStore(), ...context }, fn);

const getLogContext = (): LogContext => storage.getStore() ?? {};

/** `Name: message` for errors, String() for anything else */
export const errorMessage = (error: unknown): string =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error);

const minLevel = (): number => {
  const level = process.env.LOG_LEVEL as LogLevel | undefined;
  return LEVELS[level ?? 'info'] ?? LEVELS.info;
};

const isJson = (): boolean => process.env.LOG_FORMAT === 'json';

const serialize = (value: unknown): unknown =>
  value instanceof Error ? errorMessage(value) : value;

const short = (id: string): string => id.slice(0, 8);

const contextPrefix = (context: LogContext): string =>
  [
    context.callId && `[call ${short(context.callId)}]`,
    context.runId && `[run ${short(context.runId)}]`,
    !context.callId && !context.runId && context.jobId && `[job ${short(context.jobId)}]`,
  ]
    .filter(Boolean)
    .join(' ');

const prettyValue = (value: unknown): string => {
  const v = serialize(value);
  if (typeof v === 'string') return /\s/.test(v) ? JSON.stringify(v) : v;
  return JSON.stringify(v);
};

const write = (level: LogLevel, scope: string, message: string, fields?: LogFields) => {
  if (LEVELS[level] < minLevel()) return;
  const context = getLogContext();
  const out = level === 'error' || level === 'warn' ? process.stderr : process.stdout;

  if (isJson()) {
    const entry: Record<string, unknown> = {
      ts: new Date().toISOString(),
      level,
      scope,
      msg: message,
      ...context,
    };
    for (const [key, value] of Object.entries(fields ?? {})) {
      entry[key] = serialize(value);
    }
    out.write(`${JSON.stringify(entry)}\n`);
    return;
  }

  const time = new Date().toTimeString().slice(0, 8);
  const tag = level === 'info' ? '' : ` ${level.toUpperCase()}`;
  const prefix = contextPrefix(context);
  const extra = Object.entries(fields ?? {})
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${prettyValue(value)}`)
    .join(' ');
  out.write(
    `${time}${tag} [${scope}]${prefix ? ` ${prefix}` : ''} ${message}${extra ? ` ${extra}` : ''}\n`,
  );
};

export const createLogger = (scope: string): Logger => ({
  debug: (message, fields) => write('debug', scope, message, fields),
  info: (message, fields) => write('info', scope, message, fields),
  warn: (message, fields) => write('warn', scope, message, fields),
  error: (message, fields) => write('error', scope, message, fields),
});
