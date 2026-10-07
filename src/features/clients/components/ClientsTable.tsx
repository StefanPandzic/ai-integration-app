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
import { SentimentBadge, formatDate } from '../../calls';
import type { ClientListItem } from '../types';

interface ClientsTableProps {
  clients: ClientListItem[];
  onSelect: (clientId: string) => void;
  showCoach?: boolean;
}

const hideOnMobile = { base: 'none', md: 'table-cell' };

export const ClientsTable = ({ clients, onSelect, showCoach = true }: ClientsTableProps) => {
  const colors = useAppColors();

  if (clients.length === 0) {
    return (
      <EmptyState
        title='No clients'
        description='Clients come from the seed data (npm run db:seed in backend/).'
      />
    );
  }

  return (
    <TableContainer>
      <Table size='sm' variant='simple'>
        <Thead>
          <Tr>
            <Th py={3}>Client</Th>
            {showCoach && <Th>Coach</Th>}
            <Th display={hideOnMobile} isNumeric>
              Calls
            </Th>
            <Th display={hideOnMobile}>Last call</Th>
            <Th>Latest sentiment</Th>
          </Tr>
        </Thead>
        <Tbody>
          {clients.map((client) => (
            <Tr
              key={client.id}
              cursor='pointer'
              _hover={{ bg: colors.bgHover }}
              onClick={() => onSelect(client.id)}
            >
              <Td py={3}>
                <Text fontWeight='medium' color={colors.heading}>
                  {client.name}
                </Text>
                <Text fontSize='xs' color={colors.textSecondary}>
                  {client.email ?? 'No email'}
                </Text>
              </Td>
              {showCoach && <Td color={colors.textPrimary}>{client.coach_name ?? '—'}</Td>}
              <Td display={hideOnMobile} isNumeric color={colors.textPrimary}>
                {client.call_count}
              </Td>
              <Td display={hideOnMobile} color={colors.textSecondary}>
                {formatDate(client.last_call_at)}
              </Td>
              <Td>
                {client.latest_sentiment ? (
                  <SentimentBadge sentiment={client.latest_sentiment} />
                ) : (
                  <Text color={colors.textSecondary}>—</Text>
                )}
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </TableContainer>
  );
};
