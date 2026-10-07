import { Badge, HStack, Spinner } from '@chakra-ui/react';
import type { CallStatus, JobStatus, Sentiment } from '../types';
import { SENTIMENT_SCHEME, STATUS_LABEL, STATUS_SCHEME } from '../utils/format';

interface CallStatusBadgeProps {
  status: CallStatus;
  jobStatus?: JobStatus | null;
}

/** Pipeline status, with a spinner while the worker is on it */
export const CallStatusBadge = ({ status, jobStatus }: CallStatusBadgeProps) => (
  <HStack spacing={1.5}>
    <Badge colorScheme={STATUS_SCHEME[status]}>{STATUS_LABEL[status]}</Badge>
    {jobStatus === 'running' && <Spinner size='xs' />}
  </HStack>
);

interface SentimentBadgeProps {
  sentiment: Sentiment | null;
}

export const SentimentBadge = ({ sentiment }: SentimentBadgeProps) =>
  sentiment ? (
    <Badge variant='subtle' colorScheme={SENTIMENT_SCHEME[sentiment]}>
      {sentiment}
    </Badge>
  ) : null;
