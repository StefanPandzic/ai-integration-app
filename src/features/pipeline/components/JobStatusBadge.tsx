import { Badge, HStack, Spinner } from '@chakra-ui/react';
import type { JobStatus } from '../../calls';
import { JOB_STATUS_SCHEME } from '../utils/format';

interface JobStatusBadgeProps {
  status: JobStatus;
  /** A pending job that already ran is waiting for its retry */
  attempts?: number;
}

export const JobStatusBadge = ({ status, attempts = 0 }: JobStatusBadgeProps) => {
  const label = status === 'pending' && attempts > 0 ? 'retrying' : status;
  return (
    <HStack spacing={1.5}>
      <Badge colorScheme={label === 'retrying' ? 'orange' : JOB_STATUS_SCHEME[status]}>
        {label}
      </Badge>
      {status === 'running' && <Spinner size='xs' />}
    </HStack>
  );
};
