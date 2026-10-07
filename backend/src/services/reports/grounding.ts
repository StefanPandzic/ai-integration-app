/**
 * Report Grounding Helpers
 *
 * The LLM never sees database IDs: calls, clients and coaches are given
 * short refs ("call-3", "client-1") that it copies back, and code maps
 * them to real IDs. Any ref that doesn't resolve counts as a grounding
 * problem: one corrective retry, then the job fails (as in Phase 2).
 */

import { z } from 'zod';
import { LLMOutputError, StructuredResult, generateStructured } from '../llm';

export class RefMap {
  private readonly byRef = new Map<string, string>();
  private readonly byId = new Map<string, string>();
  private count = 0;

  constructor(private readonly prefix: string) {}

  /** The ref for an ID, created on first use */
  ref(id: string): string {
    const existing = this.byId.get(id);
    if (existing) return existing;
    const ref = `${this.prefix}-${++this.count}`;
    this.byRef.set(ref, id);
    this.byId.set(id, ref);
    return ref;
  }

  resolve(ref: string): string | undefined {
    return this.byRef.get(ref.trim().toLowerCase());
  }

  has(ref: string): boolean {
    return this.resolve(ref) !== undefined;
  }
}

interface CheckedRequest<S extends z.ZodType> {
  task: string;
  system: string;
  prompt: string;
  schema: S;
  /** Returns grounding problems; empty when the output can be used */
  check: (data: z.infer<S>) => string[];
}

export const generateChecked = async <S extends z.ZodType>(
  request: CheckedRequest<S>,
): Promise<StructuredResult<z.infer<S>>> => {
  let correction = '';

  for (let attempt = 1; attempt <= 2; attempt++) {
    const result = await generateStructured({
      task: request.task,
      system: request.system,
      prompt: request.prompt + correction,
      schema: request.schema,
    });

    const problems = request.check(result.data);
    if (problems.length === 0) return result;

    if (attempt === 2) {
      throw new LLMOutputError(
        `Report output is not grounded in its input (${request.task})`,
        result.provider,
        problems,
      );
    }
    console.warn(`⚠️ ${request.task}: grounding problems, retrying:`, problems);
    correction = `\n\nYour previous answer had these problems:\n- ${problems.join('\n- ')}\nFix them. Only use refs that appear in the input, written exactly as given.`;
  }

  // Unreachable: the loop either returns or throws
  throw new Error('generateChecked exhausted attempts');
};

/** Refs in `refs` that are not in `allowed` */
export const unknownRefs = (
  refs: string[],
  allowed: { has: (ref: string) => boolean },
): string[] => refs.filter((ref) => !allowed.has(ref));

/** Coach share of transcript words, from "Name: text" lines */
export const talkShare = (
  transcript: string,
  coachName: string,
): { coachWords: number; totalWords: number } => {
  const coach = coachName.trim().toLowerCase();
  let coachWords = 0;
  let totalWords = 0;
  for (const line of transcript.split('\n')) {
    const match = /^([^:]{1,80}):\s*(.*)$/.exec(line.trim());
    if (!match) continue;
    const words = match[2].split(/\s+/).filter(Boolean).length;
    totalWords += words;
    const speaker = match[1].trim().toLowerCase();
    if (speaker === coach || coach.startsWith(`${speaker} `) || speaker.startsWith(coach)) {
      coachWords += words;
    }
  }
  return { coachWords, totalWords };
};

export const percent = (share: number | null): string =>
  share === null ? 'n/a' : `${Math.round(share * 100)}%`;
