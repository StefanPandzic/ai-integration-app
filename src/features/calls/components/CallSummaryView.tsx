import {
  Badge,
  Box,
  Divider,
  HStack,
  ListItem,
  Text,
  UnorderedList,
  VStack,
} from '@chakra-ui/react';
import { useAppColors } from '../../../constants/colors';
import type { CallDetail, CallSummary } from '../types';

interface CallSummaryViewProps {
  detail: CallDetail | null;
}

const SENTIMENT_SCHEME: Record<CallSummary['client_sentiment'], string> = {
  positive: 'green',
  neutral: 'gray',
  mixed: 'yellow',
  negative: 'red',
};

/**
 * Read-only view of one call's structured summary
 */
export const CallSummaryView = ({ detail }: CallSummaryViewProps) => {
  const colors = useAppColors();

  if (!detail) {
    return (
      <Text color={colors.textSecondary} fontSize='sm'>
        Select a call to see its summary.
      </Text>
    );
  }

  const { call, summary } = detail;
  const participants = call.participants.map((p) => p.name).join(', ');

  return (
    <VStack align='stretch' spacing={4}>
      <Box>
        <Text fontWeight='bold' color={colors.headingBlue}>
          {call.title ?? 'Untitled call'}
        </Text>
        <Text fontSize='sm' color={colors.textSecondary}>
          {participants}
        </Text>
      </Box>

      {!summary ? (
        <Text fontSize='sm' color={colors.textSecondary}>
          No summary yet ({call.status.replace('_', ' ')}).
        </Text>
      ) : (
        <>
          <HStack>
            <Badge colorScheme={SENTIMENT_SCHEME[summary.summary.client_sentiment]}>
              {summary.summary.client_sentiment}
            </Badge>
            <Text fontSize='xs' color={colors.textSecondary}>
              {summary.provider}/{summary.model}
            </Text>
          </HStack>

          <Text color={colors.textPrimary}>{summary.summary.overview}</Text>

          {summary.summary.key_points.length > 0 && (
            <Box>
              <Text fontWeight='semibold' mb={1}>
                Key points
              </Text>
              <UnorderedList spacing={1} color={colors.textPrimary}>
                {summary.summary.key_points.map((point) => (
                  <ListItem key={point}>{point}</ListItem>
                ))}
              </UnorderedList>
            </Box>
          )}

          {summary.summary.action_items.length > 0 && (
            <Box>
              <Text fontWeight='semibold' mb={1}>
                Action items
              </Text>
              <UnorderedList spacing={1} color={colors.textPrimary}>
                {summary.summary.action_items.map((item) => (
                  <ListItem key={`${item.owner}-${item.task}`}>
                    <Text as='span' fontWeight='semibold'>
                      {item.owner}
                    </Text>{' '}
                    ({item.owner_role}): {item.task}
                    {item.due && (
                      <Text as='span' color={colors.textSecondary}>
                        {' '}
                        (due {item.due})
                      </Text>
                    )}
                  </ListItem>
                ))}
              </UnorderedList>
            </Box>
          )}

          {summary.summary.risks.length > 0 && (
            <Box>
              <Text fontWeight='semibold' mb={1}>
                Risks
              </Text>
              <UnorderedList spacing={1} color={colors.textPrimary}>
                {summary.summary.risks.map((risk) => (
                  <ListItem key={risk}>{risk}</ListItem>
                ))}
              </UnorderedList>
            </Box>
          )}

          {summary.summary.notable_quotes.length > 0 && (
            <>
              <Divider />
              <VStack align='stretch' spacing={2}>
                {summary.summary.notable_quotes.map((quote) => (
                  <Text
                    key={quote.quote}
                    fontSize='sm'
                    fontStyle='italic'
                    color={colors.textSecondary}
                  >
                    “{quote.quote}” — {quote.speaker}
                  </Text>
                ))}
              </VStack>
            </>
          )}
        </>
      )}
    </VStack>
  );
};
