/**
 * Weekly Coach Report Schema and Rubric
 *
 * The rubric is fixed in code so scores are comparable across coaches and
 * weeks; swap RUBRIC once the business sends theirs. The LLM writes prose
 * and judgments only: counts live in CoachReportStats (SQL), names come
 * from the DB, and every cited call/client ID is checked against the input.
 * Kept to JSON-schema features supported by structured outputs (see
 * callSummary.ts); "each rubric key exactly once" is checked in code.
 */

import { z } from 'zod';
import { CallSummary } from './callSummary';

export const RUBRIC = [
  {
    key: 'goal_clarity',
    label: 'Goal clarity',
    description:
      'Each call works toward a clear, specific client goal, and the client can state it.',
  },
  {
    key: 'accountability',
    label: 'Accountability',
    description:
      "The coach follows up on the previous call's action items and last week's focus.",
  },
  {
    key: 'client_ownership',
    label: 'Client ownership',
    description:
      'The client leaves with their own concrete commitments, not tasks handed to them.',
  },
  {
    key: 'listening',
    label: 'Listening',
    description:
      'The client does most of the talking; the coach asks questions more than giving advice.',
  },
  {
    key: 'progress',
    label: 'Progress toward goals',
    description:
      'Clients move measurably toward their goals across the week.',
  },
] as const;

export type RubricKey = (typeof RUBRIC)[number]['key'];

export const RUBRIC_KEYS = RUBRIC.map((d) => d.key) as [RubricKey, ...RubricKey[]];

export const rubricKeySchema = z.enum(RUBRIC_KEYS);

const idSchema = z.string().max(64);

/** One client's week (the "map" step) */
export const clientSectionSchema = z.object({
  client_id: idSchema.describe('client_id exactly as given in the input'),
  progress: z
    .string()
    .max(800)
    .describe(
      "How the client is progressing, judged against last week's focus and open action items",
    ),
  next_focus: z
    .string()
    .max(400)
    .describe('The one thing the coach should focus on with this client next'),
  watch_outs: z.array(z.string().max(300)).max(4),
  key_topics: z
    .array(z.string().max(120))
    .max(3)
    .describe('Main topics the client raised this week, a few words each'),
  evidence_call_ids: z
    .array(idSchema)
    .min(1)
    .max(10)
    .describe('call_ids from the input this section is based on'),
});

export const ratingDimensionSchema = z.object({
  key: rubricKeySchema,
  score_1_5: z.number().int().min(1).max(5),
  evidence: z
    .array(
      z.object({
        call_id: idSchema,
        note: z.string().max(300),
      }),
    )
    .min(1)
    .max(4),
});

/** Coach-level judgments (the "reduce" step) */
export const coachAssessmentSchema = z.object({
  coach_rating: z.object({
    dimensions: z
      .array(ratingDimensionSchema)
      .max(RUBRIC.length)
      .describe('Exactly one entry per rubric dimension'),
    overall_comment: z.string().max(800),
  }),
  improvements: z
    .array(
      z.object({
        dimension: rubricKeySchema,
        suggestion: z.string().max(400),
      }),
    )
    .max(5),
  attention: z
    .array(z.string().max(300))
    .max(5)
    .describe(
      'What the coach should pay attention to this week, e.g. follow-ups due or a client gone quiet',
    ),
});

/** Whole report in one call (used when a coach has few clients) */
export const coachReportSchema = z.object({
  per_client: z.array(clientSectionSchema).max(25),
  ...coachAssessmentSchema.shape,
});

export type ClientSection = z.infer<typeof clientSectionSchema>;
export type CoachAssessment = z.infer<typeof coachAssessmentSchema>;
export type CoachReportOutput = z.infer<typeof coachReportSchema>;

type Sentiment = CallSummary['client_sentiment'];

/** Counted in SQL/code, never by the LLM */
export interface CoachReportStats {
  calls: number;
  clients: number;
  sentiment: Record<Sentiment, number>;
  action_items: Record<'coach' | 'client' | 'other', number>;
  /**
   * Action items with a stated deadline from each client's last call before
   * the week; the deadline has passed (completion is not tracked)
   */
  overdue_action_items: number;
  /** Calls in the week still processing, in review or failed */
  excluded_calls: number;
  /** Coach's share of transcript words, 0-1 (code-counted) */
  coach_talk_share: number | null;
  rubric_average: number | null;
}

export interface ReportCallRef {
  id: string;
  client_id: string;
  title: string | null;
  date: string;
  sentiment: Sentiment;
}

/** Stored report content: stats + LLM output, with names from the DB */
export interface CoachReportContent extends Partial<CoachAssessment> {
  stats: CoachReportStats;
  calls: ReportCallRef[];
  per_client?: (ClientSection & { client_name: string })[];
}

export const rubricAverage = (
  dimensions: { score_1_5: number }[] | undefined,
): number | null =>
  dimensions && dimensions.length > 0
    ? Math.round(
        (dimensions.reduce((sum, d) => sum + d.score_1_5, 0) /
          dimensions.length) *
          10,
      ) / 10
    : null;
