import {
  Alert,
  AlertDescription,
  AlertIcon,
  Box,
  Grid,
  GridItem,
  Link,
  SimpleGrid,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
  Wrap,
  WrapItem,
} from '@chakra-ui/react';
import { EmptyState, Panel, StatCard } from '../../../components';
import { useAppColors } from '../../../constants/colors';
import type { ManagerReportContent, ReportStatus } from '../types';
import { formatDelta, formatRating } from '../utils/format';
import { RatingBadge } from './ReportBadges';
import { BulletList, SentimentCountsView } from './ReportParts';

interface ManagerReportViewProps {
  status: ReportStatus;
  content: ManagerReportContent;
  onOpenClient: (clientId: string) => void;
  onOpenCoach: (coachId: string) => void;
  onOpenReport: (reportId: string) => void;
}

interface ClientLinksProps {
  ids: string[];
  names: Record<string, string>;
  onOpenClient: (clientId: string) => void;
}

const ClientLinks = ({ ids, names, onOpenClient }: ClientLinksProps) => {
  const colors = useAppColors();
  return (
    <Wrap spacing={2} mt={1}>
      {ids.map((id) => (
        <WrapItem key={id}>
          <Link fontSize='xs' color={colors.textAccent} onClick={() => onOpenClient(id)}>
            {names[id] ?? 'Unknown client'}
          </Link>
        </WrapItem>
      ))}
    </Wrap>
  );
};

const withDelta = (value: string | number, delta: number | null) => {
  const formatted = formatDelta(delta);
  return formatted ? `${value} (${formatted})` : String(value);
};

