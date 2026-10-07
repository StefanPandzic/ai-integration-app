/**
 * Ops Alerts
 *
 * Problems come to people: alerts go to the ops Slack channel
 * (SLACK_OPS_CHANNEL_ID; the mock outbox in the demo). Phase 4 extends
 * this to every dead job and to review-queue calls.
 */

import { getDashboardUrl, getOpsChannel } from '../../config/integrations';
import { JobRow, JobType } from '../../types/pipeline';
import { postMessage } from '../slack/slackClient';
import { buildOpsAlert } from '../slack/reportBlocks';

const REPORT_JOB_TYPES = new Set<JobType>([
  'weekly_reports',
  'coach_report',
  'manager_report',
]);

export const sendOpsAlert = async (
  title: string,
  lines: string[],
  link?: { text: string; url: string },
): Promise<void> => {
  await postMessage(buildOpsAlert(getOpsChannel(), title, lines, link));
  console.warn(`🚨 Ops alert: ${title}`);
};

/** Worker onDead hook: alert when a report job is dead-lettered */
export const notifyDeadJob = async (job: JobRow, error: string): Promise<void> => {
  if (!REPORT_JOB_TYPES.has(job.type)) return;

  const period = typeof job.payload.periodStart === 'string' ? job.payload.periodStart : '?';
  await sendOpsAlert(
    `Weekly report job failed: ${job.type}`,
    [
      `Week of ${period}, after ${job.attempts} attempt(s).`,
      `Error: ${error}`,
      job.type === 'coach_report'
        ? 'The manager report will go out without this coach and list them as missing.'
        : 'Rerun the week from the Reports page once the cause is fixed.',
    ],
    { text: 'Open reports', url: `${getDashboardUrl()}/reports` },
  );
};
