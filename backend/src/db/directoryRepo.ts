/**
 * Directory Repository: coaches and clients
 */

import { CallSummary } from '../schemas/callSummary';
import { ClientRow, CoachRow } from '../types/pipeline';
import { query } from './index';

const lowerAll = (emails: string[]): string[] =>
  emails.map((email) => email.toLowerCase());

export const findCoachesByEmails = (emails: string[]): Promise<CoachRow[]> =>
  query<CoachRow>('select * from coaches where lower(email) = any($1)', [
    lowerAll(emails),
  ]);

export const findClientsByEmails = (emails: string[]): Promise<ClientRow[]> =>
  query<ClientRow>('select * from clients where lower(email) = any($1)', [
    lowerAll(emails),
  ]);

/** Clients with a title keyword contained in the title (case-insensitive) */
export const findClientsByTitle = (title: string): Promise<ClientRow[]> =>
  query<ClientRow>(
    `select * from clients c
      where exists (
        select 1 from unnest(c.title_keywords) as keyword
         where position(lower(keyword) in lower($1)) > 0
      )`,
    [title],
  );

export const getCoach = async (id: string): Promise<CoachRow | null> =>
  (await query<CoachRow>('select * from coaches where id = $1', [id]))[0] ??
  null;

export const getClient = async (id: string): Promise<ClientRow | null> =>
  (await query<ClientRow>('select * from clients where id = $1', [id]))[0] ??
  null;

export interface NewClient {
  name: string;
  email: string | null;
  coachId: string;
  slackChannelId: string;
}

export const insertClient = async ({
  name,
  email,
  coachId,
  slackChannelId,
}: NewClient): Promise<ClientRow> =>
  (
    await query<ClientRow>(
      `insert into clients (name, email, coach_id, slack_channel_id)
       values ($1, $2, $3, $4)
       returning *`,
      [name, email, coachId, slackChannelId],
    )
  )[0];

export const updateClientChannel = async (
  id: string,
  slackChannelId: string,
): Promise<ClientRow | null> =>
  (
    await query<ClientRow>(
      'update clients set slack_channel_id = $2 where id = $1 returning *',
      [id, slackChannelId],
    )
  )[0] ?? null;

export interface ClientListItem {
  id: string;
  name: string;
  email: string | null;
  slack_channel_id: string;
  coach_id: string | null;
  coach_name: string | null;
  call_count: number;
  last_call_at: Date | null;
  latest_sentiment: CallSummary['client_sentiment'] | null;
}

export const listClients = ({
  coachId = null,
  clientId = null,
}: { coachId?: string | null; clientId?: string | null } = {}): Promise<
  ClientListItem[]
> =>
  query<ClientListItem>(
    `select c.id, c.name, c.email, c.slack_channel_id,
            c.coach_id, co.name as coach_name,
            (select count(*)::int from calls where client_id = c.id) as call_count,
            (select max(coalesce(started_at, created_at)) from calls
              where client_id = c.id) as last_call_at,
            (select cs.summary->>'client_sentiment'
               from calls ca join call_summaries cs on cs.call_id = ca.id
              where ca.client_id = c.id
              order by coalesce(ca.started_at, ca.created_at) desc
              limit 1) as latest_sentiment
       from clients c left join coaches co on co.id = c.coach_id
      where ($1::uuid is null or c.coach_id = $1)
        and ($2::uuid is null or c.id = $2)
      order by c.name`,
    [coachId, clientId],
  );

export interface CoachListItem {
  id: string;
  name: string;
  email: string;
  client_count: number;
  call_count: number;
  calls_last_7_days: number;
}

export const listCoaches = (): Promise<CoachListItem[]> =>
  query<CoachListItem>(
    `select co.id, co.name, co.email,
            (select count(*)::int from clients where coach_id = co.id) as client_count,
            (select count(*)::int from calls where coach_id = co.id) as call_count,
            (select count(*)::int from calls
              where coach_id = co.id
                and coalesce(started_at, created_at) > now() - interval '7 days'
            ) as calls_last_7_days
       from coaches co
      order by co.name`,
  );