export const ManagerReportView = ({
  status,
  content,
  onOpenClient,
  onOpenCoach,
  onOpenReport,
}: ManagerReportViewProps) => {
  const colors = useAppColors();
  const { stats } = content;
  const clientName = (id: string) => content.client_names[id] ?? 'Unknown client';

  return (
    <VStack align='stretch' spacing={6}>
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
        <StatCard label='Calls' value={withDelta(stats.calls, stats.deltas.calls)} hint={`${stats.clients} clients`} />
        <StatCard
          label='Avg coach rating'
          value={withDelta(formatRating(stats.rubric_average), stats.deltas.rubric_average)}
          hint={`Last week ${formatRating(stats.previous.rubric_average)}`}
        />
        <StatCard
          label='Negative calls'
          value={withDelta(stats.sentiment.negative, stats.deltas.sentiment.negative)}
          hint={`${stats.sentiment.mixed} mixed`}
        />
        <StatCard label='Excluded calls' value={stats.excluded_calls} hint='Processing, review or failed' />
      </SimpleGrid>

      {stats.coach_reports_missing.length > 0 && (
        <Alert status='warning' borderRadius='lg'>
          <AlertIcon />
          <AlertDescription fontSize='sm'>
            Missing coach reports: {stats.coach_reports_missing.map((c) => c.coach_name).join(', ')}. Their
            numbers are counted, but their clients are not in the analysis below.
          </AlertDescription>
        </Alert>
      )}

      <Panel title='Client sentiment'>
        <VStack align='stretch' spacing={3} p={5}>
          <SentimentCountsView counts={stats.sentiment} deltas={stats.deltas.sentiment} />
          {content.sentiment_notes && (
            <Text fontSize='sm' color={colors.textPrimary}>
              {content.sentiment_notes}
            </Text>
          )}
        </VStack>
      </Panel>

      {status === 'empty' ? (
        <Panel>
          <EmptyState
            title='No coach reports with calls'
            description='No coach had summarized calls this week, so there is nothing to analyze.'
          />
        </Panel>
      ) : (
        <Grid templateColumns={{ base: '1fr', xl: 'minmax(0, 1fr) minmax(0, 1fr)' }} gap={6}>
          <GridItem>
            <VStack align='stretch' spacing={6}>
              <Panel title='Trends'>
                <Box p={5}>
                  <BulletList items={content.trends ?? []} />
                </Box>
              </Panel>
              <Panel title='At-risk clients'>
                <VStack align='stretch' spacing={3} p={5}>
                  {(content.at_risk_clients ?? []).length === 0 && (
                    <Text fontSize='sm' color={colors.textSecondary}>
                      No clients flagged.
                    </Text>
                  )}
                  {(content.at_risk_clients ?? []).map((c) => (
                    <Box key={c.client_id}>
                      <Link fontWeight='medium' fontSize='sm' color={colors.textAccent} onClick={() => onOpenClient(c.client_id)}>
                        {clientName(c.client_id)}
                      </Link>
                      <Text fontSize='sm' color={colors.textPrimary}>
                        {c.reason}
                      </Text>
                    </Box>
                  ))}
                </VStack>
              </Panel>
            </VStack>
          </GridItem>
          <GridItem>
            <VStack align='stretch' spacing={6}>
              <Panel title='Client concerns'>
                <VStack align='stretch' spacing={3} p={5}>
                  {(content.client_concerns ?? []).length === 0 && (
                    <Text fontSize='sm' color={colors.textSecondary}>
                      No shared concerns.
                    </Text>
                  )}
                  {(content.client_concerns ?? []).map((c) => (
                    <Box key={c.concern}>
                      <Text fontSize='sm' color={colors.textPrimary}>
                        {c.concern}
                      </Text>
                      <ClientLinks ids={c.client_ids} names={content.client_names} onOpenClient={onOpenClient} />
                    </Box>
                  ))}
                </VStack>
              </Panel>
              <Panel title='Content ideas'>
                <VStack align='stretch' spacing={4} p={5}>
                  {(content.content_ideas ?? []).length === 0 && (
                    <Text fontSize='sm' color={colors.textSecondary}>
                      No ideas this week.
                    </Text>
                  )}
                  {(content.content_ideas ?? []).map((idea) => (
                    <Box key={idea.title}>
                      <Text fontWeight='semibold' fontSize='sm' color={colors.heading}>
                        {idea.title}
                      </Text>
                      <Text fontSize='sm' color={colors.textPrimary}>
                        {idea.angle}
                      </Text>
                      <ClientLinks ids={idea.client_ids} names={content.client_names} onOpenClient={onOpenClient} />
                    </Box>
                  ))}
                </VStack>
              </Panel>
            </VStack>
          </GridItem>
        </Grid>
      )}

      <Panel title='Coaches'>
        <TableContainer whiteSpace='normal'>
          <Table size='sm'>
            <Thead>
              <Tr>
                <Th>Coach</Th>
                <Th isNumeric>Calls</Th>
                <Th>Rating</Th>
                <Th>Highlight</Th>
                <Th />
              </Tr>
            </Thead>
            <Tbody>
              {stats.per_coach.map((coach) => {
                const note = content.coach_highlights?.find((h) => h.coach_id === coach.coach_id)?.note;
                const missing = stats.coach_reports_missing.some((m) => m.coach_id === coach.coach_id);
                return (
                  <Tr key={coach.coach_id}>
                      <Td>
                        <Link fontWeight='medium' color={colors.textAccent} onClick={() => onOpenCoach(coach.coach_id)}>
                          {coach.coach_name}
                        </Link>
                      </Td>
                      <Td isNumeric>{coach.calls}</Td>
                      <Td>
                        <RatingBadge value={coach.rubric_average} />
                      </Td>
                      <Td fontSize='sm' color={colors.textPrimary}>
                        {note ?? (missing ? 'Report missing' : coach.calls === 0 ? 'No calls this week' : '—')}
                      </Td>
                      <Td>
                        {coach.report_id && (
                          <Link fontSize='sm' color={colors.textAccent} onClick={() => onOpenReport(coach.report_id ?? '')}>
                            Report
                          </Link>
                        )}
                      </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        </TableContainer>
      </Panel>
    </VStack>
  );
};
