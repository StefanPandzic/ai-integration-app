import { HStack, List, ListIcon, ListItem, Text, Tooltip } from '@chakra-ui/react';
import { ChevronRightIcon } from '@chakra-ui/icons';
import { Badge } from '@chakra-ui/react';
import { useAppColors } from '../../../constants/colors';
import { SENTIMENT_SCHEME, type Sentiment } from '../../calls';
import type { SentimentCounts } from '../types';

/** Bulleted list of model-written lines, or a muted fallback */
export const BulletList = ({ items, empty = 'Nothing this week.' }: { items: string[]; empty?: string }) => {
  const colors = useAppColors();
  if (items.length === 0) {
    return (
      <Text fontSize='sm' color={colors.textSecondary}>
        {empty}
      </Text>
    );
  }
  return (
    <List spacing={2}>
      {items.map((item) => (
        <ListItem key={item} fontSize='sm' color={colors.textPrimary} display='flex'>
          <ListIcon as={ChevronRightIcon} color={colors.textAccent} mt={1} />
          <span>{item}</span>
        </ListItem>
      ))}
    </List>
  );
};

const SENTIMENTS: Sentiment[] = ['positive', 'neutral', 'mixed', 'negative'];

/** Counted sentiment as badges, with optional week-over-week deltas */
export const SentimentCountsView = ({
  counts,
  deltas,
}: {
  counts: SentimentCounts;
  deltas?: SentimentCounts;
}) => (
  <HStack spacing={2} flexWrap='wrap'>
    {SENTIMENTS.map((s) => {
      const delta = deltas?.[s];
      return (
        <Tooltip key={s} label={delta === undefined ? undefined : `${delta >= 0 ? '+' : ''}${delta} vs last week`}>
          <Badge variant='subtle' colorScheme={SENTIMENT_SCHEME[s]}>
            {counts[s]} {s}
          </Badge>
        </Tooltip>
      );
    })}
  </HStack>
);
