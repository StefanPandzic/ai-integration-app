/**
 * Call pipeline types (mirror backend/src/types/pipeline.ts,
 * backend/src/db/callsRepo.ts and backend/src/schemas/callSummary.ts;
 * dates arrive as ISO strings)
 */

export type CallStatus =
  | 'received'
  | 'needs_review'
  | 'summarized'
  | 'posted'
  | 'failed';

export type JobStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'dead';

export type Sentiment = 'positive' | 'neutral' | 'mixed' | 'negative';

export interface CallListItem {
  id: string;
  title: string | null;
  source: 'grain' | 'mock' | 'browser';
  status: CallStatus;
  review_reason: string | null;
  started_at: string | null;
  created_at: string;
  slack_message_ts: string | null;
  client_id: string | null;
  client_name: string | null;
  coach_id: string | null;
  coach_name: string | null;
  client_sentiment: Sentiment | null;
  action_item_count: number | null;
  job_status: JobStatus | null;
  job_attempts: number | null;
  job_error: string | null;
}

export interface CallFilters {
  status?: CallStatus;
  clientId?: string;
  coachId?: string;
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
  client_sentiment: Sentiment;
  risks: string[];
  notable_quotes: { speaker: string; quote: string }[];
}

export interface CallRecord {
  id: string;
  title: string | null;
  source: CallListItem['source'];
  status: CallStatus;
  review_reason: string | null;
  started_at: string | null;
  created_at: string;
  duration_seconds: number | null;
  participants: Participant[];
  transcript: string;
  coach_id: string | null;
  client_id: string | null;
  slack_message_ts: string | null;
}

export interface StoredSummary {
  summary: CallSummary;
  provider: string;
  model: string;
  created_at: string;
}

export interface NamedRef {
  id: string;
  name: string;
}

export interface JobSnapshot {
  type: 'ingest_grain_recording' | 'process_call';
  status: JobStatus;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  run_at: string;
  updated_at: string;
}

export interface CallDetail {
  call: CallRecord;
  summary: StoredSummary | null;
  client: NamedRef | null;
  coach: NamedRef | null;
  job: JobSnapshot | null;
  /** Mock outbox entry of the posted Slack message */
  outbox: { slack: string | null };
}

export interface SampleCall {
  id: string;
  title: string;
  scenario: string;
}

export interface DemoInfo {
  grainMode: 'mock' | 'live';
  slackMode: 'mock' | 'live';
  driveMode: 'mock' | 'live';
  samples: SampleCall[];
}

/** Minimal client shape for the review-queue assign picker */
export interface AssignableClient {
  id: string;
  name: string;
  coach_name: string | null;
}
