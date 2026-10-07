/**
 * Call Summary Schema
 *
 * Structured output for a single coaching call. Kept to JSON-schema
 * features supported by structured outputs (no refinements/transforms);
 * semantic checks such as "owners are participants" run separately.
 * Length and count limits make degenerate output (repetition loops) fail
 * validation instead of being posted.
 */

import { z } from 'zod';

export const actionItemSchema = z.object({
  owner: z
    .string()
    .max(100)
    .describe('Name of the call participant who owns the task'),
  owner_role: z.enum(['coach', 'client', 'other']),
  task: z.string().max(300).describe('One sentence describing the commitment'),
  due: z
    .string()
    .max(60)
    .nullable()
    .describe(
      'Deadline exactly as said on the call (e.g. "by Friday"); null if none. Never invent a date.',
    ),
});

export const callSummarySchema = z.object({
  overview: z.string().max(1500).describe('2-4 sentence overview of the call'),
  key_points: z.array(z.string().max(300)).max(8),
  action_items: z.array(actionItemSchema).max(10),
  client_sentiment: z.enum(['positive', 'neutral', 'mixed', 'negative']),
  risks: z.array(z.string().max(300)).max(6),
  notable_quotes: z
    .array(
      z.object({
        speaker: z.string().max(100),
        quote: z
          .string()
          .max(300)
          .describe('Verbatim quote from the transcript'),
      }),
    )
    .max(3),
});

export type ActionItem = z.infer<typeof actionItemSchema>;
export type CallSummary = z.infer<typeof callSummarySchema>;
