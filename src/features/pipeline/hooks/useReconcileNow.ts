/**
 * useReconcileNow
 *
 * Starts a manual Grain reconcile (normally nightly) and reports it as a toast.
 */

import { useToast } from '@chakra-ui/react';
import { useCallback } from 'react';
import { getErrorMessage } from '../../../store/api';
import { createLogger } from '../../logging';
import { useReconcileNowMutation } from '../services/pipelineApi';

const logger = createLogger('pipeline');

export const useReconcileNow = () => {
  const toast = useToast();
  const [reconcile, { isLoading }] = useReconcileNowMutation();

  const reconcileNow = useCallback(async () => {
    try {
      await reconcile().unwrap();
      toast({
        status: 'success',
        title: 'Reconcile queued',
        description: 'Recordings Grain has but we never received are fetched and processed.',
      });
    } catch (error) {
      logger.error('Reconcile failed:', error);
      toast({ status: 'error', title: 'Reconcile failed', description: getErrorMessage(error) });
    }
  }, [reconcile, toast]);

  return { reconcileNow, isReconciling: isLoading };
};
