import {
  Alert,
  AlertDescription,
  AlertIcon,
  Box,
  Button,
  HStack,
  SimpleGrid,
  Text,
  VStack,
} from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { Panel } from '../../../components';
import { useAppColors } from '../../../constants/colors';
import { formatDateTime } from '../../calls';
import type { ReportRun, ReportSchedule } from '../types';
import { TRIGGER_LABEL, formatPeriod } from '../utils/format';
import { RunStateBadge } from './ReportBadges';

interface RunStatusPanelProps {
  schedule: ReportSchedule | null;
  latestRun: ReportRun | null;
  onRerun: () => void;
}

const Item = ({ label, children }: { label: string; children: ReactNode }) => {
  const colors = useAppColors();
  return (
    <VStack align='flex-start' spacing={1} minW={0}>
      <Text fontSize='xs' textTransform='uppercase' letterSpacing='wide' color={colors.textSecondary}>
        {label}
      </Text>
      <Box fontSize='sm' color={colors.textPrimary}>
        {children}
      </Box>
    </VStack>
  );
};

/** Monitoring strip: schedule, last run state, and the rerun admin action */
export const RunStatusPanel = ({ schedule, latestRun, onRerun }: RunStatusPanelProps) => {
  const colors = useAppColors();
  const missing = latestRun?.missing_coaches ?? [];

  return (
    <Panel
      title='Automation'
      actions={
        <Button size='sm' variant='ghost' onClick={onRerun}>
          Rerun week…
        </Button>
      }
    >
      <VStack align='stretch' spacing={4} p={5}>
        <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} spacing={5}>
          <Item label='Next scheduled run'>
            {schedule?.enabled ? (
              <>
                <Text fontWeight='medium'>{formatDateTime(schedule.nextRunAt)}</Text>
                <Text fontSize='xs' color={colors.textSecondary}>
                  cron “{schedule.cron}” · {schedule.timezone}
                </Text>
              </>
            ) : (
              <Text color={colors.textSecondary}>Schedule disabled (manual runs only)</Text>
            )}
          </Item>
          <Item label='Last run'>
            {latestRun ? (
              <HStack spacing={2} flexWrap='wrap'>
                <RunStateBadge state={latestRun.state} />
                <Text fontSize='xs' color={colors.textSecondary}>
                  {TRIGGER_LABEL[latestRun.trigger]}
                </Text>
              </HStack>
            ) : (
              <Text color={colors.textSecondary}>No runs yet</Text>
            )}
          </Item>
          <Item label='Week'>
            {latestRun ? formatPeriod(latestRun.period_start, latestRun.period_end) : '—'}
          </Item>
          <Item label='Coach reports'>
            {latestRun ? (
              <Text>
                {latestRun.coach_jobs.succeeded}/{latestRun.coach_jobs.total} delivered
                {latestRun.coach_jobs.active > 0 && ` · ${latestRun.coach_jobs.active} in progress`}
                {latestRun.coach_jobs.dead > 0 && ` · ${latestRun.coach_jobs.dead} failed`}
              </Text>
            ) : (
              '—'
            )}
          </Item>
        </SimpleGrid>

        {latestRun && (latestRun.state === 'partial' || latestRun.state === 'failed') && (
          <Alert status={latestRun.state === 'failed' ? 'error' : 'warning'} borderRadius='md' fontSize='sm'>
            <AlertIcon />
            <AlertDescription wordBreak='break-word'>
              {missing.length > 0 &&
                `Missing coach reports: ${missing.map((c) => c.coach_name ?? 'unknown coach').join(', ')}. `}
              {latestRun.error}
              {' '}An ops alert was sent; rerun the week once the cause is fixed.
            </AlertDescription>
          </Alert>
        )}
      </VStack>
    </Panel>
  );
};
