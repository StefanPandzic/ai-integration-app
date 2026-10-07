/**
 * useAssignCall
 *
 * Resolves a review-queue call and reports the outcome as a toast.
 */

import { useToast } from '@chakra-ui/react';
import { useCallback } from 'react';
import { createLogger } from '../../logging';
import { getErrorMessage } from '../../../store/api';
import { useAssignCallMutation } from '../services/callsApi';

const logger = createLogger('calls');

export const useAssignCall = () => {
  const toast = useToast();
  const [assign, { isLoading, originalArgs }] = useAssignCallMutation();

  const assignCall = useCallback(
    async (callId: string, clientId: string) => {
      try {
        await assign({ callId, clientId }).unwrap();
        toast({ status: 'success', title: 'Call assigned; summarizing now' });
      } catch (error) {
        logger.error('Assign call failed:', error);
        toast({
          status: 'error',
          title: 'Could not assign call',
          description: getErrorMessage(error),
        });
      }
    },
    [assign, toast],
  );

  return {
    assignCall,
    assigningCallId: isLoading ? (originalArgs?.callId ?? null) : null,
  };
};
