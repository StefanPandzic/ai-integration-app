import { Box, HStack, Link, Text, VStack } from '@chakra-ui/react';
import { useEffect, useRef } from 'react';
import { EmptyState } from '../../../components';
import { useAppColors } from '../../../constants/colors';
import type { SlackChannelOptions } from '../../slack';
import type {
  AssignableClient,
  AssignableCoach,
  AssignTarget,
  CallListItem,
} from '../types';
import { callDate, formatDateTime } from '../utils/format';
import { ReviewAssign } from './ReviewAssign';

interface ReviewQueueListProps {
  calls: CallListItem[];
  clients: AssignableClient[];
  coaches: AssignableCoach[];
  slackChannels: SlackChannelOptions;
  assigningCallId: string | null;
  /** Scrolled into view and highlighted (ops alert link: /review?call=) */
  highlightCallId?: string | null;
  onAssign: (callId: string, target: AssignTarget) => void;
  onOpen: (callId: string) => void;
}

/** Unmatched calls; none are posted to Slack until assigned */
export const ReviewQueueList = ({
  calls,
  clients,
  coaches,
  slackChannels,
  assigningCallId,
  highlightCallId = null,
  onAssign,
  onOpen,
}: ReviewQueueListProps) => {
  const colors = useAppColors();
  const highlightRef = useRef<HTMLDivElement>(null);
  const hasHighlight = calls.some((call) => call.id === highlightCallId);

  useEffect(() => {
    if (hasHighlight) {
      highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [hasHighlight]);

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
          ref={call.id === highlightCallId ? highlightRef : undefined}
          px={5}
          py={4}
          borderTopWidth={index === 0 ? 0 : '1px'}
          borderColor={colors.border}
          bg={call.id === highlightCallId ? colors.bgActive : undefined}
          borderLeftWidth={call.id === highlightCallId ? '3px' : 0}
          borderLeftColor={colors.borderAccent}
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
                coaches={coaches}
                slackChannels={slackChannels}
                participants={call.participants}
                isAssigning={assigningCallId === call.id}
                onAssign={(target) => onAssign(call.id, target)}
              />
            </Box>
          </HStack>
        </Box>
      ))}
    </VStack>
  );
};
