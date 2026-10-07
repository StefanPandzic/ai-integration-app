/**
 * Weekly report types (mirror backend/src/schemas/coachReport.ts,
 * backend/src/schemas/managerReport.ts and backend/src/db/reportsRepo.ts;
 * dates arrive as ISO strings, periods as 'YYYY-MM-DD')
 */

import type { JobStatus, Sentiment } from '../../calls';

export type ReportType = 'coach' | 'manager';
export type ReportStatus = 'ready' | 'empty';

export type RubricKey =
  | 'goal_clarity'
  | 'accountability'
  | 'client_ownership'
  | 'listening'
  | 'progress';

export type SentimentCounts = Record<Sentiment, number>;

export interface ReportListItem {
  id: string;
  type: ReportType;
  coach_id: string | null;
  coach_name: string | null;
  period_start: string;
  period_end: string;
  status: ReportStatus;
  calls: number | null;
  rubric_average: number | null;
  slack_message_ts: string | null;
  drive_url: string | null;
  created_at: string;
}

export interface ReportFilters {
  type?: ReportType;
  coachId?: string;
  periodStart?: string;
}

// Coach report content

export interface CoachReportStats {
  calls: number;
  clients: number;
  sentiment: SentimentCounts;
  action_items: Record<'coach' | 'client' | 'other', number>;
  overdue_action_items: number;
  excluded_calls: number;
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

export interface ClientSection {
  client_id: string;
  client_name: string;
  progress: string;
  next_focus: string;
  watch_outs: string[];
  key_topics?: string[];
  evidence_call_ids: string[];
}

export interface RatingDimension {
  key: RubricKey;
  score_1_5: number;
  evidence: { call_id: string; note: string }[];
}

export interface CoachReportContent {
  stats: CoachReportStats;
  calls: ReportCallRef[];
  per_client?: ClientSection[];
  coach_rating?: { dimensions: RatingDimension[]; overall_comment: string };
  improvements?: { dimension: RubricKey; suggestion: string }[];
  attention?: string[];
}

// Manager report content

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

export interface ManagerReportContent {
  stats: ManagerReportStats;
  client_names: Record<string, string>;
  trends?: string[];
  sentiment_notes?: string;
  client_concerns?: { concern: string; client_ids: string[] }[];
  content_ideas?: { title: string; angle: string; client_ids: string[] }[];
  at_risk_clients?: { client_id: string; reason: string }[];
  coach_highlights?: { coach_id: string; note: string }[];
}

interface ReportBase {
  id: string;
  coach_id: string | null;
  coach_name: string | null;
  period_start: string;
  period_end: string;
  status: ReportStatus;
  provider: string;
  model: string;
  slack_message_ts: string | null;
  drive_file_id: string | null;
  drive_url: string | null;
  created_at: string;
}

export type Report =
  | (ReportBase & { type: 'coach'; content: CoachReportContent })
  | (ReportBase & { type: 'manager'; content: ManagerReportContent });

export interface ReportDetail {
  report: Report;
  outbox: { slack: string | null; drive: string | null };
}

// Runs and schedule

export type RunTrigger = 'cron' | 'catch-up' | 'manual';
export type RunState = 'running' | 'ok' | 'partial' | 'failed';

export interface ReportRun {
  run_id: string;
  period_start: string;
  period_end: string;
  trigger: RunTrigger;
  state: RunState;
  created_at: string;
  updated_at: string;
  error: string | null;
  coach_jobs: { total: number; succeeded: number; dead: number; active: number };
  manager_job: JobStatus | null;
  missing_coaches: { coach_id: string; coach_name: string | null }[];
}

export interface ReportSchedule {
  enabled: boolean;
  cron: string;
  timezone: string;
  nextRunAt: string | null;
}

export interface ReportRuns {
  runs: ReportRun[];
  schedule: ReportSchedule;
}

export interface RunHandle {
  runId: string;
  periodStart: string;
  periodEnd: string;
}

/** Coach profile: latest report and rubric trend (oldest first) */
export interface CoachReportSummary {
  id: string;
  period_start: string;
  period_end: string;
  status: ReportStatus;
  rubric_average: number | null;
}

export interface CoachReportTrendPoint {
  id: string;
  period_start: string;
  status: ReportStatus;
  calls: number | null;
  rubric_average: number | null;
}
