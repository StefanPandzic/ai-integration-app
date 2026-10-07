import {
  Box,
  HStack,
  ListItem,
  Text,
  UnorderedList,
  VStack,
} from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { EmptyState } from '../../../components';
import { useAppColors } from '../../../constants/colors';
import type { CallStatus, StoredSummary } from '../types';
import { STATUS_LABEL } from '../utils/format';
import { ActionItemList } from './ActionItemList';
import { SentimentBadge } from './CallBadges';

interface CallSummaryViewProps {
  summary: StoredSummary | null;
  status: CallStatus;
}

const Section = ({ title, children }: { title: string; children: ReactNode }) => {
  const colors = useAppColors();
  return (
    <Box>
      <Text
        fontSize='xs'
        fontWeight='semibold'
        textTransform='uppercase'
        letterSpacing='wide'
        color={colors.textSecondary}
        mb={2}
      >
        {title}
      </Text>
      {children}
    </Box>
  );
};

/**
 * Read-only view of one call's structured summary
 */
export const CallSummaryView = ({ summary, status }: CallSummaryViewProps) => {
  const colors = useAppColors();

  if (!summary) {
    return (
      <EmptyState
        title='No summary yet'
        description={
          status === 'needs_review'
            ? 'Assign this call to a client to summarize it.'
            : `Status: ${STATUS_LABEL[status]}. The summary appears here once the pipeline finishes.`
        }
      />
    );
  }

  const { overview, key_points, action_items, client_sentiment, risks, notable_quotes } =
    summary.summary;

  return (
    <VStack align='stretch' spacing={6}>
      <Section title='Overview'>
        <HStack mb={2}>
          <SentimentBadge sentiment={client_sentiment} />
          <Text fontSize='xs' color={colors.textSecondary}>
            {summary.provider}/{summary.model}
          </Text>
        </HStack>
        <Text color={colors.textPrimary} lineHeight='tall'>
          {overview}
        </Text>
      </Section>

      {key_points.length > 0 && (
        <Section title='Key points'>
          <UnorderedList spacing={1.5} color={colors.textPrimary}>
            {key_points.map((point) => (
              <ListItem key={point}>{point}</ListItem>
            ))}
          </UnorderedList>
        </Section>
      )}

      {action_items.length > 0 && (
        <Section title={`Action items (${action_items.length})`}>
          <ActionItemList items={action_items} />
        </Section>
      )}

      {risks.length > 0 && (
        <Section title='Risks'>
          <UnorderedList spacing={1.5} color={colors.textPrimary}>
            {risks.map((risk) => (
              <ListItem key={risk}>{risk}</ListItem>
            ))}
          </UnorderedList>
        </Section>
      )}

      {notable_quotes.length > 0 && (
        <Section title='Notable quotes'>
          <VStack align='stretch' spacing={3}>
            {notable_quotes.map((quote) => (
              <Box
                key={quote.quote}
                borderLeftWidth='3px'
                borderColor={colors.quoteBorder}
                pl={3}
              >
                <Text fontStyle='italic' color={colors.textPrimary}>
                  “{quote.quote}”
                </Text>
                <Text fontSize='sm' color={colors.textSecondary}>
                  {quote.speaker}
                </Text>
              </Box>
            ))}
          </VStack>
        </Section>
      )}
    </VStack>
  );
};
