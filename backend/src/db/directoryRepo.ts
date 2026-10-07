/**
 * Directory Repository: coaches and clients
 */

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

export interface ClientOption {
  id: string;
  name: string;
  coach_id: string | null;
  coach_name: string | null;
}

export const listClients = (): Promise<ClientOption[]> =>
  query<ClientOption>(
    `select c.id, c.name, c.coach_id, co.name as coach_name
       from clients c left join coaches co on co.id = c.coach_id
      order by c.name`,
  );
