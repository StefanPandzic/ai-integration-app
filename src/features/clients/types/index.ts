/**
 * Client types (mirror backend/src/db/directoryRepo.ts and callsRepo.ts)
 */

import type { CallListItem, CallSummary, Sentiment } from '../../calls';

export interface ClientListItem {
  id: string;
  name: string;
  email: string | null;
  slack_channel_id: string;
  coach_id: string | null;
  coach_name: string | null;
  call_count: number;
  last_call_at: string | null;
  latest_sentiment: Sentiment | null;
}

export interface ClientCallSummary {
  call_id: string;
  title: string | null;
  call_date: string;
  summary: CallSummary;
}

export interface ClientDetail {
  client: ClientListItem;
  calls: CallListItem[];
  /** Newest first */
  summaries: ClientCallSummary[];
}
