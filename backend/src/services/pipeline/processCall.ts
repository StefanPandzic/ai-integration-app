/**
 * process_call Job
 *
 * match → summarize → post to Slack. Each step's result is stored before
 * the next runs, so a retried job skips finished steps; a stored Slack
 * `ts` means the message is never posted twice.
 */

import {
  getCall,
  getSummary,
  markNeedsReview,
  saveSummary,
  setCallMatch,
  setSlackMessageTs,
} from '../../db/callsRepo';
import { getClient, getCoach } from '../../db/directoryRepo';
import { CallRow, ClientRow, CoachRow } from '../../types/pipeline';
import { NonRetryableError } from '../queue/errors';
import { postMessage } from '../slack/slackClient';
import { buildSummaryMessage } from '../slack/summaryBlocks';
import { matchCall } from './matching';
import { summarizeCall } from './summarizeCall';

const log = (callId: string, message: string) =>
  console.log(`📞 [call ${callId.slice(0, 8)}] ${message}`);

const resolveMatch = async (
  call: CallRow,
): Promise<{ coach: CoachRow; client: ClientRow } | null> => {
  if (call.coach_id && call.client_id) {
    const [coach, client] = await Promise.all([
      getCoach(call.coach_id),
      getClient(call.client_id),
    ]);
    if (coach && client) return { coach, client };
  }

  const match = await matchCall(call);
  if (!match.matched) {
    await markNeedsReview(call.id, match.reason);
    log(call.id, `needs review: ${match.reason}`);
    return null;
  }

  await setCallMatch(call.id, match.coach.id, match.client.id);
  log(
    call.id,
    `matched by ${match.method} → ${match.client.name} / ${match.coach.name}`,
  );
  return { coach: match.coach, client: match.client };
};

export const processCall = async (callId: string): Promise<void> => {
  const call = await getCall(callId);
  if (!call) {
    throw new NonRetryableError(`Call ${callId} not found`);
  }
  if (call.slack_message_ts) {
    log(call.id, 'already posted, skipping');
    return;
  }

  const match = await resolveMatch(call);
  if (!match) return;

  let stored = await getSummary(call.id);
  if (!stored) {
    const result = await summarizeCall(call, match.coach, match.client);
    await saveSummary(call.id, result.data, result.provider, result.model);
    log(call.id, `summarized with ${result.provider}/${result.model}`);
    stored = await getSummary(call.id);
  }
  if (!stored) {
    throw new Error(`Summary for call ${call.id} was not stored`);
  }

  const message = buildSummaryMessage(
    call,
    stored.summary,
    match.client,
    match.coach,
  );
  const { ts } = await postMessage(message);
  await setSlackMessageTs(call.id, ts);
  log(call.id, `posted to ${message.channel} ts=${ts}`);
};
