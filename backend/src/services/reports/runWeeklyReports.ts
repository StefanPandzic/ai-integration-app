/**
 * Weekly Report Run: jobs on the existing Postgres queue
 *
 * weekly_reports {runId, period, force, trigger}
 *   → fan-out: one coach_report per coach with a client, then manager_report
 * coach_report: generate (waits while the week's calls are still being
 *   processed) → save → Drive doc → Slack DM (manager channel if the coach
 *   has no Slack user)
 * manager_report: gate until every coach_report in the run has succeeded
 *   or is dead → generate → save → Drive → manager channel; a partial run
 *   (dead coach jobs) raises an ops alert
 *
 * Steps resume like processCall: a stored report is not regenerated, a
 * stored Drive file is not saved again and a stored Slack ts is not posted
 * again. `force` (manual reruns) replaces reports made before this run.
 * Drive is saved before Slack so the message can link to the document.
 */

import crypto from 'crypto';
import { z } from 'zod';
import {
  getDashboardUrl,
  getManagerChannel,
} from '../../config/integrations';
import { getCoach } from '../../db/directoryRepo';
import { createLogger, withLogContext } from '../../lib/logger';
import { enqueueJob, getJob } from '../../db/jobsRepo';
import {
  Period,
  RunTrigger,
  countInFlightCalls,
  deleteReport,
  getPeriod,
  getReportFor,
  listCoachesWithClients,
  listRunCoachJobs,
  setReportDrive,
  setReportSlackTs,
  upsertReport,
} from '../../db/reportsRepo';
import { CoachReportContent } from '../../schemas/coachReport';
import { CoachRef, ManagerReportContent } from '../../schemas/managerReport';
import { JobRow, ReportRow, ReportType } from '../../types/pipeline';
import { sendOpsAlert } from '../alerts/opsAlerts';
import { getDriveConnector } from '../drive/driveConnector';
import { NonRetryableError, RetryLaterError } from '../queue/errors';
import {
  buildCoachReportMessage,
  buildManagerReportMessage,
} from '../slack/reportBlocks';
import { SlackMessage, postMessage } from '../slack/slackClient';
import { generateCoachReport } from './coachReport';
import { generateManagerReport } from './managerReport';
import {
  renderCoachReportHtml,
  renderManagerReportHtml,
} from './renderReport';

const WAIT_MS = 30_000;
/** After this long a gate stops waiting and proceeds with what it has */
const MAX_WAIT_MS = 2 * 60 * 60_000;

const runPayloadSchema = z.object({
  runId: z.string().min(1),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  force: z.boolean().default(false),
  trigger: z.enum(['cron', 'catch-up', 'manual']).default('cron'),
});

type RunPayload = z.infer<typeof runPayloadSchema>;

const readPayload = (job: JobRow): RunPayload => {
  const parsed = runPayloadSchema.safeParse(job.payload);
  if (!parsed.success) {
    throw new NonRetryableError(`Job ${job.id} has an invalid report payload`);
  }
  return parsed.data;
};

const logger = createLogger('reports');

const log = (runId: string, message: string) =>
  withLogContext({ runId }, () => logger.info(`📊 ${message}`));

const periodOf = (p: RunPayload): Period => ({
  periodStart: p.periodStart,
  periodEnd: p.periodEnd,
});

const dayFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

const formatPeriod = (period: Period): string =>
  `${dayFormat.format(new Date(`${period.periodStart}T00:00:00Z`))} – ${dayFormat.format(new Date(`${period.periodEnd}T00:00:00Z`))}, ${period.periodEnd.slice(0, 4)}`;

const waitedTooLong = (job: JobRow): boolean =>
  Date.now() - new Date(job.created_at).getTime() > MAX_WAIT_MS;

// Enqueue

export interface RunHandle extends Period {
  runId: string;
  created: boolean;
}

/**
 * Scheduled and catch-up runs share the key weekly_reports:<periodStart>,
 * so double fires and restarts enqueue once. Manual runs always enqueue
 * and force regeneration.
 */
export const enqueueWeeklyRun = async (options: {
  trigger: RunTrigger;
  periodStart?: string | null;
}): Promise<RunHandle> => {
  const period = await getPeriod(options.periodStart);
  const runId = crypto.randomUUID();
  const manual = options.trigger === 'manual';

  const { jobId, created } = await enqueueJob({
    type: 'weekly_reports',
    payload: { runId, ...period, force: manual, trigger: options.trigger },
    idempotencyKey: manual
      ? `weekly_reports:${period.periodStart}:${runId}`
      : `weekly_reports:${period.periodStart}`,
  });

  const existingRunId = created ? runId : (await getJob(jobId))?.payload.runId;
  return {
    runId: typeof existingRunId === 'string' ? existingRunId : runId,
    ...period,
    created,
  };
};

// Delivery

interface Delivery {
  folderPath: string;
  title: string;
  html: string;
  message: (driveUrl: string | null) => SlackMessage;
}

const deliver = async (report: ReportRow, delivery: Delivery): Promise<void> => {
  let driveUrl = report.drive_url;
  if (!report.drive_file_id) {
    const saved = await getDriveConnector().saveDocument(
      delivery.folderPath,
      delivery.title,
      delivery.html,
      `report:${report.id}`,
    );
    await setReportDrive(report.id, saved.fileId, saved.url);
    driveUrl = saved.url;
  }

  if (!report.slack_message_ts) {
    const { ts } = await postMessage(delivery.message(driveUrl));
    await setReportSlackTs(report.id, ts);
  }
};

