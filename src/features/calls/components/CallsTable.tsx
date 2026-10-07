import {
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
import type { CallListItem } from '../types';
import { callDate, formatDateTime } from '../utils/format';
import { CallStatusBadge, SentimentBadge } from './CallBadges';

interface CallsTableProps {
  calls: CallListItem[];
  onSelect: (callId: string) => void;
  showClient?: boolean;
  showCoach?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}

const hideOnMobile = { base: 'none', md: 'table-cell' };

export const CallsTable = ({
  calls,
  onSelect,
  showClient = true,
  showCoach = true,
  emptyTitle = 'No calls yet',
  emptyDescription,
}: CallsTableProps) => {
  const colors = useAppColors();

  if (calls.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <TableContainer>
      <Table size='sm' variant='simple'>
        <Thead>
          <Tr>
            <Th py={3}>Call</Th>
            {showClient && <Th>Client</Th>}
            {showCoach && <Th display={hideOnMobile}>Coach</Th>}
            <Th display={hideOnMobile}>Date</Th>
            <Th display={hideOnMobile}>Sentiment</Th>
            <Th display={hideOnMobile} isNumeric>
              Actions
            </Th>
            <Th>Status</Th>
          </Tr>
        </Thead>
        <Tbody>
          {calls.map((call) => (
            <Tr
              key={call.id}
              cursor='pointer'
              _hover={{ bg: colors.bgHover }}
              onClick={() => onSelect(call.id)}
            >
              <Td py={3} maxW='320px'>
                <Text fontWeight='medium' color={colors.heading} noOfLines={1}>
                  {call.title ?? 'Untitled call'}
                </Text>
                <Text fontSize='xs' color={colors.textSecondary}>
                  {call.source}
                </Text>
              </Td>
              {showClient && (
                <Td color={call.client_name ? colors.textPrimary : colors.textSecondary}>
                  {call.client_name ?? 'Unmatched'}
                </Td>
              )}
              {showCoach && (
                <Td display={hideOnMobile} color={colors.textPrimary}>
                  {call.coach_name ?? '—'}
                </Td>
              )}
              <Td display={hideOnMobile} color={colors.textSecondary}>
                {formatDateTime(callDate(call))}
              </Td>
              <Td display={hideOnMobile}>
                <SentimentBadge sentiment={call.client_sentiment} />
              </Td>
              <Td display={hideOnMobile} isNumeric color={colors.textPrimary}>
                {call.action_item_count ?? '—'}
              </Td>
              <Td>
                <CallStatusBadge status={call.status} jobStatus={call.job_status} />
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </TableContainer>
  );
};
