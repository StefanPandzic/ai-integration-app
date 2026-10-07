/**
 * Scheduler: the crons that make the system run unattended
 *
 * - weekly-reports: REPORTS_CRON (default Monday 7:00) enqueues last
 *   week's run. Catch-up: if Monday 7:00 has passed and no run exists for
 *   that week, enqueue it at startup.
 * - reconcile: RECONCILE_CRON (default 2:00 daily) enqueues the Grain
 *   reconcile. Catch-up: if none ran in the last 24 h, enqueue at startup.
 *
 * Both run in America/Chicago and use idempotency keys
 * (weekly_reports:<periodStart>, reconcile:<date>), so double fires,
 * restarts and several instances enqueue once. A server that was asleep
 * or redeploying at the scheduled time still delivers.
 */

import cron, { ScheduledTask } from 'node-cron';
import {
  REPORTS_TIMEZONE,
  getReconcileCron,
  getReportsCron,
  isReconcileCronEnabled,
  isReportsCronEnabled,
} from '../../config/integrations';
import { hasRecentReconcile } from '../../db/jobsRepo';
import { RunTrigger, getCatchUpState } from '../../db/reportsRepo';
import { createLogger } from '../../lib/logger';
import { ReconcileTrigger, enqueueReconcile } from '../pipeline/reconcile';
import { enqueueWeeklyRun } from '../reports/runWeeklyReports';

const RECONCILE_CATCH_UP_HOURS = 24;

const log = createLogger('scheduler');

let reportsTask: ScheduledTask | null = null;
let reconcileTask: ScheduledTask | null = null;

const enqueueReports = async (trigger: RunTrigger, periodStart?: string) => {
  try {
    const run = await enqueueWeeklyRun({ trigger, periodStart });
    log.info(
      run.created
        ? `🗓️ Weekly reports (${trigger}) enqueued for ${run.periodStart}`
        : `🗓️ Weekly reports (${trigger}) for ${run.periodStart} already enqueued`,
      { runId: run.runId },
    );
  } catch (error) {
    log.error(`❌ Weekly reports (${trigger}) could not be enqueued`, { error });
  }
};

const runReconcile = async (trigger: ReconcileTrigger) => {
  try {
    const { jobId, created } = await enqueueReconcile(trigger);
    log.info(
      created
        ? `🔁 Grain reconcile (${trigger}) enqueued`
        : `🔁 Grain reconcile (${trigger}) already enqueued today`,
      { jobId },
    );
  } catch (error) {
    log.error(`❌ Grain reconcile (${trigger}) could not be enqueued`, { error });
  }
};

/** Validates and schedules one cron; null when disabled or invalid */
const schedule = (
  name: string,
  enabled: boolean,
  expression: string,
  run: () => Promise<void>,
): ScheduledTask | null => {
  if (!enabled) {
    log.warn(`⚠️ ${name} cron disabled: runs only manually`);
    return null;
  }
  if (!cron.validate(expression)) {
    log.error(`❌ Invalid ${name} cron "${expression}": not scheduled`);
    return null;
  }
  const task = cron.schedule(expression, run, {
    name,
    timezone: REPORTS_TIMEZONE,
    noOverlap: true,
  });
  log.info(`🗓️ ${name} scheduled: "${expression}" ${REPORTS_TIMEZONE}`, {
    next: task.getNextRun()?.toISOString() ?? 'n/a',
  });
  return task;
};

export const startScheduler = async (): Promise<void> => {
  reportsTask = schedule('weekly-reports', isReportsCronEnabled(), getReportsCron(), () =>
    enqueueReports('cron'),
  );
  reconcileTask = schedule('reconcile', isReconcileCronEnabled(), getReconcileCron(), () =>
    runReconcile('cron'),
  );

  if (reportsTask) {
    try {
      const { period, due } = await getCatchUpState();
      if (due) await enqueueReports('catch-up', period.periodStart);
    } catch (error) {
      log.error('❌ Weekly reports catch-up failed', { error });
    }
  }

  if (reconcileTask) {
    try {
      if (!(await hasRecentReconcile(RECONCILE_CATCH_UP_HOURS))) {
        await runReconcile('catch-up');
      }
    } catch (error) {
      log.error('❌ Grain reconcile catch-up failed', { error });
    }
  }
};

export interface ScheduleInfo {
  enabled: boolean;
  cron: string;
  timezone: string;
  nextRunAt: string | null;
}

export const getScheduleInfo = (): ScheduleInfo => ({
  enabled: reportsTask !== null,
  cron: getReportsCron(),
  timezone: REPORTS_TIMEZONE,
  nextRunAt: reportsTask?.getNextRun()?.toISOString() ?? null,
});

export const getReconcileScheduleInfo = (): ScheduleInfo => ({
  enabled: reconcileTask !== null,
  cron: getReconcileCron(),
  timezone: REPORTS_TIMEZONE,
  nextRunAt: reconcileTask?.getNextRun()?.toISOString() ?? null,
});
