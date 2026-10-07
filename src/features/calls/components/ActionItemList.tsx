import { Badge, Box, HStack, Text, VStack } from '@chakra-ui/react';
import { useAppColors } from '../../../constants/colors';
import type { ActionItem } from '../types';

export interface ActionItemEntry extends ActionItem {
  /** Where the item came from, e.g. the call date (client view) */
  source?: string;
}

interface ActionItemListProps {
  items: ActionItemEntry[];
}

const ROLE_SCHEME: Record<ActionItem['owner_role'], string> = {
  coach: 'brand',
  client: 'teal',
  other: 'gray',
};

export const ActionItemList = ({ items }: ActionItemListProps) => {
  const colors = useAppColors();

  return (
    <VStack align='stretch' spacing={0} divider={<Box borderColor={colors.border} borderBottomWidth='1px' />}>
      {items.map((item, index) => (
        <Box key={`${item.owner}-${item.task}-${index}`} py={2.5}>
          <Text color={colors.textPrimary}>{item.task}</Text>
          <HStack spacing={2} mt={1} flexWrap='wrap'>
            <Badge colorScheme={ROLE_SCHEME[item.owner_role]}>{item.owner}</Badge>
            {item.due && (
              <Text fontSize='xs' color={colors.textSecondary}>
                Due {item.due}
              </Text>
            )}
            {item.source && (
              <Text fontSize='xs' color={colors.textSecondary}>
                · {item.source}
              </Text>
            )}
          </HStack>
        </Box>
      ))}
    </VStack>
  );
};
