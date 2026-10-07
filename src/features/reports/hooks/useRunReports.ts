/**
 * useRunReports
 *
 * Starts a manual run (backfill or rerun) and reports it as a toast.
 */

import { useToast } from '@chakra-ui/react';
import { useCallback } from 'react';
import { getErrorMessage } from '../../../store/api';
import { createLogger } from '../../logging';
import { useRunReportsMutation } from '../services/reportsApi';
import { formatPeriod } from '../utils/format';

const logger = createLogger('reports');

export const useRunReports = () => {
  const toast = useToast();
  const [run, { isLoading }] = useRunReportsMutation();

  const runReports = useCallback(
    async (periodStart?: string) => {
      try {
        const handle = await run(periodStart ? { periodStart } : undefined).unwrap();
        toast({
          status: 'success',
          title: `Rerunning ${formatPeriod(handle.periodStart, handle.periodEnd)}`,
          description: 'Reports are regenerated and delivered again as the worker gets to them.',
        });
        return true;
      } catch (error) {
        logger.error('Run reports failed:', error);
        toast({
          status: 'error',
          title: 'Could not start the run',
          description: getErrorMessage(error),
        });
        return false;
      }
    },
    [run, toast],
  );

  return { runReports, isStarting: isLoading };
};
