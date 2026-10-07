import { Badge, Box, Grid, HStack, Text, VStack } from '@chakra-ui/react';
import { EmptyState } from '../../../components';
import { useAppColors } from '../../../constants/colors';
import { formatDateTime } from '../../calls';
import type { OutboxItem } from '../types';
import { BlockKitPreview } from './BlockKitPreview';

interface SlackOutboxProps {
  items: OutboxItem[];
  selectedTarget: string | null;
  highlightedItemId: string | null;
  onSelectTarget: (target: string) => void;
}

/** Channels and DMs (user IDs start with U) with their messages, newest first */
export const groupByTarget = (items: OutboxItem[]): [string, OutboxItem[]][] => {
  const groups = new Map<string, OutboxItem[]>();
  for (const item of items) {
    groups.set(item.target, [...(groups.get(item.target) ?? []), item]);
  }
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
};

const targetLabel = (target: string): string =>
  /^U[A-Z0-9]+$/.test(target) ? `DM ${target}` : target.startsWith('#') ? target : `#${target}`;

export const SlackOutbox = ({ items, selectedTarget, highlightedItemId, onSelectTarget }: SlackOutboxProps) => {
  const colors = useAppColors();
  const groups = groupByTarget(items);
  const messages = groups.find(([target]) => target === selectedTarget)?.[1] ?? [];

  if (items.length === 0) {
    return (
      <EmptyState
        title='Nothing sent yet'
        description='Call summaries, weekly reports and ops alerts appear here as the mock Slack connector "sends" them.'
      />
    );
  }

  return (
    <Grid templateColumns={{ base: '1fr', md: '220px minmax(0, 1fr)' }} minH='400px'>
      <VStack
        align='stretch'
        spacing={0.5}
        p={3}
        borderRightWidth={{ base: 0, md: '1px' }}
        borderBottomWidth={{ base: '1px', md: 0 }}
        borderColor={colors.border}
      >
        {groups.map(([target, group]) => (
          <HStack
            key={target}
            px={3}
            py={2}
            borderRadius='md'
            cursor='pointer'
            bg={target === selectedTarget ? colors.bgActive : undefined}
            _hover={{ bg: target === selectedTarget ? colors.bgActive : colors.bgHover }}
            onClick={() => onSelectTarget(target)}
          >
            <Text fontSize='sm' flex={1} noOfLines={1} color={target === selectedTarget ? colors.textAccent : colors.textPrimary}>
              {targetLabel(target)}
            </Text>
            <Badge borderRadius='full'>{group.length}</Badge>
          </HStack>
        ))}
      </VStack>

      <VStack align='stretch' spacing={4} p={5}>
        {messages.map((message) => (
          <Box
            key={message.id}
            id={`outbox-${message.id}`}
            p={4}
            borderWidth='1px'
            borderRadius='lg'
            borderColor={message.id === highlightedItemId ? colors.borderAccent : colors.border}
            bg={message.id === highlightedItemId ? colors.bgActive : undefined}
          >
            <HStack justify='space-between' mb={3}>
              <Text fontSize='xs' fontWeight='semibold' color={colors.textSecondary}>
                Coaching Bot
              </Text>
              <Text fontSize='xs' color={colors.textSecondary}>
                {formatDateTime(message.created_at)} · ts {message.external_id}
              </Text>
            </HStack>
            {message.payload.blocks ? (
              <BlockKitPreview blocks={message.payload.blocks} />
            ) : (
              <Text fontSize='sm'>{message.payload.text ?? message.title}</Text>
            )}
          </Box>
        ))}
      </VStack>
    </Grid>
  );
};
