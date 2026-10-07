import { SimpleGrid } from '@chakra-ui/react';
import { StatCard } from '../../../components';
import { formatDateTime } from '../../calls';
import type { PipelineHealth } from '../types';
import { formatAge } from '../utils/format';

interface QueueStatsProps {
  health: PipelineHealth;
}

const RUN_STATE_LABEL = {
  running: 'Running',
  ok: 'OK',
  partial: 'Partial',
  failed: 'Failed',
} as const;

/** Queue health at a glance: what's waiting, running, dead, and the automations */
export const QueueStats = ({ health }: QueueStatsProps) => {
  const { queue, lastReconcile, lastReportRun, schedules } = health;
  const waitingForRetry = queue.pending - queue.ready;

  return (
    <SimpleGrid columns={{ base: 2, md: 3, xl: 6 }} spacing={4}>
      <StatCard
        label='Queued'
        value={queue.ready}
        hint={waitingForRetry > 0 ? `+${waitingForRetry} waiting to retry` : 'Ready to run'}
      />
      <StatCard label='Running' value={queue.running} hint='One job at a time' />
      <StatCard
        label='Dead'
        value={queue.dead}
        hint={queue.dead > 0 ? 'See Failures; ops was alerted' : 'Nothing needs attention'}
      />
      <StatCard
        label='Oldest waiting'
        value={formatAge(queue.oldest_ready_age_seconds)}
        hint={`${queue.succeeded_last_hour} done, ${queue.dead_last_hour} dead in the last hour`}
      />
      <StatCard
        label='Last reconcile'
        value={
          lastReconcile?.result
            ? `${lastReconcile.result.recovered} recovered`
            : (lastReconcile?.status ?? 'Never')
        }
        hint={
          schedules.reconcile.enabled
            ? `Next ${formatDateTime(schedules.reconcile.nextRunAt)}`
            : 'Nightly schedule disabled'
        }
      />
      <StatCard
        label='Last report run'
        value={lastReportRun ? RUN_STATE_LABEL[lastReportRun.state] : 'None'}
        hint={
          schedules.reports.enabled
            ? `Next ${formatDateTime(schedules.reports.nextRunAt)}`
            : 'Weekly schedule disabled'
        }
      />
    </SimpleGrid>
  );
};
