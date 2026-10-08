/**
 * Calls Repository: calls and call_summaries
 */

import { CallSummary } from '../schemas/callSummary';
import {
  CallRow,
  CallStatus,
  IncomingCall,
  JobStatus,
  Participant,
} from '../types/pipeline';
import { query } from './index';

/** Inserts the call unless its external ID was already stored */
export const insertCall = async (
  call: IncomingCall,
): Promise<{ call: CallRow; created: boolean }> => {
  const inserted = await query<CallRow>(
    `insert into calls (grain_recording_id, source, title, started_at,
                        duration_seconds, participants, transcript, raw_payload)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (grain_recording_id) do nothing
     returning *`,
    [
      call.externalId,
      call.source,
      call.title,
      call.startedAt,
      call.durationSeconds,
      JSON.stringify(call.participants),
      call.transcript,
      call.rawPayload === undefined ? null : JSON.stringify(call.rawPayload),
    ],
  );
  if (inserted[0]) {
    return { call: inserted[0], created: true };
  }

  const existing = await query<CallRow>(
    'select * from calls where grain_recording_id = $1',
    [call.externalId],
  );
  return { call: existing[0], created: false };
};

export const getCall = async (id: string): Promise<CallRow | null> =>
  (await query<CallRow>('select * from calls where id = $1', [id]))[0] ?? null;

export const setCallMatch = async (
  id: string,
  coachId: string,
  clientId: string,
): Promise<void> => {
  await query(
    `update calls set coach_id = $2, client_id = $3, review_reason = null,
            status = case when status = 'needs_review' then 'received' else status end
      where id = $1`,
    [id, coachId, clientId],
  );
};

export const markNeedsReview = async (
  id: string,
  reason: string,
): Promise<void> => {
  await query(
    `update calls set status = 'needs_review', review_reason = $2 where id = $1`,
    [id, reason],
  );
};

export const setCallStatus = async (
  id: string,
  status: CallStatus,
): Promise<void> => {
  await query('update calls set status = $2 where id = $1', [id, status]);
};

export const setSlackMessageTs = async (
  id: string,
  ts: string,
): Promise<void> => {
  await query(
    `update calls set slack_message_ts = $2, status = 'posted' where id = $1`,
    [id, ts],
  );
};

export const setCallDrive = async (
  id: string,
  fileId: string,
  url: string,
): Promise<void> => {
  await query('update calls set drive_file_id = $2, drive_url = $3 where id = $1', [
    id,
    fileId,
    url,
  ]);
};

export interface StoredSummary {
  summary: CallSummary;
  provider: string;
  model: string;
  created_at: Date;
}

export const getSummary = async (
  callId: string,
): Promise<StoredSummary | null> =>
  (
    await query<StoredSummary>(
      'select summary, provider, model, created_at from call_summaries where call_id = $1',
      [callId],
    )
  )[0] ?? null;

export const saveSummary = async (
  callId: string,
  summary: CallSummary,
  provider: string,
  model: string,
): Promise<void> => {
  await query(
    `insert into call_summaries (call_id, summary, provider, model)
     values ($1, $2, $3, $4)
     on conflict (call_id) do update
       set summary = excluded.summary, provider = excluded.provider,
           model = excluded.model, created_at = now()`,
    [callId, JSON.stringify(summary), provider, model],
  );
  await query(
    `update calls set status = 'summarized' where id = $1 and status = 'received'`,
    [callId],
  );
};

export interface CallListItem {
  id: string;
  title: string | null;
  source: CallRow['source'];
  status: CallStatus;
  review_reason: string | null;
  started_at: Date | null;
  created_at: Date;
  participants: Participant[];
  slack_message_ts: string | null;
  client_id: string | null;
  client_name: string | null;
  coach_id: string | null;
  coach_name: string | null;
  client_sentiment: CallSummary['client_sentiment'] | null;
  action_item_count: number | null;
  job_status: JobStatus | null;
  job_attempts: number | null;
  job_error: string | null;
}

export interface CallFilters {
  status?: CallStatus | null;
  clientId?: string | null;
  coachId?: string | null;
  limit?: number;
  offset?: number;
}

export const listCalls = ({
  status = null,
  clientId = null,
  coachId = null,
  limit = 50,
  offset = 0,
}: CallFilters = {}): Promise<CallListItem[]> =>
  query<CallListItem>(
    `select ca.id, ca.title, ca.source, ca.status, ca.review_reason,
            ca.started_at, ca.created_at, ca.participants, ca.slack_message_ts,
            ca.client_id, cl.name as client_name,
            ca.coach_id, co.name as coach_name,
            cs.summary->>'client_sentiment' as client_sentiment,
            jsonb_array_length(cs.summary->'action_items') as action_item_count,
            j.status as job_status, j.attempts as job_attempts,
            j.last_error as job_error
       from calls ca
       left join clients cl on cl.id = ca.client_id
       left join coaches co on co.id = ca.coach_id
       left join call_summaries cs on cs.call_id = ca.id
       left join lateral (
         select status, attempts, last_error from jobs
          where call_id = ca.id order by created_at desc limit 1
       ) j on true
      where ($1::text is null or ca.status = $1)
        and ($2::uuid is null or ca.client_id = $2)
        and ($3::uuid is null or ca.coach_id = $3)
      order by coalesce(ca.started_at, ca.created_at) desc
      limit $4 offset $5`,
    [status, clientId, coachId, limit, offset],
  );

export interface ClientCallSummary {
  call_id: string;
  title: string | null;
  call_date: Date;
  summary: CallSummary;
}

/** Summaries of a client's most recent calls, newest first */
export const listClientSummaries = (
  clientId: string,
  limit = 10,
): Promise<ClientCallSummary[]> =>
  query<ClientCallSummary>(
    `select ca.id as call_id, ca.title,
            coalesce(ca.started_at, ca.created_at) as call_date, cs.summary
       from calls ca
       join call_summaries cs on cs.call_id = ca.id
      where ca.client_id = $1
      order by call_date desc
      limit $2`,
    [clientId, limit],
  );
