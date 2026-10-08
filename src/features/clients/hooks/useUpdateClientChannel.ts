/**
 * useUpdateClientChannel
 *
 * Points a client at another Slack channel (the backend checks it and the
 * bot joins it if public) and reports the outcome as a toast.
 */

import { useToast } from '@chakra-ui/react';
import { useCallback } from 'react';
import { getErrorMessage } from '../../../store/api';
import { createLogger } from '../../logging';
import { useUpdateClientChannelMutation } from '../services/clientsApi';

const logger = createLogger('clients');

export const useUpdateClientChannel = () => {
  const toast = useToast();
  const [update, { isLoading }] = useUpdateClientChannelMutation();

  const updateChannel = useCallback(
    async (clientId: string, slackChannelId: string): Promise<boolean> => {
      try {
        const { channel } = await update({ clientId, slackChannelId }).unwrap();
        toast({
          status: 'success',
          title: `Summaries now post to ${channel.is_private ? '🔒' : '#'}${channel.name}`,
        });
        return true;
      } catch (error) {
        logger.error('Update client channel failed:', error);
        toast({
          status: 'error',
          title: 'Could not change the Slack channel',
          description: getErrorMessage(error),
        });
        return false;
      }
    },
    [update, toast],
  );

  return { updateChannel, isUpdatingChannel: isLoading };
};
