/**
 * Weekly Manager Report Schema
 *
 * Built from the week's coach reports (never transcripts). Sentiment and
 * all other numbers come from ManagerReportStats (SQL); the LLM explains
 * them. Every client_id and coach_id it cites is checked against the input.
 */

import { z } from 'zod';
import { CallSummary } from './callSummary';

const idSchema = z.string().max(64);

export const managerReportSchema = z.object({
  trends: z
    .array(z.string().max(400))
    .max(6)
    .describe('Patterns across the whole portfolio this week'),
  sentiment_notes: z
    .string()
    .max(800)
    .describe('Explains the sentiment counts and their change vs last week'),
  client_concerns: z
    .array(
      z.object({
        concern: z.string().max(300),
        client_ids: z.array(idSchema).min(1).max(20),
      }),
    )
    .max(6),
  content_ideas: z
    .array(
      z.object({
        title: z.string().max(150),
        angle: z
          .string()
          .max(400)
          .describe('The client discussion behind the idea and how to use it'),
        client_ids: z.array(idSchema).min(1).max(20),
      }),
    )
    .max(5),
  at_risk_clients: z
    .array(
      z.object({
        client_id: idSchema,
        reason: z.string().max(300),
      }),
    )
    .max(10),
  coach_highlights: z
    .array(
      z.object({
        coach_id: idSchema,
        note: z.string().max(300),
      }),
    )
    .max(25)
    .describe('One line per coach in the input'),
});

export type ManagerReportOutput = z.infer<typeof managerReportSchema>;

type Sentiment = CallSummary['client_sentiment'];
export type SentimentCounts = Record<Sentiment, number>;

export interface CoachRef {
  coach_id: string;
  coach_name: string;
}

export interface CoachWeekStats extends CoachRef {
  calls: number;
  clients: number;
  sentiment: SentimentCounts;
  rubric_average: number | null;
  report_id: string | null;
}

export interface WeekTotals {
  calls: number;
  sentiment: SentimentCounts;
  rubric_average: number | null;
}

/** Counted in SQL/code, never by the LLM */
export interface ManagerReportStats extends WeekTotals {
  clients: number;
  per_coach: CoachWeekStats[];
  previous: WeekTotals;
  deltas: {
    calls: number;
    sentiment: SentimentCounts;
    rubric_average: number | null;
  };
  coaches_without_calls: CoachRef[];
  coach_reports_missing: CoachRef[];
  excluded_calls: number;
}

/** Stored report content, with names from the DB */
export interface ManagerReportContent extends Partial<ManagerReportOutput> {
  stats: ManagerReportStats;
  /** client_id → name for everything cited */
  client_names: Record<string, string>;
}
