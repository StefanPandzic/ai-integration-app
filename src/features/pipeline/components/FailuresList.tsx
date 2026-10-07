import { Box, Button, Code, HStack, Link, Text, VStack } from '@chakra-ui/react';
import { EmptyState } from '../../../components';
import { useAppColors } from '../../../constants/colors';
import { formatDateTime } from '../../calls';
import type { JobFeedItem } from '../types';
import { JOB_TYPE_LABEL, jobLink, jobSubject } from '../utils/format';

interface FailuresListProps {
  jobs: JobFeedItem[];
  retryingJobId: string | null;
  onRetry: (job: JobFeedItem) => void;
  onOpen: (path: string) => void;
}

/** Dead jobs: each one already alerted ops; Retry resumes from the last finished step */
export const FailuresList = ({ jobs, retryingJobId, onRetry, onOpen }: FailuresListProps) => {
  const colors = useAppColors();

  if (jobs.length === 0) {
    return (
      <EmptyState
        title='No failures'
        description='Jobs that run out of retries land here, and ops gets a Slack alert for each.'
      />
    );
  }

  return (
    <VStack align='stretch' spacing={0}>
      {jobs.map((job, index) => {
        const link = jobLink(job);
        return (
          <Box
            key={job.id}
            px={5}
            py={4}
            borderTopWidth={index === 0 ? 0 : '1px'}
            borderColor={colors.border}
          >
            <HStack justify='space-between' align='flex-start' flexWrap='wrap' gap={4}>
              <Box minW={0} flex='1 1 320px'>
                <HStack spacing={2} flexWrap='wrap'>
                  <Text fontWeight='medium' color={colors.heading}>
                    {JOB_TYPE_LABEL[job.type]}
                  </Text>
                  {link ? (
                    <Link color={colors.textAccent} onClick={() => onOpen(link)}>
                      {jobSubject(job)}
                    </Link>
                  ) : (
                    <Text color={colors.textPrimary}>{jobSubject(job)}</Text>
                  )}
                </HStack>
                <Text fontSize='sm' color={colors.textSecondary}>
                  Died {formatDateTime(job.updated_at)} after {job.attempts} attempt(s)
                </Text>
                {job.last_error && (
                  <Code
                    mt={2}
                    display='block'
                    whiteSpace='pre-wrap'
                    wordBreak='break-word'
                    fontSize='xs'
                    p={2}
                    borderRadius='md'
                  >
                    {job.last_error}
                  </Code>
                )}
              </Box>
              <Button
                size='sm'
                colorScheme='brand'
                isLoading={retryingJobId === job.id}
                onClick={() => onRetry(job)}
              >
                Retry
              </Button>
            </HStack>
          </Box>
        );
      })}
    </VStack>
  );
};
