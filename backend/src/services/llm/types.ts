/**
 * LLM Provider Types
 *
 * Provider-agnostic contract for structured (schema-validated) generation.
 * Every provider must return data that has passed zod validation.
 */

import { z } from 'zod';
import { LLMProviderName } from '../../config/aiModels';

export interface StructuredRequest<S extends z.ZodType> {
  /** Short identifier used in logs and as the JSON schema name */
  task: string;
  system: string;
  prompt: string;
  schema: S;
}

export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface StructuredResult<T> {
  data: T;
  provider: LLMProviderName;
  model: string;
  usage: LLMUsage | null;
}

export interface LLMProvider {
  name: LLMProviderName;
  model: () => string;
  generateStructured: <S extends z.ZodType>(
    request: StructuredRequest<S>,
  ) => Promise<StructuredResult<z.infer<S>>>;
}

/** Model output did not match the schema (after any repair attempt) */
export class LLMOutputError extends Error {
  constructor(
    message: string,
    public readonly provider: LLMProviderName,
    public readonly issues: string[],
  ) {
    super(message);
    this.name = 'LLMOutputError';
  }
}

/** Model declined the request; never retried on another provider */
export class LLMRefusalError extends Error {
  constructor(
    message: string,
    public readonly provider: LLMProviderName,
  ) {
    super(message);
    this.name = 'LLMRefusalError';
  }
}

export const formatZodIssues = (error: z.ZodError): string[] =>
  error.issues.map(
    (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`,
  );
