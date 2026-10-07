import { Box, HStack, Link, Text, VStack } from '@chakra-ui/react';
import { EmptyState } from '../../../components';
import { useAppColors } from '../../../constants/colors';
import type { AssignableClient, CallListItem } from '../types';
import { callDate, formatDateTime } from '../utils/format';
import { ReviewAssign } from './ReviewAssign';

interface ReviewQueueListProps {
  calls: CallListItem[];
  clients: AssignableClient[];
  assigningCallId: string | null;
  onAssign: (callId: string, clientId: string) => void;
  onOpen: (callId: string) => void;
}

/** Unmatched calls; none are posted to Slack until assigned */
export const ReviewQueueList = ({
  calls,
  clients,
  assigningCallId,
  onAssign,
  onOpen,
}: ReviewQueueListProps) => {
  const colors = useAppColors();

  if (calls.length === 0) {
    return (
      <EmptyState
        title='Review queue is empty'
        description='Calls that cannot be matched to a client by participant email or title keyword land here.'
      />
    );
  }

  return (
    <VStack align='stretch' spacing={0}>
      {calls.map((call, index) => (
        <Box
          key={call.id}
          px={5}
          py={4}
          borderTopWidth={index === 0 ? 0 : '1px'}
          borderColor={colors.border}
        >
          <HStack justify='space-between' align='flex-start' flexWrap='wrap' gap={4}>
            <Box minW={0} flex='1 1 280px'>
              <Link fontWeight='medium' color={colors.heading} onClick={() => onOpen(call.id)}>
                {call.title ?? 'Untitled call'}
              </Link>
              <Text fontSize='sm' color={colors.textSecondary}>
                {formatDateTime(callDate(call))} · {call.source}
              </Text>
              <Text fontSize='sm' color={colors.textPrimary} mt={1}>
                {call.review_reason}
              </Text>
            </Box>
            <Box flex='0 1 340px' minW='240px'>
              <ReviewAssign
                clients={clients}
                isAssigning={assigningCallId === call.id}
                onAssign={(clientId) => onAssign(call.id, clientId)}
              />
            </Box>
          </HStack>
        </Box>
      ))}
    </VStack>
  );
};
