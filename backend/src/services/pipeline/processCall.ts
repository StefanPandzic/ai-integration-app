/**
 * process_call Job
 *
 * match → summarize → post to Slack → archive to Drive. Each step's
 * result is stored before the next runs and each step is skipped when its
 * result exists, so a retried job resumes where it stopped: a stored
 * Slack `ts` means the message is never posted twice, a stored Drive file
 * ID means the document is never saved twice. A call that can't be
 * matched goes to the review queue and ops are alerted.
 */

import {
  getCall,
  getSummary,
  markNeedsReview,
  saveSummary,
  setCallDrive,
  setCallMatch,
  setSlackMessageTs,
} from '../../db/callsRepo';
import { getClient, getCoach } from '../../db/directoryRepo';
import { createLogger } from '../../lib/logger';
import { CallRow, ClientRow, CoachRow } from '../../types/pipeline';
import { notifyNeedsReview } from '../alerts/opsAlerts';
import { getDriveConnector } from '../drive/driveConnector';
import { callDocumentPath, renderCallSummaryHtml } from '../drive/renderCall';
import { NonRetryableError } from '../queue/errors';
import { postMessage } from '../slack/slackClient';
import { buildSummaryMessage } from '../slack/summaryBlocks';
import { maybeInjectFault } from './demoFaults';
import { matchCall } from './matching';
import { summarizeCall } from './summarizeCall';

const log = createLogger('pipeline');

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
    log.info(`📞 needs review: ${match.reason}`);
    await notifyNeedsReview(call, match.reason);
    return null;
  }

  await setCallMatch(call.id, match.coach.id, match.client.id);
  log.info(`📞 matched by ${match.method} → ${match.client.name} / ${match.coach.name}`);
  return { coach: match.coach, client: match.client };
};

export const processCall = async (callId: string): Promise<void> => {
  const call = await getCall(callId);
  if (!call) {
    throw new NonRetryableError(`Call ${callId} not found`);
  }
  if (call.slack_message_ts && call.drive_file_id) {
    log.info('📞 already posted and archived, skipping');
    return;
  }

  const match = await resolveMatch(call);
  if (!match) return;
  const { coach, client } = match;
  maybeInjectFault();

  let stored = await getSummary(call.id);
  if (!stored) {
    const result = await summarizeCall(call, coach, client);
    await saveSummary(call.id, result.data, result.provider, result.model);
    log.info(`📞 summarized with ${result.provider}/${result.model}`);
    stored = await getSummary(call.id);
  }
  if (!stored) {
    throw new Error(`Summary for call ${call.id} was not stored`);
  }

  if (!call.slack_message_ts) {
    const message = buildSummaryMessage(call, stored.summary, client, coach);
    const { ts } = await postMessage(message);
    await setSlackMessageTs(call.id, ts);
    log.info(`📞 posted to ${message.channel}`, { ts });
  }

  if (!call.drive_file_id) {
    const { folderPath, title } = callDocumentPath(call, client);
    const saved = await getDriveConnector().saveDocument(
      folderPath,
      title,
      renderCallSummaryHtml(call, stored.summary, client, coach),
      `call:${call.id}`,
    );
    await setCallDrive(call.id, saved.fileId, saved.url);
    log.info(`📞 archived to Drive ${folderPath}`);
  }
};