/** The stored report, unless a forced run must replace an older one */
const existingReport = async (
  job: JobRow,
  payload: RunPayload,
  type: ReportType,
  coachId: string | null,
): Promise<ReportRow | null> => {
  const report = await getReportFor(type, coachId, payload.periodStart);
  if (report && payload.force && new Date(report.created_at) < new Date(job.created_at)) {
    await deleteReport(report.id);
    return null;
  }
  return report;
};

// Handlers

export const handleWeeklyReports = async (job: JobRow): Promise<void> => {
  const payload = readPayload(job);
  const coaches = await listCoachesWithClients();

  for (const coach of coaches) {
    await enqueueJob({
      type: 'coach_report',
      payload: { ...payload, coachId: coach.id },
      idempotencyKey: `coach_report:${payload.runId}:${coach.id}`,
    });
  }
  await enqueueJob({
    type: 'manager_report',
    payload,
    idempotencyKey: `manager_report:${payload.runId}`,
  });
  log(
    payload.runId,
    `${payload.trigger} run for ${payload.periodStart}: ${coaches.length} coach reports + manager report enqueued${payload.force ? ' (force)' : ''}`,
  );
};

export const handleCoachReport = async (job: JobRow): Promise<void> => {
  const payload = readPayload(job);
  const coachId = job.payload.coachId;
  const coach = typeof coachId === 'string' ? await getCoach(coachId) : null;
  if (!coach) {
    throw new NonRetryableError(`Coach ${String(coachId)} not found`);
  }
  const period = periodOf(payload);

  let report = await existingReport(job, payload, 'coach', coach.id);
  if (!report) {
    const inFlight = await countInFlightCalls(period);
    if (inFlight > 0 && !waitedTooLong(job)) {
      throw new RetryLaterError(`${inFlight} calls in the week are still processing`, WAIT_MS, false);
    }

    const generated = await generateCoachReport(coach, period);
    report = await upsertReport({
      type: 'coach',
      coachId: coach.id,
      period,
      ...generated,
    });
    log(payload.runId, `coach report for ${coach.name}: ${generated.status} (${generated.provider}/${generated.model})`);
  }

  const content = report.content as unknown as CoachReportContent;
  const periodLabel = formatPeriod(period);
  const status = report.status;
  const reportId = report.id;
  await deliver(report, {
    folderPath: `Weekly reports/${payload.periodStart}`,
    title: coach.name,
    html: renderCoachReportHtml(coach.name, periodLabel, status, content),
    message: (driveUrl) =>
      buildCoachReportMessage(
        coach.slack_user_id ?? getManagerChannel(),
        coach.name,
        periodLabel,
        status,
        content,
        { driveUrl, dashboardUrl: `${getDashboardUrl()}/reports/${reportId}` },
      ),
  });
};

export const handleManagerReport = async (job: JobRow): Promise<void> => {
  const payload = readPayload(job);
  const period = periodOf(payload);

  // Gate: every coach report in the run has succeeded or is dead
  const coachJobs = await listRunCoachJobs(payload.runId);
  const active = coachJobs.filter((j) => j.status === 'pending' || j.status === 'running');
  if (active.length > 0 && !waitedTooLong(job)) {
    throw new RetryLaterError(`Waiting for ${active.length} coach reports`, WAIT_MS, false);
  }

  const missing: CoachRef[] = [];
  for (const j of coachJobs.filter((c) => c.status !== 'succeeded')) {
    const coach = await getCoach(j.coach_id);
    missing.push({ coach_id: j.coach_id, coach_name: coach?.name ?? 'Unknown coach' });
  }

  let report = await existingReport(job, payload, 'manager', null);
  if (!report) {
    const generated = await generateManagerReport(period, missing);
    report = await upsertReport({ type: 'manager', coachId: null, period, ...generated });
    log(payload.runId, `manager report: ${generated.status} (${generated.provider}/${generated.model})`);
  }

  const content = report.content as unknown as ManagerReportContent;
  const periodLabel = formatPeriod(period);
  const status = report.status;
  const reportId = report.id;
  const alreadyDelivered = Boolean(report.slack_message_ts);
  await deliver(report, {
    folderPath: `Weekly reports/${payload.periodStart}`,
    title: 'Manager overview',
    html: renderManagerReportHtml(periodLabel, status, content),
    message: (driveUrl) =>
      buildManagerReportMessage(getManagerChannel(), periodLabel, status, content, {
        driveUrl,
        dashboardUrl: `${getDashboardUrl()}/reports/${reportId}`,
      }),
  });

  const stillMissing = content.stats.coach_reports_missing;
  if (stillMissing.length > 0 && !alreadyDelivered) {
    await sendOpsAlert(
      `Weekly reports partial: ${stillMissing.length} coach report(s) missing`,
      [
        `Week ${periodLabel}. The manager report went out without: ${stillMissing.map((c) => c.coach_name).join(', ')}.`,
        'Fix the cause (see the dead job error), then rerun the week from the Reports page.',
      ],
      { text: 'Open reports', url: `${getDashboardUrl()}/reports?period=${payload.periodStart}` },
      `partial:${payload.runId}`,
    );
  }
};
