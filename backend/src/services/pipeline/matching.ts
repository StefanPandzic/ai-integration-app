/**
 * Call Matching
 *
 * Deterministic rules only; a call that can't be matched unambiguously
 * goes to the review queue and is never posted to a guessed channel.
 *
 * Client: a participant email matches exactly one client, otherwise a
 * title keyword matches exactly one client.
 * Coach: the single coach on the call by email (or the client's coach
 * when several are present), otherwise the client's assigned coach.
 */

import {
  findClientsByEmails,
  findClientsByTitle,
  findCoachesByEmails,
  getCoach,
} from '../../db/directoryRepo';
import {
  CallRow,
  ClientRow,
  CoachRow,
  Participant,
} from '../../types/pipeline';

export type MatchResult =
  | { matched: true; coach: CoachRow; client: ClientRow; method: 'email' | 'title' }
  | { matched: false; reason: string };

const participantEmails = (participants: Participant[]): string[] =>
  participants.flatMap((p) => (p.email ? [p.email] : []));

const matchClient = async (
  call: CallRow,
  emails: string[],
): Promise<
  | { client: ClientRow; method: 'email' | 'title' }
  | { reason: string }
> => {
  const byEmail = await findClientsByEmails(emails);
  if (byEmail.length === 1) {
    return { client: byEmail[0], method: 'email' };
  }
  if (byEmail.length > 1) {
    return {
      reason: `Several clients on the call: ${byEmail.map((c) => c.name).join(', ')}`,
    };
  }

  const byTitle = call.title ? await findClientsByTitle(call.title) : [];
  if (byTitle.length === 1) {
    return { client: byTitle[0], method: 'title' };
  }
  if (byTitle.length > 1) {
    return {
      reason: `Title "${call.title}" matches several clients: ${byTitle.map((c) => c.name).join(', ')}`,
    };
  }
  return { reason: 'No participant email or title keyword matches a client' };
};

const matchCoach = async (
  client: ClientRow,
  emails: string[],
): Promise<CoachRow | null> => {
  const onCall = await findCoachesByEmails(emails);
  if (onCall.length === 1) {
    return onCall[0];
  }
  if (onCall.length > 1) {
    return onCall.find((coach) => coach.id === client.coach_id) ?? null;
  }
  return client.coach_id ? getCoach(client.coach_id) : null;
};

export const matchCall = async (call: CallRow): Promise<MatchResult> => {
  const emails = participantEmails(call.participants);

  const clientMatch = await matchClient(call, emails);
  if ('reason' in clientMatch) {
    return { matched: false, reason: clientMatch.reason };
  }

  const coach = await matchCoach(clientMatch.client, emails);
  if (!coach) {
    return {
      matched: false,
      reason: `Matched client ${clientMatch.client.name} but could not determine the coach`,
    };
  }

  return {
    matched: true,
    coach,
    client: clientMatch.client,
    method: clientMatch.method,
  };
};
