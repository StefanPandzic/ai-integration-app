import {
  Link,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react';
import { EmptyState } from '../../../components';
import { useAppColors } from '../../../constants/colors';
import type { JobFeedItem } from '../types';
import { JOB_TYPE_LABEL, ageSince, jobLink, jobSubject } from '../utils/format';
import { JobStatusBadge } from './JobStatusBadge';

interface JobFeedTableProps {
  jobs: JobFeedItem[];
  onOpen: (path: string) => void;
}

const hideOnMobile = { base: 'none', md: 'table-cell' };

/** Most recently changed jobs first */
export const JobFeedTable = ({ jobs, onOpen }: JobFeedTableProps) => {
  const colors = useAppColors();

  if (jobs.length === 0) {
    return (
      <EmptyState
        title='No jobs yet'
        description='Simulate a call: its fetch and process jobs appear here as the worker runs them.'
      />
    );
  }

  return (
    <TableContainer>
      <Table size='sm' variant='simple'>
        <Thead>
          <Tr>
            <Th py={3}>Job</Th>
            <Th>Subject</Th>
            <Th>Status</Th>
            <Th display={hideOnMobile} isNumeric>
              Attempt
            </Th>
            <Th display={hideOnMobile}>Updated</Th>
          </Tr>
        </Thead>
        <Tbody>
          {jobs.map((job) => {
            const link = jobLink(job);
            return (
              <Tr key={job.id}>
                <Td py={3}>
                  <Text fontWeight='medium' color={colors.heading}>
                    {JOB_TYPE_LABEL[job.type]}
                  </Text>
                  <Text fontSize='xs' color={colors.textSecondary}>
                    {job.id.slice(0, 8)}
                  </Text>
                </Td>
                <Td maxW='340px'>
                  {link ? (
                    <Link color={colors.textAccent} onClick={() => onOpen(link)} noOfLines={1}>
                      {jobSubject(job)}
                    </Link>
                  ) : (
                    <Text color={colors.textPrimary} noOfLines={1}>
                      {jobSubject(job)}
                    </Text>
                  )}
                  {job.last_error && job.status !== 'succeeded' && (
                    <Text fontSize='xs' color={colors.textSecondary} noOfLines={1} title={job.last_error}>
                      {job.last_error}
                    </Text>
                  )}
                </Td>
                <Td>
                  <JobStatusBadge status={job.status} attempts={job.attempts} />
                </Td>
                <Td display={hideOnMobile} isNumeric color={colors.textSecondary}>
                  {job.attempts}/{job.max_attempts}
                </Td>
                <Td display={hideOnMobile} color={colors.textSecondary}>
                  {ageSince(job.updated_at)} ago
                </Td>
              </Tr>
            );
          })}
        </Tbody>
      </Table>
    </TableContainer>
  );
};
