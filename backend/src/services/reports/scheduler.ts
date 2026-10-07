/**
 * Weekly Report Scheduler
 *
 * The cron schedule is the product: REPORTS_CRON (default Monday 7:00,
 * America/Chicago) enqueues last week's run. At startup a catch-up
 * enqueues it too if Monday 7:00 has passed and no run exists for that
 * week, so a server that was asleep or redeploying still delivers. Both
 * use the idempotency key weekly_reports:<periodStart>, so double fires,
 * restarts and several instances enqueue once.
 */

import cron, { ScheduledTask } from 'node-cron';
import {
  REPORTS_TIMEZONE,
  getReportsCron,
  isReportsCronEnabled,
} from '../../config/integrations';
import { RunTrigger, getCatchUpState } from '../../db/reportsRepo';
import { enqueueWeeklyRun } from './runWeeklyReports';

let task: ScheduledTask | null = null;

const enqueue = async (trigger: RunTrigger, periodStart?: string) => {
  try {
    const run = await enqueueWeeklyRun({ trigger, periodStart });
    console.log(
      run.created
        ? `🗓️ Weekly reports (${trigger}) enqueued for ${run.periodStart}, run ${run.runId.slice(0, 8)}`
        : `🗓️ Weekly reports (${trigger}) for ${run.periodStart} already enqueued`,
    );
  } catch (error) {
    console.error(`❌ Weekly reports (${trigger}) could not be enqueued:`, error);
  }
};

const catchUp = async (): Promise<void> => {
  try {
    const { period, due } = await getCatchUpState();
    if (due) await enqueue('catch-up', period.periodStart);
  } catch (error) {
    console.error('❌ Weekly reports catch-up failed:', error);
  }
};

export const startReportScheduler = async (): Promise<void> => {
  if (!isReportsCronEnabled()) {
    console.warn('⚠️ REPORTS_CRON_ENABLED=false: weekly reports run only manually');
    return;
  }

  const expression = getReportsCron();
  if (!cron.validate(expression)) {
    console.error(`❌ Invalid REPORTS_CRON "${expression}": weekly reports not scheduled`);
    return;
  }

  task = cron.schedule(expression, () => enqueue('cron'), {
    name: 'weekly-reports',
    timezone: REPORTS_TIMEZONE,
    noOverlap: true,
  });
  console.log(
    `🗓️ Weekly reports scheduled: "${expression}" ${REPORTS_TIMEZONE}, next ${task.getNextRun()?.toISOString() ?? 'n/a'}`,
  );
  await catchUp();
};

export interface ScheduleInfo {
  enabled: boolean;
  cron: string;
  timezone: string;
  nextRunAt: string | null;
}

export const getScheduleInfo = (): ScheduleInfo => ({
  enabled: task !== null,
  cron: getReportsCron(),
  timezone: REPORTS_TIMEZONE,
  nextRunAt: task?.getNextRun()?.toISOString() ?? null,
});
