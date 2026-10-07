import {
  Box,
  Grid,
  HStack,
  ListItem,
  Text,
  Tooltip,
  UnorderedList,
} from '@chakra-ui/react';
import { EmptyState, Panel } from '../../../components';
import { useAppColors } from '../../../constants/colors';
import {
  ActionItemList,
  SentimentBadge,
  formatDate,
  type ActionItemEntry,
} from '../../calls';
import type { ClientCallSummary } from '../types';

interface ClientInsightsProps {
  /** Newest first */
  summaries: ClientCallSummary[];
}

const RISK_LOOKBACK_CALLS = 3;

/**
 * What the client's recent summaries say: sentiment over time, the
 * latest call's commitments and recent risks
 */
export const ClientInsights = ({ summaries }: ClientInsightsProps) => {
  const colors = useAppColors();

  if (summaries.length === 0) {
    return (
      <Panel>
        <EmptyState
          title='No summarized calls yet'
          description='Insights appear after the first call for this client is summarized.'
        />
      </Panel>
    );
  }

  const [latest] = summaries;
  const latestItems: ActionItemEntry[] = latest.summary.action_items.map((item) => ({
    ...item,
    source: formatDate(latest.call_date),
  }));
  const risks = summaries
    .slice(0, RISK_LOOKBACK_CALLS)
    .flatMap((s) => s.summary.risks.map((risk) => ({ risk, date: s.call_date })));

  return (
    <Grid templateColumns={{ base: '1fr', xl: '1fr 1fr' }} gap={6}>
      <Panel title='Sentiment over time' gridColumn={{ xl: '1 / -1' }}>
        <HStack spacing={2} p={5} flexWrap='wrap' rowGap={2}>
          {[...summaries].reverse().map((s) => (
            <Tooltip key={s.call_id} label={s.title ?? 'Untitled call'} hasArrow>
              <Box textAlign='center'>
                <SentimentBadge sentiment={s.summary.client_sentiment} />
                <Text fontSize='xs' color={colors.textSecondary} mt={1}>
                  {formatDate(s.call_date)}
                </Text>
              </Box>
            </Tooltip>
          ))}
        </HStack>
      </Panel>

      <Panel title='Latest commitments'>
        <Box px={5} py={2}>
          {latestItems.length > 0 ? (
            <ActionItemList items={latestItems} />
          ) : (
            <Text py={3} fontSize='sm' color={colors.textSecondary}>
              No action items on the latest call.
            </Text>
          )}
        </Box>
      </Panel>

      <Panel title='Recent risks'>
        <Box p={5}>
          {risks.length > 0 ? (
            <UnorderedList spacing={2} color={colors.textPrimary}>
              {risks.map(({ risk, date }) => (
                <ListItem key={`${date}-${risk}`}>
                  {risk}{' '}
                  <Text as='span' fontSize='xs' color={colors.textSecondary}>
                    · {formatDate(date)}
                  </Text>
                </ListItem>
              ))}
            </UnorderedList>
          ) : (
            <Text fontSize='sm' color={colors.textSecondary}>
              No risks flagged in the last {RISK_LOOKBACK_CALLS} calls.
            </Text>
          )}
        </Box>
      </Panel>
    </Grid>
  );
};
