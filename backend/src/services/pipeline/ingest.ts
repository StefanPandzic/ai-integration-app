/**
 * Call Ingest
 *
 * Entry points that store work and return immediately; the job worker
 * does the slow parts. Every path is idempotent:
 * - a Grain recording ID is enqueued once (job idempotency key)
 * - a call is stored once (unique grain_recording_id)
 * - a call is processed once per ingest (job idempotency key)
 */

import { getCall, insertCall, setCallMatch } from '../../db/callsRepo';
import { getDefaultClientChannel } from '../../config/integrations';
import {
  findClientsByEmails,
  getClient,
  getCoach,
  insertClient,
} from '../../db/directoryRepo';
import { enqueueJob } from '../../db/jobsRepo';
import { ClientRow, IncomingCall } from '../../types/pipeline';
import { SlackChannelError, prepareClientChannel } from '../slack/slackChannels';

export const acceptGrainRecording = async (
  recordingId: string,
  rawPayload: unknown,
): Promise<{ jobId: string; duplicate: boolean }> => {
  const { jobId, created } = await enqueueJob({
    type: 'ingest_grain_recording',
    payload: { recordingId, rawPayload },
    idempotencyKey: `grain:${recordingId}`,
  });
  return { jobId, duplicate: !created };
};

export const ingestCall = async (
  incoming: IncomingCall,
): Promise<{ callId: string; duplicate: boolean }> => {
  const { call, created } = await insertCall(incoming);
  if (created) {
    await enqueueJob({
      type: 'process_call',
      payload: { callId: call.id },
      callId: call.id,
      idempotencyKey: `process_call:${call.id}`,
    });
  }
  return { callId: call.id, duplicate: !created };
};

export class AssignError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'AssignError';
  }
}

const ASSIGNABLE_STATUSES = new Set(['needs_review', 'failed']);

export type AssignTarget =
  | { clientId: string; coachId: string | null }
  | {
      newClient: {
        name: string;
        email: string | null;
        coachId: string;
        /** null: the default client channel */
        slackChannelId: string | null;
      };
    };

/**
 * Creates the client from the review queue; its email matches future
 * calls. A chosen Slack channel is checked (and joined) first.
 */
const createClient = async ({
  name,
  email,
  coachId,
  slackChannelId,
}: {
  name: string;
  email: string | null;
  coachId: string;
  slackChannelId: string | null;
}): Promise<ClientRow> => {
  if (!(await getCoach(coachId))) throw new AssignError(`Coach ${coachId} not found`, 404);
  if (email && (await findClientsByEmails([email])).length > 0) {
    throw new AssignError(`A client with email ${email} already exists; pick it from the list`, 409);
  }
  if (slackChannelId) {
    try {
      await prepareClientChannel(slackChannelId);
    } catch (error) {
      if (error instanceof SlackChannelError) throw new AssignError(error.message, error.status);
      throw error;
    }
  }
  return insertClient({
    name,
    email,
    coachId,
    slackChannelId: slackChannelId ?? getDefaultClientChannel(),
  });
};

/**
 * Resolves a review-queue (or failed) call by hand, to an existing client
 * or one created on the spot, and re-runs the pipeline
 */
export const assignCall = async (callId: string, target: AssignTarget): Promise<void> => {
  const call = await getCall(callId);
  if (!call) throw new AssignError(`Call ${callId} not found`, 404);
  if (!ASSIGNABLE_STATUSES.has(call.status)) {
    throw new AssignError(`Call is ${call.status}; only review or failed calls can be assigned`, 409);
  }

  const client =
    'newClient' in target ? await createClient(target.newClient) : await getClient(target.clientId);
  if (!client) throw new AssignError('Client not found', 404);
  const coachId = 'newClient' in target ? target.newClient.coachId : target.coachId;

  const resolvedCoachId = coachId ?? client.coach_id;
  if (!resolvedCoachId) {
    throw new AssignError(`Client ${client.name} has no coach; pass coachId`, 409);
  }

  await setCallMatch(callId, resolvedCoachId, client.id);
  await enqueueJob({
    type: 'process_call',
    payload: { callId },
    callId,
  });
};
