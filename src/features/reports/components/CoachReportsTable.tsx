import { Badge, HStack, Table, TableContainer, Tbody, Td, Text, Th, Thead, Tr } from '@chakra-ui/react';
import { EmptyState } from '../../../components';
import { useAppColors } from '../../../constants/colors';
import type { ReportListItem } from '../types';
import { RatingBadge } from './ReportBadges';

interface CoachReportsTableProps {
  reports: ReportListItem[];
  onSelect: (reportId: string) => void;
}

/** One row per coach report in a week */
export const CoachReportsTable = ({ reports, onSelect }: CoachReportsTableProps) => {
  const colors = useAppColors();

  if (reports.length === 0) {
    return <EmptyState title='No coach reports' description='Coach reports appear here as the run delivers them.' />;
  }

  return (
    <TableContainer>
      <Table size='sm'>
        <Thead>
          <Tr>
            <Th>Coach</Th>
            <Th isNumeric>Calls</Th>
            <Th>Rating</Th>
            <Th>Delivered</Th>
          </Tr>
        </Thead>
        <Tbody>
          {reports.map((report) => (
            <Tr
              key={report.id}
              cursor='pointer'
              _hover={{ bg: colors.bgHover }}
              onClick={() => onSelect(report.id)}
            >
              <Td fontWeight='medium' color={colors.textPrimary}>
                {report.coach_name ?? 'Coach'}
              </Td>
              <Td isNumeric>{report.calls ?? 0}</Td>
              <Td>
                {report.status === 'empty' ? (
                  <Text fontSize='sm' color={colors.textSecondary}>
                    No calls
                  </Text>
                ) : (
                  <RatingBadge value={report.rubric_average} />
                )}
              </Td>
              <Td>
                <HStack spacing={1}>
                  <Badge colorScheme={report.drive_url ? 'green' : 'gray'} variant='subtle'>
                    Drive
                  </Badge>
                  <Badge colorScheme={report.slack_message_ts ? 'green' : 'gray'} variant='subtle'>
                    Slack
                  </Badge>
                </HStack>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </TableContainer>
  );
};
