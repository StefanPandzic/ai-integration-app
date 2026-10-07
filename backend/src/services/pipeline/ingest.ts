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
import { getClient } from '../../db/directoryRepo';
import { enqueueJob } from '../../db/jobsRepo';
import { IncomingCall } from '../../types/pipeline';

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
    public readonly status: 404 | 409,
  ) {
    super(message);
    this.name = 'AssignError';
  }
}

const ASSIGNABLE_STATUSES = new Set(['needs_review', 'failed']);

/** Resolves a review-queue (or failed) call by hand and re-runs the pipeline */
export const assignCall = async (
  callId: string,
  clientId: string,
  coachId: string | null,
): Promise<void> => {
  const [call, client] = await Promise.all([getCall(callId), getClient(clientId)]);
  if (!call) throw new AssignError(`Call ${callId} not found`, 404);
  if (!client) throw new AssignError(`Client ${clientId} not found`, 404);
  if (!ASSIGNABLE_STATUSES.has(call.status)) {
    throw new AssignError(`Call is ${call.status}; only review or failed calls can be assigned`, 409);
  }

  const resolvedCoachId = coachId ?? client.coach_id;
  if (!resolvedCoachId) {
    throw new AssignError(`Client ${client.name} has no coach; pass coachId`, 409);
  }

  await setCallMatch(callId, resolvedCoachId, clientId);
  await enqueueJob({
    type: 'process_call',
    payload: { callId },
    callId,
  });
};
