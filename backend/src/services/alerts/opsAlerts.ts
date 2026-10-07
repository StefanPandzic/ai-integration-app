/**
 * Ops Alerts
 *
 * Problems come to people: alerts go to the ops Slack channel
 * (SLACK_OPS_CHANNEL_ID; the mock outbox in the demo), each with a link
 * to the screen where it gets fixed. Every alert has an idempotency key,
 * so a retried job or a re-run reconcile never alerts twice for the same
 * event. What each alert means and what to do: docs/SOP.md.
 */

import { getDashboardUrl, getOpsChannel } from '../../config/integrations';
import { getCall } from '../../db/callsRepo';
import { createLogger } from '../../lib/logger';
import { CallRow, JobRow, JobType } from '../../types/pipeline';
import { postMessage } from '../slack/slackClient';
import { buildOpsAlert } from '../slack/reportBlocks';

const REPORT_JOB_TYPES = new Set<JobType>([
  'weekly_reports',
  'coach_report',
  'manager_report',
]);

const log = createLogger('alerts');

export const sendOpsAlert = async (
  title: string,
  lines: string[],
  link?: { text: string; url: string },
  key?: string,
): Promise<void> => {
  await postMessage(buildOpsAlert(getOpsChannel(), title, lines, link), {
    idempotencyKey: key && `alert:${key}`,
  });
  log.warn(`🚨 Ops alert: ${title}`);
};

const callLabel = (call: CallRow | null): string =>
  call ? `"${call.title ?? 'Untitled call'}"` : 'a call';

const failuresUrl = () => `${getDashboardUrl()}/pipeline?tab=failures`;

const reportJobAlert = (job: JobRow, error: string, key: string) => {
  const period = typeof job.payload.periodStart === 'string' ? job.payload.periodStart : '?';
  return sendOpsAlert(
    `Weekly report job failed: ${job.type}`,
    [
      `Week of ${period}, after ${job.attempts} attempt(s).`,
      `Error: ${error}`,
      job.type === 'coach_report'
        ? 'The manager report will go out without this coach and list them as missing.'
        : 'Fix the cause, then Retry the job (Pipeline → Failures) or rerun the week from Reports.',
    ],
    { text: 'Open failures', url: failuresUrl() },
    key,
  );
};

/**
 * Worker onDead hook: every dead job reaches ops. The key includes the
 * claim time, so a job that is retried and dies again alerts again.
 */
export const notifyDeadJob = async (job: JobRow, error: string): Promise<void> => {
  const key = `dead:${job.id}:${new Date(job.updated_at).getTime()}`;

  if (REPORT_JOB_TYPES.has(job.type)) {
    await reportJobAlert(job, error, key);
    return;
  }

  if (job.type === 'process_call' && job.call_id) {
    const call = await getCall(job.call_id);
    await sendOpsAlert(
      `Call summary failed: ${callLabel(call)}`,
      [
        `The call could not be processed after ${job.attempts} attempt(s), so the client's channel has not received its summary.`,
        `Error: ${error}`,
        'Fix the cause, then press Retry on the call. Finished steps are not repeated.',
      ],
      { text: 'Open call', url: `${getDashboardUrl()}/calls/${job.call_id}` },
      key,
    );
    return;
  }

  if (job.type === 'ingest_grain_recording') {
    const recordingId = String(job.payload.recordingId ?? '?');
    await sendOpsAlert(
      'Grain recording could not be fetched',
      [
        `Recording ${recordingId}, after ${job.attempts} attempt(s).`,
        `Error: ${error}`,
        'The call is not in the system yet. Retry the job from Pipeline → Failures once Grain is reachable; the nightly reconcile also picks it up.',
      ],
      { text: 'Open failures', url: failuresUrl() },
      key,
    );
    return;
  }

  await sendOpsAlert(
    `Job failed: ${job.type}`,
    [`After ${job.attempts} attempt(s).`, `Error: ${error}`],
    { text: 'Open failures', url: failuresUrl() },
    key,
  );
};

/** A call went to the review queue: nobody is guessing its channel */
export const notifyNeedsReview = async (call: CallRow, reason: string): Promise<void> => {
  const participants = call.participants
    .map((p) => (p.email ? `${p.name} <${p.email}>` : p.name))
    .join(', ');
  await sendOpsAlert(
    `Call needs review: ${callLabel(call)}`,
    [
      `It could not be matched to a client, so it was not posted anywhere.`,
      `Reason: ${reason}`,
      `Participants: ${participants}`,
      'Assign it to a client in the review queue; the summary is posted right after.',
    ],
    { text: 'Assign client', url: `${getDashboardUrl()}/review?call=${call.id}` },
    `review:${call.id}`,
  );
};

/** The reconcile found recordings whose webhook never arrived */
export const notifyRecovered = async (
  jobId: string,
  recordingIds: string[],
): Promise<void> => {
  await sendOpsAlert(
    `Recovered ${recordingIds.length} missed Grain recording(s)`,
    [
      'Their webhooks never arrived; the nightly reconcile found them and queued them for processing.',
      `Recordings: ${recordingIds.join(', ')}`,
      'No action needed. Many at once can mean the Grain webhook is misconfigured.',
    ],
    { text: 'Open pipeline', url: `${getDashboardUrl()}/pipeline` },
    `reconcile:${jobId}`,
  );
};
