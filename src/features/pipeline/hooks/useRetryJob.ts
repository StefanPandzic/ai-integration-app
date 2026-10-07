/**
 * useRetryJob
 *
 * Puts a dead job back in the queue and reports it as a toast. Tracks
 * which job is being retried so only that button spins.
 */

import { useToast } from '@chakra-ui/react';
import { useCallback, useState } from 'react';
import { getErrorMessage } from '../../../store/api';
import { createLogger } from '../../logging';
import { useRetryJobMutation } from '../services/pipelineApi';

const logger = createLogger('pipeline');

export const useRetryJob = () => {
  const toast = useToast();
  const [retry] = useRetryJobMutation();
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);

  const retryJob = useCallback(
    async (jobId: string, callId?: string | null) => {
      setRetryingJobId(jobId);
      try {
        await retry({ jobId, callId }).unwrap();
        toast({
          status: 'success',
          title: 'Job queued again',
          description: 'It resumes from the last finished step as soon as the worker picks it up.',
        });
      } catch (error) {
        logger.error('Retry job failed:', error);
        toast({ status: 'error', title: 'Retry failed', description: getErrorMessage(error) });
      } finally {
        setRetryingJobId(null);
      }
    },
    [retry, toast],
  );

  return { retryJob, retryingJobId };
};
