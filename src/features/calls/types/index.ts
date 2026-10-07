/**
 * Call pipeline types (mirror backend/src/types/pipeline.ts and
 * backend/src/schemas/callSummary.ts; dates arrive as ISO strings)
 */

export type CallStatus =
  | 'received'
  | 'needs_review'
  | 'summarized'
  | 'posted'
  | 'failed';

export type JobStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'dead';

export interface CallListItem {
  id: string;
  title: string | null;
  source: 'grain' | 'mock' | 'browser';
  status: CallStatus;
  review_reason: string | null;
  started_at: string | null;
  created_at: string;
  slack_message_ts: string | null;
  client_name: string | null;
  coach_name: string | null;
  job_status: JobStatus | null;
  job_attempts: number | null;
  job_error: string | null;
}

export interface Participant {
  name: string;
  email: string | null;
}

export interface ActionItem {
  owner: string;
  owner_role: 'coach' | 'client' | 'other';
  task: string;
  due: string | null;
}

export interface CallSummary {
  overview: string;
  key_points: string[];
  action_items: ActionItem[];
  client_sentiment: 'positive' | 'neutral' | 'mixed' | 'negative';
  risks: string[];
  notable_quotes: { speaker: string; quote: string }[];
}

export interface CallDetail {
  call: CallListItem & {
    participants: Participant[];
    transcript: string;
    duration_seconds: number | null;
  };
  summary: {
    summary: CallSummary;
    provider: string;
    model: string;
    created_at: string;
  } | null;
}

export interface SampleCall {
  id: string;
  title: string;
  scenario: string;
}

export interface DemoInfo {
  grainMode: 'mock' | 'live';
  slackDryRun: boolean;
  samples: SampleCall[];
}

export interface ClientOption {
  id: string;
  name: string;
  coach_id: string | null;
  coach_name: string | null;
}
