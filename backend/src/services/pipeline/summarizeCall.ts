/**
 * Call Summarization
 *
 * One structured LLM call, then a deterministic owner check: every
 * action-item owner must resolve to a call participant (full name or a
 * unique first name). Owner names are canonicalized and owner_role is
 * taken from the matched coach/client, not from the model. One corrective
 * retry is made if owners don't resolve; after that the job fails.
 * Quotes that don't appear verbatim in the transcript are dropped.
 */

import { CallSummary, callSummarySchema } from '../../schemas/callSummary';
import {
  CallRow,
  ClientRow,
  CoachRow,
  Participant,
} from '../../types/pipeline';
import { LLMOutputError, StructuredResult, generateStructured } from '../llm';

type Role = CallSummary['action_items'][number]['owner_role'];

interface RoledParticipant extends Participant {
  role: Role;
}

const SYSTEM_PROMPT = `You summarize business coaching calls for the coaching team.

Rules:
- Use only facts stated in the transcript. Never invent action items, dates or numbers.
- An action item is a concrete commitment someone made on the call, written as one short sentence. Its owner must be one of the listed participants, written exactly as listed.
- "due" is the deadline as stated (e.g. "by Friday"), or null if none was given.
- notable_quotes: at most 3 short verbatim quotes that best show the client's state of mind. Not a transcript recap.
- risks covers threats to the client's goals or to the coaching relationship. Use an empty list if there are none.`;

const normalize = (name: string): string => name.trim().toLowerCase();

/** Lowercase, drop punctuation, collapse whitespace (for verbatim checks) */
const normalizeText = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

const keepVerbatimQuotes = (
  summary: CallSummary,
  transcript: string,
): CallSummary => {
  const haystack = normalizeText(transcript);
  return {
    ...summary,
    notable_quotes: summary.notable_quotes.filter((q) => {
      const needle = normalizeText(q.quote);
      return needle.length > 0 && haystack.includes(needle);
    }),
  };
};

const assignRoles = (
  participants: Participant[],
  coach: CoachRow,
  client: ClientRow,
): RoledParticipant[] =>
  participants.map((p) => {
    const email = p.email?.toLowerCase();
    if (email === coach.email.toLowerCase()) return { ...p, role: 'coach' };
    if (
      (client.email && email === client.email.toLowerCase()) ||
      normalize(p.name) === normalize(client.name)
    ) {
      return { ...p, role: 'client' };
    }
    return { ...p, role: 'other' };
  });

/** Full-name match, else a first name shared by exactly one participant */
const resolveOwner = (
  owner: string,
  participants: RoledParticipant[],
): RoledParticipant | null => {
  const target = normalize(owner);
  const exact = participants.find((p) => normalize(p.name) === target);
  if (exact) return exact;

  const byFirstName = participants.filter(
    (p) => normalize(p.name).split(/\s+/)[0] === target,
  );
  return byFirstName.length === 1 ? byFirstName[0] : null;
};

const canonicalizeOwners = (
  summary: CallSummary,
  participants: RoledParticipant[],
): { summary: CallSummary; unresolved: string[] } => {
  const unresolved: string[] = [];
  const actionItems = summary.action_items.map((item) => {
    const participant = resolveOwner(item.owner, participants);
    if (!participant) {
      unresolved.push(item.owner);
      return item;
    }
    return { ...item, owner: participant.name, owner_role: participant.role };
  });
  return { summary: { ...summary, action_items: actionItems }, unresolved };
};

const buildPrompt = (
  call: CallRow,
  participants: RoledParticipant[],
  correction?: string,
): string => {
  const roster = participants
    .map((p) => `- ${p.name} (${p.role})`)
    .join('\n');
  const prompt = `Call title: ${call.title ?? 'Untitled'}

Participants:
${roster}

Transcript:
${call.transcript}`;

  return correction ? `${prompt}\n\n${correction}` : prompt;
};

export const summarizeCall = async (
  call: CallRow,
  coach: CoachRow,
  client: ClientRow,
): Promise<StructuredResult<CallSummary>> => {
  const participants = assignRoles(call.participants, coach, client);
  let correction: string | undefined;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const result = await generateStructured({
      task: `summarize-call:${call.id}`,
      system: SYSTEM_PROMPT,
      prompt: buildPrompt(call, participants, correction),
      schema: callSummarySchema,
    });

    const { summary, unresolved } = canonicalizeOwners(
      result.data,
      participants,
    );
    if (unresolved.length === 0) {
      return { ...result, data: keepVerbatimQuotes(summary, call.transcript) };
    }

    correction = `Your previous answer used action-item owners who are not participants: ${unresolved.join(', ')}. Every owner must be exactly one of: ${participants.map((p) => p.name).join(', ')}. Drop any item without a participant owner.`;
    if (attempt === 2) {
      throw new LLMOutputError(
        `Action-item owners are not call participants: ${unresolved.join(', ')}`,
        result.provider,
        unresolved.map((owner) => `action_items.owner: "${owner}"`),
      );
    }
  }

  // Unreachable: the loop either returns or throws
  throw new Error('summarizeCall exhausted attempts');
};
