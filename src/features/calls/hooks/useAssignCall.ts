/**
 * useAssignCall
 *
 * Resolves a review-queue call (to an existing or a new client) and
 * reports the outcome as a toast.
 */

import { useToast } from '@chakra-ui/react';
import { useCallback } from 'react';
import { createLogger } from '../../logging';
import { getErrorMessage } from '../../../store/api';
import { useAssignCallMutation } from '../services/callsApi';
import type { AssignTarget } from '../types';

const logger = createLogger('calls');

export const useAssignCall = () => {
  const toast = useToast();
  const [assign, { isLoading, originalArgs }] = useAssignCallMutation();

  const assignCall = useCallback(
    async (callId: string, target: AssignTarget) => {
      try {
        await assign({ callId, target }).unwrap();
        toast({
          status: 'success',
          title:
            'newClient' in target
              ? `Added ${target.newClient.name}; summarizing now`
              : 'Call assigned; summarizing now',
        });
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
